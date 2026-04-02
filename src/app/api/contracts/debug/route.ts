import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({
      ok: false,
      error: "Missing env vars",
      hasUrl: !!url,
      hasKey: !!key,
    });
  }

  try {
    const supabaseAdmin = createClient(url, key);
    const { data, error } = await supabaseAdmin.storage.getBucket("contracts");
    if (error) {
      return NextResponse.json({ ok: false, bucketError: error.message });
    }
    return NextResponse.json({ ok: true, bucket: data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, caught: err?.message });
  }
}
