import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiryDate: number } | null> {
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.OUTLOOK_CLIENT_ID!,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
      grant_type: "refresh_token",
      scope: "Mail.Read offline_access User.Read",
    }),
  });
  const data = await res.json();
  if (!data.access_token) return null;
  return {
    accessToken: data.access_token,
    expiryDate: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: tokenRow } = await supabase
    .from("outlook_tokens")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!tokenRow) return NextResponse.json({ error: "Outlook not connected" }, { status: 400 });

  let accessToken = tokenRow.access_token;

  if (tokenRow.refresh_token && Date.now() > tokenRow.expiry_date - 60000) {
    const refreshed = await refreshAccessToken(tokenRow.refresh_token);
    if (!refreshed) return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });
    accessToken = refreshed.accessToken;
    await supabase.from("outlook_tokens").update({
      access_token: refreshed.accessToken,
      expiry_date: refreshed.expiryDate,
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

    const filter = encodeURIComponent(
      `from:${deal.contact_email} OR toRecipients:${deal.contact_email}`
    );
    const messagesRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$filter=contains(from/emailAddress/address,'${deal.contact_email}')&$top=20&$select=id,subject,receivedDateTime,from`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const messagesData = await messagesRes.json();

    const messages = messagesData.value ?? [];

    for (const msg of messages) {
      const { data: existing } = await supabase
        .from("activities")
        .select("id")
        .eq("deal_id", deal.id)
        .eq("external_id", msg.id)
        .maybeSingle();

      if (existing) continue;

      await supabase.from("activities").insert({
        user_id:     user.id,
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
