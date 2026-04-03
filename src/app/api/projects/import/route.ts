import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

// ── Column name aliases (case-insensitive) ────────────────────────────────────
const PHASE_KEYS   = ["phase", "phase name", "phase_name", "group", "category"];
const TASK_KEYS    = ["task", "task name", "task_name", "activity", "work item", "item"];
const ASSIGN_KEYS  = ["assignee", "assigned to", "assigned_to", "resource", "owner", "responsible"];
const START_KEYS   = ["start", "start date", "start_date", "begin", "begin date"];
const END_KEYS     = ["end", "end date", "end_date", "finish", "finish date", "due", "due date", "due_date"];
const STATUS_KEYS  = ["status", "state", "progress"];
const NOTES_KEYS   = ["notes", "note", "description", "comments", "comment"];

function findCol(headers: string[], keys: string[]): number {
  return headers.findIndex(h => keys.includes(h.toLowerCase().trim()));
}

function parseDate(val: any): string | null {
  if (!val) return null;
  // Excel serial number
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const str = String(val).trim();
  if (!str) return null;
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

function normalizeStatus(val: any): string {
  const s = String(val ?? "").toLowerCase().trim();
  if (["complete","completed","done","finished","closed"].some(x => s.includes(x))) return "completed";
  if (["in progress","in-progress","started","active","underway"].some(x => s.includes(x))) return "in_progress";
  if (["blocked","on hold","hold","delayed","stuck"].some(x => s.includes(x))) return "blocked";
  return "not_started";
}

const COLORS = ["#C9A84C","#60a5fa","#34d399","#a78bfa","#fb923c","#f87171"];

interface ParsedTask  { name:string; assignee:string|null; start_date:string|null; due_date:string|null; status:string; notes:string|null; }
interface ParsedPhase { name:string; start_date:string|null; end_date:string|null; status:string; color:string; tasks:ParsedTask[]; }

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "mpp") {
      return NextResponse.json({
        error: "Microsoft Project (.mpp) files cannot be parsed directly. Please export to Excel from MS Project: File → Save As → Excel Workbook (.xlsx), then upload that file.",
      }, { status: 422 });
    }
    if (!["xlsx","xls","csv"].includes(ext ?? "")) {
      return NextResponse.json({ error: `Unsupported file type: .${ext}. Please upload .xlsx, .xls, or .csv` }, { status: 422 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    if (rows.length < 2) return NextResponse.json({ error: "File appears empty or has only a header row." }, { status: 422 });

    // Find header row (first row with recognizable column names)
    let headerIdx = 0;
    let headers: string[] = [];
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const rowStr = rows[i].map((c: any) => String(c).toLowerCase().trim());
      if (findCol(rowStr, PHASE_KEYS) >= 0 || findCol(rowStr, TASK_KEYS) >= 0) {
        headerIdx = i;
        headers   = rowStr;
        break;
      }
    }
    if (!headers.length) {
      return NextResponse.json({
        error: "Could not detect column headers. Make sure your spreadsheet has a header row with columns like: Phase, Task, Assignee, Start Date, End Date, Status"
      }, { status: 422 });
    }

    const phaseCol  = findCol(headers, PHASE_KEYS);
    const taskCol   = findCol(headers, TASK_KEYS);
    const assignCol = findCol(headers, ASSIGN_KEYS);
    const startCol  = findCol(headers, START_KEYS);
    const endCol    = findCol(headers, END_KEYS);
    const statusCol = findCol(headers, STATUS_KEYS);
    const notesCol  = findCol(headers, NOTES_KEYS);

    if (phaseCol < 0) {
      return NextResponse.json({
        error: `No 'Phase' column found. Detected columns: ${rows[headerIdx].join(", ")}. Please add a 'Phase' column.`
      }, { status: 422 });
    }

    // Parse rows into phases
    const phaseMap: Map<string, ParsedPhase> = new Map();
    const phaseOrder: string[] = [];
    let colorIdx = 0;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row   = rows[i];
      const phase = String(row[phaseCol] ?? "").trim();
      const task  = taskCol >= 0 ? String(row[taskCol] ?? "").trim() : "";

      if (!phase && !task) continue; // blank row

      const phaseName = phase || "(Unassigned)";
      if (!phaseMap.has(phaseName)) {
        phaseMap.set(phaseName, {
          name:       phaseName,
          start_date: null,
          end_date:   null,
          status:     "not_started",
          color:      COLORS[colorIdx++ % COLORS.length],
          tasks:      [],
        });
        phaseOrder.push(phaseName);
      }

      const ph = phaseMap.get(phaseName)!;
      const sd = startCol >= 0 ? parseDate(row[startCol]) : null;
      const ed = endCol   >= 0 ? parseDate(row[endCol])   : null;
      const st = statusCol >= 0 ? normalizeStatus(row[statusCol]) : "not_started";

      if (task) {
        ph.tasks.push({
          name:       task,
          assignee:   assignCol >= 0 ? String(row[assignCol] ?? "").trim() || null : null,
          start_date: sd,
          due_date:   ed,
          status:     st,
          notes:      notesCol >= 0 ? String(row[notesCol] ?? "").trim() || null : null,
        });
      } else {
        // Phase summary row — use its dates for the phase itself
        if (sd) ph.start_date = sd;
        if (ed) ph.end_date   = ed;
        if (statusCol >= 0) ph.status = st;
      }
    }

    // Derive phase dates from task dates if not set
    for (const ph of phaseMap.values()) {
      if (!ph.start_date) {
        const starts = ph.tasks.map(t => t.start_date).filter(Boolean) as string[];
        if (starts.length) ph.start_date = starts.sort()[0];
      }
      if (!ph.end_date) {
        const ends = ph.tasks.map(t => t.due_date).filter(Boolean) as string[];
        if (ends.length) ph.end_date = ends.sort().reverse()[0];
      }
    }

    const result: ParsedPhase[] = phaseOrder.map(n => phaseMap.get(n)!);
    const totalTasks = result.reduce((s, p) => s + p.tasks.length, 0);

    return NextResponse.json({ phases: result, stats: { phases: result.length, tasks: totalTasks } });
  } catch (err: any) {
    console.error("[projects/import]", err);
    return NextResponse.json({ error: err?.message ?? "Parse error" }, { status: 500 });
  }
}
