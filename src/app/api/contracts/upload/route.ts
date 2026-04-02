import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Returns a signed upload URL — client uploads directly to Supabase (no file through Vercel)
export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json();

    if (!path) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.storage
      .from("contracts")
      .createSignedUploadUrl(path);

    if (error) {
      console.error("[contracts/upload] signed URL error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path: data.path });
  } catch (err: any) {
    console.error("[contracts/upload] caught:", err);
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
