import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  return data.access_token ?? null;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("x-internal-secret");
  if (authHeader !== process.env.INTERNAL_SYNC_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { user_id } = await req.json();
  if (!user_id) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

  const { data: tokenRow } = await supabaseAdmin
    .from("gmail_tokens")
    .select("*")
    .eq("user_id", user_id)
    .single();

  if (!tokenRow) return NextResponse.json({ error: "No token found" }, { status: 404 });

  let accessToken = tokenRow.access_token;
  if (Date.now() > tokenRow.expiry_date - 60000) {
    const newToken = await refreshAccessToken(tokenRow.refresh_token);
    if (!newToken) return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });
    accessToken = newToken;
    await supabaseAdmin.from("gmail_tokens").update({
      access_token: newToken,
      expiry_date: Date.now() + 3600 * 1000,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user_id);
  }

  const { data: deals } = await supabaseAdmin
    .from("deals")
    .select("id, contact_email")
    .eq("user_id", user_id)
    .not("contact_email", "is", null);

  if (!deals?.length) return NextResponse.json({ synced: 0 });

  let totalSynced = 0;

  for (const deal of deals) {
    if (!deal.contact_email) continue;

    const query = encodeURIComponent(`from:${deal.contact_email} OR to:${deal.contact_email}`);
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    if (!listData.messages) continue;

    for (const msg of listData.messages) {
      const { data: existing } = await supabaseAdmin
        .from("activities")
        .select("id")
        .eq("deal_id", deal.id)
        .eq("external_id", msg.id)
        .maybeSingle();

      if (existing) continue;

      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const msgData = await msgRes.json();
      const headers    = msgData.payload?.headers ?? [];
      const subject    = headers.find((h: any) => h.name === "Subject")?.value ?? "(no subject)";
      const date       = headers.find((h: any) => h.name === "Date")?.value;
      const occurredAt = date ? new Date(date).toISOString() : new Date().toISOString();

      await supabaseAdmin.from("activities").insert({
        user_id,
        deal_id:     deal.id,
        type:        "email",
        title:       subject,
        body:        null,
        external_id: msg.id,
        occurred_at: occurredAt,
      });

      totalSynced++;
    }
  }

  return NextResponse.json({ synced: totalSynced });
}
