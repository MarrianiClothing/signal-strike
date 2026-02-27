import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (!code) {
    return NextResponse.redirect(`${appUrl}/settings?outlook=error&reason=no_code`);
  }

  const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.OUTLOOK_CLIENT_ID!,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
      redirect_uri: `${appUrl}/api/auth/outlook/callback`,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    return NextResponse.redirect(`${appUrl}/settings?outlook=error&reason=no_token`);
  }

  const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json();
  const email = profile.mail || profile.userPrincipalName || "unknown@outlook.com";

  // Get the logged-in Supabase user via session cookies
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${appUrl}/settings?outlook=error&reason=not_logged_in`);
  }

  // Use service role admin client to bypass RLS (auth cookies unavailable during OAuth redirect)
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const upsertData: any = {
    user_id: user.id,
    email,
    access_token: tokens.access_token,
    expiry_date: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    updated_at: new Date().toISOString(),
  };
  if (tokens.refresh_token) upsertData.refresh_token = tokens.refresh_token;

  const { error: dbError } = await admin
    .from("outlook_tokens")
    .upsert(upsertData, { onConflict: "user_id" });

  if (dbError) {
    return NextResponse.redirect(`${appUrl}/settings?outlook=error&reason=db&detail=${encodeURIComponent(dbError.message)}`);
  }

  return NextResponse.redirect(`${appUrl}/settings?outlook=connected`);
}
