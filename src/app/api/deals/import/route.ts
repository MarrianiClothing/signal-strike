import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

// ── Column aliases (case-insensitive) ─────────────────────────────────────────
const ALIASES: Record<string, string[]> = {
  title:         ["title","deal title","deal name","opportunity","job name","job number","name","subject","project"],
  company:       ["company","company name","account","organization","client","customer","employer","business"],
  contact_name:  ["contact name","contact","full name","person","rep","owner","assignee","primary contact"],
  contact_email: ["email","contact email","email address","e-mail"],
  contact_phone: ["phone","phone number","contact phone","mobile","cell","telephone"],
  value:         ["value","amount","deal value","contract value","revenue","price","estimate","budget","size"],
  stage:         ["stage","status","deal stage","pipeline stage","phase"],
  probability:   ["probability","prob","close probability","win probability","chance","likelihood"],
  close_date:    ["close date","expected close","expected close date","close","due date","target date","end date"],
  notes:         ["notes","note","description","comments","details","summary","memo"],
};

const STAGE_MAP: Record<string, string> = {
  prospecting:"prospecting", prospect:"prospecting", lead:"prospecting", new:"prospecting",
  qualification:"qualification", qualified:"qualification", qualifying:"qualification",
  proposal:"proposal", quoted:"proposal", proposing:"proposal",
  negotiation:"negotiation", negotiating:"negotiation", review:"negotiation",
  closed_won:"closed_won", won:"closed_won", "closed won":"closed_won", win:"closed_won", closed:"closed_won",
  closed_lost:"closed_lost", lost:"closed_lost", "closed lost":"closed_lost", dead:"closed_lost",
  "pending sale":"prospecting", "work in progress":"negotiation",
  "accounts receivable":"closed_won", "completed":"closed_won",
};

function findCol(headers: string[], keys: string[]): number {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const key of keys) {
    const i = lower.findIndex(h => h === key || h.includes(key));
    if (i >= 0) return i;
  }
  return -1;
}

function parseDate(val: any): string | null {
  if (!val) return null;
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const str = String(val).trim();
  if (!str || str === "---" || str === "-") return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

function parseValue(val: any): number {
  if (!val) return 0;
  const n = parseFloat(String(val).replace(/[$,\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

function parseStage(val: any): string {
  if (!val) return "prospecting";
  const s = String(val).toLowerCase().trim();
  return STAGE_MAP[s] ?? "prospecting";
}

function parseProbability(val: any): number {
  if (!val) return 10;
  const n = parseFloat(String(val).replace(/[%\s]/g, ""));
  return isNaN(n) ? 10 : Math.min(100, Math.max(0, Math.round(n)));
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx","xls","csv"].includes(ext ?? "")) {
      return NextResponse.json({ error: `Unsupported format: .${ext}. Please upload .xlsx, .xls, or .csv` }, { status: 422 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    if (rows.length < 2) {
      return NextResponse.json({ error: "File appears empty or has only a header row." }, { status: 422 });
    }

    // Find header row (first row with recognizable columns)
    let headerIdx = 0;
    let headers: string[] = [];
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const rowStr = rows[i].map((c: any) => String(c).toLowerCase().trim());
      const allAliases = Object.values(ALIASES).flat();
      const matches = rowStr.filter(h => allAliases.some(a => h.includes(a))).length;
      if (matches >= 1) { headerIdx = i; headers = rowStr; break; }
    }

    if (!headers.length) {
      // Just use first row as headers
      headerIdx = 0;
      headers = rows[0].map((c: any) => String(c).toLowerCase().trim());
    }

    // Map columns
    const cols: Record<string, number> = {};
    for (const [field, aliases] of Object.entries(ALIASES)) {
      cols[field] = findCol(headers, aliases);
    }

    // Need at least a title column
    if (cols.title < 0 && cols.company < 0) {
      return NextResponse.json({
        error: `Could not detect deal columns. Found: ${rows[headerIdx].join(", ")}. Add a 'Title' or 'Company' column.`,
      }, { status: 422 });
    }

    // Parse data rows
    const deals: any[] = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.every((c: any) => !c)) continue; // skip blank rows

      const get = (col: number) => col >= 0 ? String(row[col] ?? "").trim() : "";

      const title   = get(cols.title) || get(cols.company) || `Deal ${i}`;
      const company = get(cols.company);

      deals.push({
        title,
        company:       company || null,
        contact_name:  get(cols.contact_name) || null,
        contact_email: get(cols.contact_email) || null,
        contact_phone: get(cols.contact_phone) || null,
        value:         cols.value >= 0 ? parseValue(row[cols.value]) : 0,
        stage:         cols.stage >= 0 ? parseStage(row[cols.stage]) : "prospecting",
        probability:   cols.probability >= 0 ? parseProbability(row[cols.probability]) : 10,
        expected_close_date: cols.close_date >= 0 ? parseDate(row[cols.close_date]) : null,
        notes:         get(cols.notes) || null,
      });
    }

    if (deals.length === 0) {
      return NextResponse.json({ error: "No deal rows found in file." }, { status: 422 });
    }

    // Report which columns were detected
    const detected = Object.entries(cols)
      .filter(([, v]) => v >= 0)
      .map(([k]) => k);

    return NextResponse.json({ deals, count: deals.length, detected });
  } catch (err: any) {
    console.error("[deals/import]", err);
    return NextResponse.json({ error: err?.message ?? "Parse error" }, { status: 500 });
  }
}
