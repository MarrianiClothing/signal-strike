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
    const all    = searchParams.get("all");

    if (!prefix) {
      return NextResponse.json({ error: "Missing prefix" }, { status: 400 });
    }

    if (all === "1") {
      // List all deal folders under userId/
      // NOTE: Supabase returns folder entries with id=null — do NOT filter on id
      const { data: folders, error: folderError } = await supabaseAdmin.storage
        .from("contracts")
        .list(prefix, { limit: 200 });

      if (folderError) {
        return NextResponse.json({ error: folderError.message }, { status: 500 });
      }

      const results: { dealId: string; files: any[] }[] = [];

      for (const folder of (folders || [])) {
        // Skip actual files (they have metadata); we only want folder entries
        if (folder.metadata !== null) continue;
        if (!folder.name) continue;

        const { data: files, error: filesError } = await supabaseAdmin.storage
          .from("contracts")
          .list(`${prefix}/${folder.name}`, {
            sortBy: { column: "created_at", order: "desc" },
          });

        if (filesError || !files || files.length === 0) continue;

        // Filter out any placeholder entries (files have non-null metadata)
        const realFiles = files.filter(f => f.metadata !== null || f.name !== ".emptyFolderPlaceholder");
        if (realFiles.length > 0) {
          results.push({ dealId: folder.name, files: realFiles });
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
