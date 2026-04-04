import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { PDFDocument, rgb, StandardFonts, PageSizes } from "pdf-lib";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

// ── Helpers ───────────────────────────────────────────────────────────────────
const ST_LBL: Record<string,string> = {
  not_started:"Not Started", in_progress:"In Progress",
  completed:"Completed", blocked:"Blocked",
};
type RGB3 = [number,number,number];
const ST_CLR: Record<string,RGB3> = {
  not_started:[0.32,0.32,0.36], in_progress:[0.79,0.66,0.30],
  completed:  [0.20,0.83,0.60], blocked:    [0.97,0.44,0.44],
};
const PHASE_COLS: RGB3[] = [
  [0.79,0.66,0.30],[0.38,0.65,0.98],[0.20,0.83,0.60],
  [0.66,0.54,0.98],[0.98,0.57,0.24],[0.97,0.44,0.44],
];

function hexToRgbF(hex: string): RGB3 {
  const h = hex.replace("#","");
  return [
    parseInt(h.slice(0,2),16)/255,
    parseInt(h.slice(2,4),16)/255,
    parseInt(h.slice(4,6),16)/255,
  ];
}
function r(...c: RGB3) { return rgb(c[0],c[1],c[2]); }
function fmtDate(d: string|null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
}
function fmtShort(d: string|null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"});
}
function clamp(v:number,min:number,max:number){return Math.min(max,Math.max(min,v));}

