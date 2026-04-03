import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const prefix = searchParams.get("prefix");
    const all    = searchParams.get("all"); // pass all=1 to list all deal folders

    if (!prefix) {
      return NextResponse.json({ error: "Missing prefix" }, { status: 400 });
    }

    if (all === "1") {
      // List all deal folders under this userId, then list files in each
      const { data: folders, error: folderError } = await supabaseAdmin.storage
        .from("contracts")
        .list(prefix, { limit: 200 });

      if (folderError) {
        return NextResponse.json({ error: folderError.message }, { status: 500 });
      }

      // For each folder (dealId), list its files
      const results: { dealId: string; files: any[] }[] = [];
      for (const folder of (folders || [])) {
        if (!folder.id) continue; // skip placeholder entries
        const { data: files } = await supabaseAdmin.storage
          .from("contracts")
          .list(`${prefix}/${folder.name}`, { sortBy: { column: "created_at", order: "desc" } });
        if (files && files.length > 0) {
          results.push({ dealId: folder.name, files });
        }
      }

      return NextResponse.json({ folders: results });
    }

    // Default: list files under a specific prefix (userId/dealId)
    const { data, error } = await supabaseAdmin.storage
      .from("contracts")
      .list(prefix, { sortBy: { column: "created_at", order: "desc" } });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ files: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
