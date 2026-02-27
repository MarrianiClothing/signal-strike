import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: tokenRow } = await supabase
    .from("gmail_tokens")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!tokenRow) return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });

  let accessToken = tokenRow.access_token;
  if (Date.now() > tokenRow.expiry_date - 60000) {
    const newToken = await refreshAccessToken(tokenRow.refresh_token);
    if (!newToken) return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });
    accessToken = newToken;
    await supabase.from("gmail_tokens").update({
      access_token: newToken,
      expiry_date: Date.now() + 3600 * 1000,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);
  }

  const { data: deals } = await supabase
    .from("deals")
    .select("id, contact_email, title")
    .eq("user_id", user.id)
    .not("contact_email", "is", null);

  if (!deals || deals.length === 0) {
    return NextResponse.json({ synced: 0, message: "No deals with contact emails" });
  }

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
      const { data: existing } = await supabase
        .from("activities")
        .select("id")
        .eq("deal_id", deal.id)
        .eq("external_id", msg.id)
        .maybeSingle();

      if (existing) continue;

      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const msgData = await msgRes.json();
      const headers = msgData.payload?.headers ?? [];
      const subject    = headers.find((h: any) => h.name === "Subject")?.value ?? "(no subject)";
      const date       = headers.find((h: any) => h.name === "Date")?.value;
      const occurredAt = date ? new Date(date).toISOString() : new Date().toISOString();

      await supabase.from("activities").insert({
        user_id:     user.id,
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