// ── PDF Builder ───────────────────────────────────────────────────────────────
async function buildPDF(
  project: any, phases: any[], taskMap: Record<string,any[]>, dealTitle: string
): Promise<Uint8Array> {

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(project.name);
  pdfDoc.setAuthor("Signal Strike · HillTop Ave");

  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const DARK  : RGB3 = [0.04,0.04,0.04];
  const CARD  : RGB3 = [0.07,0.07,0.07];
  const MID   : RGB3 = [0.11,0.11,0.12];
  const BORDER: RGB3 = [0.15,0.15,0.17];
  const GOLD  : RGB3 = [0.79,0.66,0.30];
  const WHITE : RGB3 = [0.98,0.98,0.98];
  const DIM   : RGB3 = [0.32,0.32,0.36];
  const GREEN : RGB3 = [0.20,0.83,0.60];
  const RED   : RGB3 = [0.97,0.44,0.44];

  const allTasks  = Object.values(taskMap).flat();
  const doneTasks = allTasks.filter((t:any) => t.status==="completed").length;
  const progPct   = allTasks.length ? doneTasks/allTasks.length : 0;
  const exportDate = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});

  // Helper to add a landscape page
  function addPage() {
    const p = pdfDoc.addPage([792, 612]); // Letter landscape
    p.drawRectangle({ x:0, y:0, width:792, height:612, color:r(...DARK) });
    return p;
  }

  // ── Page 1: Header + Gantt ─────────────────────────────────────────────────
  let page = addPage();
  const PW = 792; const PH = 612;
  const ML = 36; const MR = 36; const W = PW - ML - MR;
  let y = PH - 36; // pdf-lib: y=0 is bottom

  // Header label
  page.drawText("PROJECT SCHEDULE  ·  SIGNAL STRIKE", {
    x:ML, y, font:fontB, size:7, color:r(...GOLD), letterSpacing:1.2,
  });
  y -= 18;

  // Project name
  const nameSize = project.name.length > 50 ? 14 : 18;
  page.drawText(project.name.slice(0,70), { x:ML, y, font:fontB, size:nameSize, color:r(...WHITE) });
  if (dealTitle) {
    y -= 16;
    page.drawText(dealTitle.slice(0,80), { x:ML, y, font:fontR, size:10, color:r(...GOLD) });
  }

  // Right side
  const rightY = PH - 36;
  page.drawText(`Exported ${exportDate}`, { x:ML, y:rightY, font:fontR, size:8, color:r(...DIM), maxWidth:W, lineHeight:12 });
  const pctStr   = `${Math.round(progPct*100)}% Complete`;
  const pctColor = progPct===1 ? r(...GREEN) : r(...GOLD);
  page.drawText(pctStr, { x:PW-MR-fontB.widthOfTextAtSize(pctStr,13), y:rightY-14, font:fontB, size:13, color:pctColor });
  const subStr = `${doneTasks} of ${allTasks.length} tasks done`;
  page.drawText(subStr, { x:PW-MR-fontR.widthOfTextAtSize(subStr,8), y:rightY-30, font:fontR, size:8, color:r(...DIM) });

  y -= 10;

  // Progress bar
  page.drawRectangle({ x:ML, y, width:W, height:5, color:r(...MID) });
  if (progPct > 0) {
    page.drawRectangle({ x:ML, y, width:W*progPct, height:5, color:progPct===1?r(...GREEN):r(...GOLD) });
  }
  y -= 14;

  // Divider
  page.drawRectangle({ x:ML, y, width:W, height:0.5, color:r(...BORDER) });
  y -= 14;

  // ── Gantt ──────────────────────────────────────────────────────────────────
  const datedPhases = phases.filter(p => p.start_date && p.end_date);
  if (datedPhases.length > 0) {
    page.drawText("GANTT CHART", { x:ML, y, font:fontB, size:8, color:r(...GOLD), letterSpacing:1 });
    y -= 14;

    const minTime = Math.min(...datedPhases.map(p=>new Date(p.start_date).getTime()));
    const maxTime = Math.max(...datedPhases.map(p=>new Date(p.end_date).getTime()))+86400000;
    const tMs     = maxTime - minTime;
    const toPct   = (t:number) => clamp((t-minTime)/tMs,0,1);

    const LBL_W  = 140;
    const G_W    = W - LBL_W - 6;
    const G_X    = ML + LBL_W + 6;
    const PH_H   = 17;
    const TK_H   = 12;
    const HDR_H  = 16;

    // Month headers row bg
    page.drawRectangle({ x:G_X, y:y-HDR_H, width:G_W, height:HDR_H, color:r(...[0.05,0.05,0.05] as RGB3) });
    page.drawRectangle({ x:ML,  y:y-HDR_H, width:LBL_W, height:HDR_H, color:r(...[0.05,0.05,0.05] as RGB3) });
    page.drawText("PHASE / TASK", { x:ML+4, y:y-HDR_H+5, font:fontB, size:6.5, color:r(...GOLD), letterSpacing:0.8 });

    // Month columns
    let cur = new Date(minTime);
    cur = new Date(cur.getFullYear(), cur.getMonth(), 1);
    while (cur.getTime() < maxTime) {
      const next  = new Date(cur.getFullYear(), cur.getMonth()+1, 1);
      const s     = Math.max(cur.getTime(), minTime);
      const e     = Math.min(next.getTime(), maxTime);
      const lp    = toPct(s); const wp = toPct(e)-lp;
      const mX    = G_X + lp*G_W;
      const mW    = wp*G_W;
      const mLbl  = cur.toLocaleString("en-US",{month:"short",year:"2-digit"});
      page.drawRectangle({ x:mX, y:y-HDR_H, width:mW, height:HDR_H, borderColor:r(...BORDER), borderWidth:0.4, color:r(0.05,0.05,0.05) });
      if (mW > 18) page.drawText(mLbl, { x:mX+3, y:y-HDR_H+5, font:fontB, size:6, color:r(...DIM) });
      cur = next;
    }
    y -= HDR_H;

    // Today line x position (draw after rows)
    const todayPct = toPct(Date.now());
    const todayX   = G_X + todayPct*G_W;
    const ganttTopY = y;

    // Phase + task rows
    for (const ph of phases) {
      if (y < 40) break;
      const tasks  = taskMap[ph.id] || [];
      const phRgb  = hexToRgbF(ph.color || "#C9A84C");

      // Phase row
      page.drawRectangle({ x:ML, y:y-PH_H, width:W, height:PH_H, color:r(...CARD) });
      page.drawRectangle({ x:ML+4, y:y-PH_H+5, width:8, height:8, color:r(...phRgb) });
      page.drawText(ph.name.slice(0,22), { x:ML+16, y:y-PH_H+6, font:fontB, size:7.5, color:r(...WHITE) });

      if (ph.start_date && ph.end_date) {
        const bL = toPct(new Date(ph.start_date).getTime());
        const bR = toPct(new Date(ph.end_date).getTime()+86400000);
        const bX = G_X + bL*G_W;
        const bW = Math.max((bR-bL)*G_W, 3);
        page.drawRectangle({ x:bX, y:y-PH_H+4, width:bW, height:PH_H-8, color:r(...phRgb) });
        if (bW > 28) page.drawText(ph.name.slice(0,14), { x:bX+3, y:y-PH_H+8, font:fontB, size:6, color:r(0,0,0) });
      }
      page.drawRectangle({ x:ML, y:y-PH_H, width:W, height:0.4, color:r(...MID) });
      y -= PH_H;

      // Tasks
      for (const t of tasks) {
        if (y < 40) break;
        const tClr = ST_CLR[t.status] ?? DIM;
        page.drawRectangle({ x:ML, y:y-TK_H, width:W, height:TK_H, color:r(0.09,0.09,0.10) });
        page.drawEllipse({ cx:ML+12, cy:y-TK_H+6, xScale:2.5, yScale:2.5, color:r(...tClr) });
        const tColor = t.status==="completed" ? r(...DIM) : r(0.63,0.63,0.67);
        page.drawText(t.name.slice(0,24), { x:ML+18, y:y-TK_H+4, font:fontR, size:7, color:tColor });

        if (t.start_date && t.due_date) {
          const bL = toPct(new Date(t.start_date).getTime());
          const bR = toPct(new Date(t.due_date).getTime()+86400000);
          const bX = G_X + bL*G_W;
          const bW = Math.max((bR-bL)*G_W, 2);
          page.drawRectangle({ x:bX, y:y-TK_H+3, width:bW, height:TK_H-6, color:rgb(phRgb[0],phRgb[1],phRgb[2]) });
        } else if (t.due_date) {
          const mX = G_X + toPct(new Date(t.due_date).getTime())*G_W;
          page.drawEllipse({ cx:mX, cy:y-TK_H+6, xScale:4, yScale:4, color:r(...phRgb) });
        }
        page.drawRectangle({ x:ML, y:y-TK_H, width:W, height:0.3, color:r(...MID) });
        y -= TK_H;
      }
    }

    // Today line
    if (todayPct >= 0 && todayPct <= 1) {
      page.drawRectangle({ x:todayX, y, width:1, height:ganttTopY-y, color:r(...RED), opacity:0.5 });
    }
    y -= 8;
  }

  // ── Page 2: List View ──────────────────────────────────────────────────────
  page = addPage();
  y = PH - 36;

  page.drawText("SCHEDULE — LIST VIEW", { x:ML, y, font:fontB, size:8, color:r(...GOLD), letterSpacing:1 });
  y -= 16;

  // Table header
  const C = { name:190, start:84, end:84, status:88, assignee: W-190-84-84-88 };
  const cols = [
    { lbl:"PHASE / TASK",    w:C.name,     x:ML },
    { lbl:"START",           w:C.start,    x:ML+C.name },
    { lbl:"END / DUE",       w:C.end,      x:ML+C.name+C.start },
    { lbl:"STATUS",          w:C.status,   x:ML+C.name+C.start+C.end },
    { lbl:"ASSIGNEE / NOTES",w:C.assignee, x:ML+C.name+C.start+C.end+C.status },
  ];

  const HDR = 16;
  page.drawRectangle({ x:ML, y:y-HDR, width:W, height:HDR, color:r(0.05,0.05,0.05) });
  for (const c of cols) {
    page.drawText(c.lbl, { x:c.x+4, y:y-HDR+5, font:fontB, size:6.5, color:r(...GOLD), letterSpacing:0.7 });
  }
  page.drawRectangle({ x:ML, y:y-HDR, width:W, height:0.5, color:r(...GOLD) });
  y -= HDR;

  const PH_R = 16;
  const TK_R = 12;

  for (const ph of phases) {
    if (y < 50) {
      page = addPage();
      y = PH - 40;
    }
    const tasks  = taskMap[ph.id] || [];
    const doneC  = tasks.filter((t:any) => t.status==="completed").length;
    const phRgb  = hexToRgbF(ph.color || "#C9A84C");
    const stClr  = ST_CLR[ph.status] ?? DIM;

    // Phase row
    page.drawRectangle({ x:ML, y:y-PH_R, width:W, height:PH_R, color:r(...CARD) });
    page.drawRectangle({ x:ML+4, y:y-PH_R+4, width:8, height:8, color:r(...phRgb) });
    page.drawText(ph.name.slice(0,26), { x:ML+16, y:y-PH_R+5, font:fontB, size:8, color:r(...WHITE) });
    page.drawText(fmtDate(ph.start_date), { x:cols[1].x+4, y:y-PH_R+5, font:fontR, size:7.5, color:r(...DIM) });
    page.drawText(fmtDate(ph.end_date),   { x:cols[2].x+4, y:y-PH_R+5, font:fontR, size:7.5, color:r(...DIM) });

    // Status badge
    page.drawRectangle({ x:cols[3].x+4, y:y-PH_R+3, width:74, height:10, color:r(...stClr) });
    page.drawText(ST_LBL[ph.status]??ph.status, { x:cols[3].x+7, y:y-PH_R+5, font:fontB, size:6.5, color:r(0,0,0) });
    page.drawText(`${doneC}/${tasks.length} tasks`, { x:cols[4].x+4, y:y-PH_R+5, font:fontR, size:7.5, color:r(...DIM) });
    page.drawRectangle({ x:ML, y:y-PH_R, width:W, height:0.4, color:r(...MID) });
    y -= PH_R;

    for (const t of tasks) {
      if (y < 40) {
        page = addPage();
        y = PH - 40;
      }
      const tClr  = ST_CLR[t.status] ?? DIM;
      const tFill = t.status==="completed" ? r(...DIM) : r(0.63,0.63,0.67);
      page.drawRectangle({ x:ML, y:y-TK_R, width:W, height:TK_R, color:r(0.09,0.09,0.10) });
      page.drawEllipse({ cx:ML+13, cy:y-TK_R+6, xScale:2.5, yScale:2.5, color:r(...tClr) });
      page.drawText(t.name.slice(0,28), { x:ML+20, y:y-TK_R+4, font:fontR, size:7.5, color:tFill });
      page.drawText(fmtDate(t.start_date), { x:cols[1].x+4, y:y-TK_R+4, font:fontR, size:7, color:r(...DIM) });
      page.drawText(fmtDate(t.due_date),   { x:cols[2].x+4, y:y-TK_R+4, font:fontR, size:7, color:r(...DIM) });
      page.drawText(ST_LBL[t.status]??t.status, { x:cols[3].x+4, y:y-TK_R+4, font:fontR, size:7, color:r(...tClr) });
      const meta = [t.assignee, t.notes?.slice?.(0,28)].filter(Boolean).join(" · ");
      page.drawText(meta||"-", { x:cols[4].x+4, y:y-TK_R+4, font:fontR, size:6.5, color:r(0.25,0.25,0.28) });
      page.drawRectangle({ x:ML, y:y-TK_R, width:W, height:0.3, color:r(...MID) });
      y -= TK_R;
    }
  }

  // Footer on last page
  page.drawRectangle({ x:ML, y:32, width:W, height:0.5, color:r(...MID) });
  page.drawText("Powered by Signal Strike  ·  HillTop Ave", { x:ML, y:20, font:fontR, size:7, color:r(...DIM) });
  page.drawText(exportDate, { x:PW-MR-fontR.widthOfTextAtSize(exportDate,7), y:20, font:fontR, size:7, color:r(...DIM) });

  return pdfDoc.save();
}

