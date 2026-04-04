import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

// ── Status helpers ─────────────────────────────────────────────────────────────
const ST_LBL: Record<string,string> = {
  not_started:"Not Started", in_progress:"In Progress",
  completed:"Completed",     blocked:"Blocked",
};
const ST_CLR: Record<string,string> = {
  not_started:"#71717a", in_progress:"#C9A84C",
  completed:"#34d399",   blocked:"#f87171",
};

function fmtDate(d: string|null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
}
function fmtDateShort(d: string|null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"});
}

// ── Gantt SVG builder ──────────────────────────────────────────────────────────
function buildGanttSVG(phases: any[], taskMap: Record<string,any[]>): string {
  const datedPhases = phases.filter(p => p.start_date && p.end_date);
  if (!datedPhases.length) return "";

  const minTime = Math.min(...datedPhases.map(p => new Date(p.start_date).getTime()));
  const maxTime = Math.max(...datedPhases.map(p => new Date(p.end_date).getTime())) + 86400000;
  const totalMs = maxTime - minTime;
  const toPct   = (t: number) => Math.min(100, Math.max(0, (t - minTime) / totalMs * 100));

  // Build month headers
  const months: {label:string; lp:number; wp:number}[] = [];
  let cur = new Date(minTime);
  cur = new Date(cur.getFullYear(), cur.getMonth(), 1);
  while (cur.getTime() < maxTime) {
    const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    const s = Math.max(cur.getTime(), minTime);
    const e = Math.min(next.getTime(), maxTime);
    const lp = toPct(s); const wp = toPct(e) - lp;
    if (wp > 0) months.push({ label: cur.toLocaleString("en-US",{month:"short",year:"2-digit"}), lp, wp });
    cur = next;
  }

  const LABEL_W = 200;
  const CHART_W = 700;
  const TOTAL_W = LABEL_W + CHART_W;
  const HDR_H   = 28;
  const PH_H    = 36;
  const TASK_H  = 24;
  const PAD     = 20;

  // Calculate total height
  let totalH = HDR_H;
  for (const ph of phases) {
    totalH += PH_H;
    totalH += (taskMap[ph.id]||[]).length * TASK_H;
  }
  totalH += PAD * 2;

  const SVG_W = TOTAL_W + PAD * 2;
  const SVG_H = totalH + PAD;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" font-family="Arial, sans-serif">`;
  svg += `<rect width="${SVG_W}" height="${SVG_H}" fill="#0a0a0b"/>`;

  // Month headers bg
  svg += `<rect x="${PAD}" y="${PAD}" width="${TOTAL_W}" height="${HDR_H}" fill="#0d0d0f"/>`;

  // Month header labels
  for (const m of months) {
    const x = PAD + LABEL_W + (m.lp / 100) * CHART_W;
    const w = (m.wp / 100) * CHART_W;
    svg += `<rect x="${x}" y="${PAD}" width="${w}" height="${HDR_H}" fill="none" stroke="#27272a" stroke-width="0.5"/>`;
    svg += `<text x="${x+6}" y="${PAD+18}" font-size="10" fill="#71717a" font-weight="600">${m.label}</text>`;
  }

  // Label column header
  svg += `<rect x="${PAD}" y="${PAD}" width="${LABEL_W}" height="${HDR_H}" fill="#0d0d0f" stroke="#27272a" stroke-width="0.5"/>`;
  svg += `<text x="${PAD+10}" y="${PAD+18}" font-size="10" fill="#C9A84C" font-weight="700">PHASE / TASK</text>`;

  // Today line
  const now = Date.now();
  if (now >= minTime && now <= maxTime) {
    const todayX = PAD + LABEL_W + (toPct(now) / 100) * CHART_W;
    svg += `<line x1="${todayX}" y1="${PAD+HDR_H}" x2="${todayX}" y2="${SVG_H-PAD}" stroke="#f87171" stroke-width="1" stroke-dasharray="3,3" opacity="0.6"/>`;
  }

  let y = PAD + HDR_H;

  for (const ph of phases) {
    const tasks = taskMap[ph.id] || [];
    const phColor = ph.color || "#C9A84C";

    // Phase row bg
    svg += `<rect x="${PAD}" y="${y}" width="${TOTAL_W}" height="${PH_H}" fill="#111113" stroke="#1c1c1f" stroke-width="0.5"/>`;

    // Phase color dot + label
    svg += `<rect x="${PAD+10}" y="${y+13}" width="10" height="10" rx="2" fill="${phColor}"/>`;
    const phLabel = ph.name.length > 22 ? ph.name.slice(0,22)+"…" : ph.name;
    svg += `<text x="${PAD+26}" y="${y+22}" font-size="11" fill="#fafafa" font-weight="700">${escXML(phLabel)}</text>`;

    // Phase bar
    if (ph.start_date && ph.end_date) {
      const lp = toPct(new Date(ph.start_date).getTime());
      const rp = toPct(new Date(ph.end_date).getTime() + 86400000);
      const bx = PAD + LABEL_W + (lp / 100) * CHART_W;
      const bw = Math.max(((rp - lp) / 100) * CHART_W, 3);
      svg += `<rect x="${bx}" y="${y+8}" width="${bw}" height="20" rx="3" fill="${phColor}"/>`;
      if (bw > 40) {
        const barLabel = ph.name.length > 14 ? ph.name.slice(0,14)+"…" : ph.name;
        svg += `<text x="${bx+6}" y="${y+22}" font-size="9" fill="#000" font-weight="700">${escXML(barLabel)}</text>`;
      }
    }

    y += PH_H;

    // Task rows
    for (const t of tasks) {
      svg += `<rect x="${PAD}" y="${y}" width="${TOTAL_W}" height="${TASK_H}" fill="#18181b" stroke="#1c1c1f" stroke-width="0.5"/>`;

      // Status dot
      const stClr = ST_CLR[t.status] ?? "#52525b";
      svg += `<circle cx="${PAD+18}" cy="${y+12}" r="4" fill="${stClr}" opacity="0.7"/>`;

      // Task label
      const tkLabel = t.name.length > 26 ? t.name.slice(0,26)+"…" : t.name;
      const tkFill  = t.status === "completed" ? "#52525b" : "#a1a1aa";
      svg += `<text x="${PAD+28}" y="${y+16}" font-size="10" fill="${tkFill}">${escXML(tkLabel)}</text>`;

      // Task bar or milestone
      if (t.start_date && t.due_date) {
        const lp = toPct(new Date(t.start_date).getTime());
        const rp = toPct(new Date(t.due_date).getTime() + 86400000);
        const bx = PAD + LABEL_W + (lp / 100) * CHART_W;
        const bw = Math.max(((rp - lp) / 100) * CHART_W, 3);
        svg += `<rect x="${bx}" y="${y+7}" width="${bw}" height="10" rx="2" fill="${phColor}" opacity="0.5"/>`;
      } else if (t.due_date) {
        const lp = toPct(new Date(t.due_date).getTime());
        const mx = PAD + LABEL_W + (lp / 100) * CHART_W;
        svg += `<polygon points="${mx},${y+5} ${mx+5},${y+12} ${mx},${y+19} ${mx-5},${y+12}" fill="${phColor}"/>`;
      }

      y += TASK_H;
    }
  }

  svg += `</svg>`;
  return svg;
}

