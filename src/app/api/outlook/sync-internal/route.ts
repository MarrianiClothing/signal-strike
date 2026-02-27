import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiryDate: number } | null> {
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.OUTLOOK_CLIENT_ID!,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
      grant_type:    "refresh_token",
      scope:         "Mail.Read offline_access User.Read",
    }),
  });
  const data = await res.json();
  if (!data.access_token) return null;
  return {
    accessToken: data.access_token,
    expiryDate:  Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("x-internal-secret");
  if (authHeader !== process.env.INTERNAL_SYNC_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { user_id } = await req.json();
  if (!user_id) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

  const { data: tokenRow } = await supabaseAdmin
    .from("outlook_tokens")
    .select("*")
    .eq("user_id", user_id)
    .single();

  if (!tokenRow) return NextResponse.json({ error: "No Outlook token found" }, { status: 404 });

  let accessToken = tokenRow.access_token;

  if (tokenRow.refresh_token && Date.now() > tokenRow.expiry_date - 60000) {
    const refreshed = await refreshAccessToken(tokenRow.refresh_token);
    if (!refreshed) return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });
    accessToken = refreshed.accessToken;
    await supabaseAdmin.from("outlook_tokens").update({
      access_token: refreshed.accessToken,
      expiry_date:  refreshed.expiryDate,
      updated_at:   new Date().toISOString(),
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

    const messagesRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages` +
      `?$filter=contains(from/emailAddress/address,'${deal.contact_email}')` +
      `&$top=20&$select=id,subject,receivedDateTime,from`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const messagesData = await messagesRes.json();
    const messages = messagesData.value ?? [];

    for (const msg of messages) {
      const { data: existing } = await supabaseAdmin
        .from("activities")
        .select("id")
        .eq("deal_id", deal.id)
        .eq("external_id", msg.id)
        .maybeSingle();

      if (existing) continue;

      await supabaseAdmin.from("activities").insert({
        user_id,
        deal_id:     deal.id,
        type:        "email",
        title:       msg.subject || "(no subject)",
        body:        null,
        external_id: msg.id,
        occurred_at: msg.receivedDateTime || new Date().toISOString(),
      });

      totalSynced++;
    }
  }

  return NextResponse.json({ synced: totalSynced });
}