// ── CSV Builder ───────────────────────────────────────────────────────────────
function buildCSV(project: any, phases: any[], taskMap: Record<string,any[]>, dealTitle: string): string {
  const rows: string[][] = [
    ["Project", project.name],
    ...(dealTitle?[["Deal",dealTitle]]:[]),
    ["Exported", new Date().toLocaleDateString("en-US")],
    [],
    ["Phase","Task","Assignee","Start Date","End Date","Status","Notes"],
  ];
  for (const ph of phases) {
    rows.push([ph.name,"","",fmtDate(ph.start_date),fmtDate(ph.end_date),ST_LBL[ph.status]??ph.status,""]);
    for (const t of (taskMap[ph.id]||[])) {
      rows.push([ph.name,t.name,t.assignee??"",fmtDate(t.start_date),fmtDate(t.due_date),ST_LBL[t.status]??t.status,t.notes??""]);
    }
  }
  return rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { projectId, recipientEmail, recipientName } = await req.json();
    if (!projectId || !recipientEmail) {
      return NextResponse.json({ error:"Missing projectId or recipientEmail" }, { status:400 });
    }

    const { data: project } = await supabaseAdmin.from("projects").select("*").eq("id",projectId).single();
    if (!project) return NextResponse.json({ error:"Project not found" }, { status:404 });

    let dealTitle = "";
    if (project.deal_id) {
      const { data: deal } = await supabaseAdmin.from("deals").select("title").eq("id",project.deal_id).single();
      dealTitle = deal?.title ?? "";
    }

    const { data: phases } = await supabaseAdmin.from("project_phases").select("*").eq("project_id",projectId).order("sort_order").order("created_at");
    const phList = phases || [];
    const taskMap: Record<string,any[]> = {};
    if (phList.length) {
      const { data: tasks } = await supabaseAdmin.from("project_tasks").select("*").in("phase_id",phList.map((p:any)=>p.id)).order("sort_order").order("created_at");
      for (const t of (tasks||[])) { if (!taskMap[t.phase_id]) taskMap[t.phase_id]=[]; taskMap[t.phase_id].push(t); }
    }

    const pdfBytes = await buildPDF(project, phList, taskMap, dealTitle);
    const csvData  = buildCSV(project, phList, taskMap, dealTitle);
    const safeName = project.name.replace(/[^a-zA-Z0-9\s-]/g,"").trim().replace(/\s+/g,"-").slice(0,60);
    const esc      = (s:string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

    const { error: sendErr } = await resend.emails.send({
      from:    "Signal Strike <onboarding@resend.dev>",
      to:      recipientEmail,
      subject: `📋 Project Schedule — ${project.name}`,
      html: `<div style="background:#0a0a0b;color:#fafafa;font-family:Arial,sans-serif;padding:40px;max-width:600px;margin:0 auto;">
        <p style="color:#C9A84C;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Signal Strike · Project Export</p>
        <h1 style="font-size:20px;font-weight:800;margin:0 0 6px;">${esc(project.name)}</h1>
        ${dealTitle?`<p style="color:#C9A84C;font-size:13px;margin:0 0 20px;">${esc(dealTitle)}</p>`:`<p style="margin-bottom:20px;"></p>`}
        <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin-bottom:24px;">
          ${recipientName?`Hi ${esc(recipientName)},<br/><br/>`:""}Your project schedule is attached as a PDF and CSV.
        </p>
        <div style="background:#111113;border:1px solid #27272a;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
          <p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Attachments</p>
          <p style="color:#fafafa;font-size:13px;margin:0 0 4px;">📕 ${safeName}-schedule.pdf</p>
          <p style="color:#fafafa;font-size:13px;margin:0;">📊 ${safeName}-schedule.csv</p>
        </div>
        <p style="color:#3f3f46;font-size:11px;border-top:1px solid #1c1c1f;padding-top:16px;margin:0;">Powered by Signal Strike · HillTop Ave</p>
      </div>`,
      attachments: [
        { filename:`${safeName}-schedule.pdf`, content:Buffer.from(pdfBytes).toString("base64"), content_type:"application/pdf" },
        { filename:`${safeName}-schedule.csv`, content:Buffer.from(csvData).toString("base64"),  content_type:"text/csv" },
      ],
    });

    if (sendErr) return NextResponse.json({ error:sendErr.message }, { status:500 });
    return NextResponse.json({ ok:true });
  } catch (err:any) {
    console.error("[projects/export]", err);
    return NextResponse.json({ error:err?.message??"Export failed" }, { status:500 });
  }
}