function escXML(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

// ── PDF HTML builder ───────────────────────────────────────────────────────────
function buildPDFHtml(project: any, phases: any[], taskMap: Record<string,any[]>, dealTitle: string, ganttSvg: string): string {
  const allTasks   = Object.values(taskMap).flat();
  const doneTasks  = allTasks.filter((t:any) => t.status === "completed").length;
  const progPct    = allTasks.length ? Math.round(doneTasks / allTasks.length * 100) : 0;
  const exportDate = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});

  let listRows = "";
  for (const ph of phases) {
    const tasks = taskMap[ph.id] || [];
    const doneC = tasks.filter((t:any) => t.status==="completed").length;
    listRows += `
      <tr style="background:#111113;">
        <td style="padding:10px 14px;border-bottom:1px solid #1c1c1f;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${ph.color};margin-right:8px;vertical-align:middle;"></span>
          <strong style="color:#fafafa;font-size:13px;">${escXML(ph.name)}</strong>
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #1c1c1f;color:#71717a;font-size:12px;">${fmtDate(ph.start_date)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #1c1c1f;color:#71717a;font-size:12px;">${fmtDate(ph.end_date)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #1c1c1f;">
          <span style="font-size:11px;font-weight:600;color:${ST_CLR[ph.status]??'#71717a'};background:${ST_CLR[ph.status]??'#71717a'}22;padding:2px 8px;border-radius:4px;">${ST_LBL[ph.status]??ph.status}</span>
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #1c1c1f;color:#52525b;font-size:12px;">${doneC}/${tasks.length}</td>
      </tr>`;
    for (const t of tasks) {
      listRows += `
      <tr style="background:#18181b;">
        <td style="padding:8px 14px 8px 36px;border-bottom:1px solid #111113;color:${t.status==="completed"?"#52525b":"#a1a1aa"};font-size:12px;text-decoration:${t.status==="completed"?"line-through":"none"};">
          <span style="color:${ST_CLR[t.status]??'#52525b'};margin-right:6px;">●</span>${escXML(t.name)}${t.assignee?` <span style="color:#52525b;margin-left:8px;">· ${escXML(t.assignee)}</span>`:""}
        </td>
        <td style="padding:8px 14px;border-bottom:1px solid #111113;color:#52525b;font-size:11px;">${fmtDate(t.start_date)}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #111113;color:#52525b;font-size:11px;">${fmtDate(t.due_date)}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #111113;">
          <span style="font-size:10px;color:${ST_CLR[t.status]??'#52525b'};background:${ST_CLR[t.status]??'#52525b'}22;padding:2px 6px;border-radius:3px;">${ST_LBL[t.status]??t.status}</span>
        </td>
        <td style="padding:8px 14px;border-bottom:1px solid #111113;color:#3f3f46;font-size:11px;">${t.notes?escXML(t.notes.slice(0,40)):"—"}</td>
      </tr>`;
    }
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#0a0a0b; color:#fafafa; font-family:Arial,sans-serif; padding:40px; }
  h1   { font-size:22px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; }
  h2   { font-size:14px; font-weight:700; color:#C9A84C; text-transform:uppercase; letter-spacing:0.08em; margin:32px 0 14px; }
  table { width:100%; border-collapse:collapse; }
  th { background:#0d0d0f; color:#C9A84C; font-size:11px; text-transform:uppercase; letter-spacing:0.06em; padding:10px 14px; text-align:left; border-bottom:1px solid #C9A84C44; }
</style>
</head>
<body>

<!-- Header -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #C9A84C44;">
  <div>
    <p style="color:#C9A84C;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:6px;">Project Schedule</p>
    <h1>${escXML(project.name)}</h1>
    ${dealTitle ? `<p style="color:#C9A84C;font-size:13px;margin-top:6px;">${escXML(dealTitle)}</p>` : ""}
  </div>
  <div style="text-align:right;">
    <p style="color:#52525b;font-size:11px;margin-bottom:4px;">Exported ${exportDate}</p>
    <p style="font-size:13px;color:#C9A84C;font-weight:700;">${progPct}% Complete</p>
    <p style="font-size:11px;color:#52525b;">${doneTasks} of ${allTasks.length} tasks done</p>
  </div>
</div>

<!-- Progress bar -->
<div style="height:6px;background:#27272a;border-radius:3px;margin-bottom:32px;">
  <div style="height:100%;width:${progPct}%;background:${progPct===100?"#34d399":"#C9A84C"};border-radius:3px;"></div>
</div>

<!-- Gantt chart -->
${ganttSvg ? `<h2>Gantt Chart</h2><div style="margin-bottom:32px;">${ganttSvg}</div>` : ""}

<!-- Schedule list -->
<h2>Schedule — List View</h2>
<table>
  <thead>
    <tr>
      <th>Phase / Task</th>
      <th>Start</th>
      <th>End / Due</th>
      <th>Status</th>
      <th>Progress / Notes</th>
    </tr>
  </thead>
  <tbody>${listRows}</tbody>
</table>

<!-- Footer -->
<div style="margin-top:40px;padding-top:16px;border-top:1px solid #1c1c1f;display:flex;justify-content:space-between;align-items:center;">
  <p style="color:#3f3f46;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">Powered by Signal Strike · HillTop Ave</p>
  <p style="color:#3f3f46;font-size:10px;">${exportDate}</p>
</div>

</body>
</html>`;
}

// ── CSV builder ────────────────────────────────────────────────────────────────
function buildCSV(project: any, phases: any[], taskMap: Record<string,any[]>, dealTitle: string): string {
  const rows: string[][] = [
    ["Project", project.name],
    dealTitle ? ["Deal", dealTitle] : [],
    ["Exported", new Date().toLocaleDateString("en-US")],
    [],
    ["Phase", "Task", "Assignee", "Start Date", "End Date", "Status", "Notes"],
  ].filter(r => r.length > 0);

  for (const ph of phases) {
    rows.push([ph.name, "", "", fmtDate(ph.start_date), fmtDate(ph.end_date), ST_LBL[ph.status]??ph.status, ""]);
    for (const t of (taskMap[ph.id]||[])) {
      rows.push([ph.name, t.name, t.assignee??""  , fmtDate(t.start_date), fmtDate(t.due_date), ST_LBL[t.status]??t.status, t.notes??""]);
    }
  }

  return rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
}

// ── Route handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { projectId, recipientEmail, recipientName } = await req.json();

    if (!projectId || !recipientEmail) {
      return NextResponse.json({ error: "Missing projectId or recipientEmail" }, { status: 400 });
    }

    // Load project
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects").select("*").eq("id", projectId).single();
    if (projErr || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Load deal title
    let dealTitle = "";
    if (project.deal_id) {
      const { data: deal } = await supabaseAdmin.from("deals").select("title").eq("id", project.deal_id).single();
      dealTitle = deal?.title ?? "";
    }

    // Load phases + tasks
    const { data: phases } = await supabaseAdmin
      .from("project_phases").select("*").eq("project_id", projectId).order("sort_order").order("created_at");
    const phList = phases || [];

    const taskMap: Record<string,any[]> = {};
    if (phList.length) {
      const { data: tasks } = await supabaseAdmin
        .from("project_tasks").select("*").in("phase_id", phList.map((p:any) => p.id)).order("sort_order").order("created_at");
      for (const t of (tasks||[])) { if (!taskMap[t.phase_id]) taskMap[t.phase_id]=[]; taskMap[t.phase_id].push(t); }
    }

    // Build attachments
    const ganttSvg = buildGanttSVG(phList, taskMap);
    const pdfHtml  = buildPDFHtml(project, phList, taskMap, dealTitle, ganttSvg);
    const csvData  = buildCSV(project, phList, taskMap, dealTitle);
    const safeName = project.name.replace(/[^a-zA-Z0-9\s-]/g,"").trim().replace(/\s+/g,"-");

    // Send via Resend
    const { error: sendErr } = await resend.emails.send({
      from:    "Signal Strike <onboarding@resend.dev>",
      to:      recipientEmail,
      subject: `📋 Project Schedule — ${project.name}`,
      html: `
        <div style="background:#0a0a0b;color:#fafafa;font-family:Arial,sans-serif;padding:40px;max-width:600px;margin:0 auto;">
          <p style="color:#C9A84C;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Signal Strike · Project Export</p>
          <h1 style="font-size:20px;font-weight:800;margin:0 0 6px;">${escXML(project.name)}</h1>
          ${dealTitle ? `<p style="color:#C9A84C;font-size:13px;margin:0 0 20px;">${escXML(dealTitle)}</p>` : `<p style="margin:0 0 20px;"></p>`}
          <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin-bottom:24px;">
            ${recipientName ? `Hi ${escXML(recipientName)},<br/><br/>` : ""}
            Your project schedule is attached as a PDF (with Gantt chart) and CSV for editing in Excel or Google Sheets.
          </p>
          <div style="background:#111113;border:1px solid #27272a;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
            <p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Attachments</p>
            <p style="color:#fafafa;font-size:13px;margin:0 0 4px;">📕 ${safeName}-schedule.pdf</p>
            <p style="color:#fafafa;font-size:13px;margin:0;">📊 ${safeName}-schedule.csv</p>
          </div>
          <p style="color:#3f3f46;font-size:11px;border-top:1px solid #1c1c1f;padding-top:16px;margin:0;">
            Powered by Signal Strike · HillTop Ave
          </p>
        </div>`,
      attachments: [
        {
          filename: `${safeName}-schedule.pdf`,
          content:  Buffer.from(pdfHtml).toString("base64"),
          content_type: "text/html",
        },
        {
          filename: `${safeName}-schedule.csv`,
          content:  Buffer.from(csvData).toString("base64"),
          content_type: "text/csv",
        },
      ],
    });

    if (sendErr) {
      console.error("[projects/export] Resend error:", sendErr);
      return NextResponse.json({ error: sendErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[projects/export] error:", err);
    return NextResponse.json({ error: err?.message ?? "Export failed" }, { status: 500 });
  }
}
