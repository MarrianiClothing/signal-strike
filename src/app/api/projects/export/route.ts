import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import PDFDocument from "pdfkit";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

// ── Helpers ───────────────────────────────────────────────────────────────────
const ST_LBL: Record<string,string> = {
  not_started:"Not Started", in_progress:"In Progress",
  completed:"Completed",     blocked:"Blocked",
};
const ST_CLR: Record<string,[number,number,number]> = {
  not_started:[82,82,91],  in_progress:[201,168,76],
  completed:  [52,211,153], blocked:   [248,113,113],
};
const PHASE_COLORS: [number,number,number][] = [
  [201,168,76],[96,165,250],[52,211,153],[167,139,250],[251,146,60],[248,113,113],
];

function hexToRgb(hex: string): [number,number,number] {
  const h = hex.replace("#","");
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function fmtDate(d: string|null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
}
function fmtDateShort(d: string|null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"});
}

// ── PDF Builder ───────────────────────────────────────────────────────────────
async function buildPDF(
  project: any,
  phases:  any[],
  taskMap: Record<string,any[]>,
  dealTitle: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER", layout: "landscape",
      margins: { top:40, bottom:40, left:40, right:40 },
      info: { Title: project.name, Author: "Signal Strike · HillTop Ave" },
    });

    const chunks: Buffer[] = [];
    doc.on("data",  c => chunks.push(c));
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W    = doc.page.width  - 80; // usable width (margins)
    const GOLD : [number,number,number] = [201,168,76];
    const DARK : [number,number,number] = [10,10,11];
    const CARD : [number,number,number] = [17,17,19];
    const MID  : [number,number,number] = [28,28,31];
    const DIM  : [number,number,number] = [82,82,91];
    const WHITE: [number,number,number] = [250,250,250];
    const GREEN: [number,number,number] = [52,211,153];
    const RED  : [number,number,number] = [248,113,113];

    const allTasks  = Object.values(taskMap).flat();
    const doneTasks = allTasks.filter((t:any) => t.status === "completed").length;
    const progPct   = allTasks.length ? Math.round(doneTasks / allTasks.length * 100) : 0;
    const exportDate = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});

    // ── Page background ───────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(DARK);

    let y = 40;
    const L = 40; // left margin

    // ── Header ────────────────────────────────────────────────────────────────
    doc.font("Helvetica").fontSize(9).fillColor(GOLD)
       .text("PROJECT SCHEDULE  ·  SIGNAL STRIKE", L, y, { characterSpacing: 1.5 });
    doc.font("Helvetica-Bold").fontSize(18).fillColor(WHITE)
       .text(project.name, L, y + 14);
    if (dealTitle) {
      doc.font("Helvetica").fontSize(11).fillColor(GOLD)
         .text(dealTitle, L, y + 36);
    }

    // Right side — progress + date
    doc.font("Helvetica").fontSize(9).fillColor(DIM)
       .text(`Exported ${exportDate}`, L, y, { align:"right", width:W });
    doc.font("Helvetica-Bold").fontSize(14)
       .fillColor(progPct===100 ? GREEN : GOLD)
       .text(`${progPct}% Complete`, L, y+14, { align:"right", width:W });
    doc.font("Helvetica").fontSize(9).fillColor(DIM)
       .text(`${doneTasks} of ${allTasks.length} tasks done`, L, y+30, { align:"right", width:W });

    y += dealTitle ? 62 : 48;

    // Progress bar
    doc.rect(L, y, W, 5).fill(MID);
    const barW = Math.round(W * progPct / 100);
    if (barW > 0) doc.rect(L, y, barW, 5).fill(progPct===100 ? GREEN : GOLD);
    y += 18;

    // Divider
    doc.rect(L, y, W, 0.5).fill([39,39,42]);
    y += 16;

    // ── Gantt Chart ───────────────────────────────────────────────────────────
    const datedPhases = phases.filter(p => p.start_date && p.end_date);
    if (datedPhases.length > 0) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(GOLD)
         .text("GANTT CHART", L, y, { characterSpacing: 1.2 });
      y += 16;

      const minTime = Math.min(...datedPhases.map((p:any) => new Date(p.start_date).getTime()));
      const maxTime = Math.max(...datedPhases.map((p:any) => new Date(p.end_date).getTime())) + 86400000;
      const totalMs = maxTime - minTime;
      const toPct   = (t: number) => Math.min(1, Math.max(0, (t - minTime) / totalMs));

      const LABEL_W  = 150;
      const GANTT_W  = W - LABEL_W - 8;
      const GANTT_X  = L + LABEL_W + 8;
      const PH_H     = 20;
      const TASK_H   = 14;
      const HDR_H    = 18;

      // Month headers
      doc.rect(GANTT_X, y, GANTT_W, HDR_H).fill([13,13,15]);
      let cur = new Date(minTime);
      cur = new Date(cur.getFullYear(), cur.getMonth(), 1);
      while (cur.getTime() < maxTime) {
        const next   = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        const s      = Math.max(cur.getTime(), minTime);
        const e      = Math.min(next.getTime(), maxTime);
        const lp     = toPct(s);
        const wp     = toPct(e) - lp;
        const mX     = GANTT_X + lp * GANTT_W;
        const mW     = wp * GANTT_W;
        const mLabel = cur.toLocaleString("en-US",{month:"short",year:"2-digit"});
        doc.rect(mX, y, mW, HDR_H).stroke([39,39,42]);
        if (mW > 20) {
          doc.font("Helvetica-Bold").fontSize(7).fillColor(DIM)
             .text(mLabel, mX+3, y+6, { width:mW-4, ellipsis:true });
        }
        cur = next;
      }

      // Label col header
      doc.rect(L, y, LABEL_W, HDR_H).fill([13,13,15]);
      doc.font("Helvetica-Bold").fontSize(7).fillColor(GOLD)
         .text("PHASE / TASK", L+6, y+6, { width:LABEL_W-8 });
      y += HDR_H;

      // Today line position
      const todayPct = toPct(Date.now());
      const todayX   = GANTT_X + todayPct * GANTT_W;

      // Phase + task rows
      for (let pi = 0; pi < phases.length; pi++) {
        const ph    = phases[pi];
        const phRgb = hexToRgb(ph.color || "#C9A84C");
        const tasks = taskMap[ph.id] || [];

        // Phase row bg
        doc.rect(L, y, LABEL_W + 8 + GANTT_W, PH_H).fill(CARD);

        // Phase color square + label
        doc.rect(L+6, y+6, 8, 8).fill(phRgb);
        doc.font("Helvetica-Bold").fontSize(8).fillColor(WHITE)
           .text(ph.name, L+18, y+7, { width:LABEL_W-22, ellipsis:true });

        // Phase bar
        if (ph.start_date && ph.end_date) {
          const bL = toPct(new Date(ph.start_date).getTime());
          const bR = toPct(new Date(ph.end_date).getTime() + 86400000);
          const bX = GANTT_X + bL * GANTT_W;
          const bW = Math.max((bR - bL) * GANTT_W, 3);
          doc.rect(bX, y+4, bW, 12).fill(phRgb);
          if (bW > 30) {
            doc.font("Helvetica-Bold").fontSize(6.5).fillColor([0,0,0])
               .text(ph.name, bX+3, y+7, { width:bW-4, ellipsis:true });
          }
        }

        // Row divider
        doc.rect(L, y+PH_H-0.5, LABEL_W+8+GANTT_W, 0.5).fill([28,28,31]);
        y += PH_H;

        // Task rows
        for (const t of tasks) {
          doc.rect(L, y, LABEL_W+8+GANTT_W, TASK_H).fill([24,24,27]);
          const tClr = ST_CLR[t.status] ?? DIM;
          doc.circle(L+10, y+7, 3).fill(tClr);
          const tColor = t.status === "completed" ? DIM : [161,161,170] as [number,number,number];
          doc.font("Helvetica").fontSize(7).fillColor(tColor)
             .text(t.name, L+18, y+4, { width:LABEL_W-20, ellipsis:true });

          if (t.start_date && t.due_date) {
            const bL = toPct(new Date(t.start_date).getTime());
            const bR = toPct(new Date(t.due_date).getTime() + 86400000);
            const bX = GANTT_X + bL * GANTT_W;
            const bW = Math.max((bR-bL)*GANTT_W, 2);
            doc.rect(bX, y+3, bW, 7).fill([phRgb[0],phRgb[1],phRgb[2],0.45] as any);
          } else if (t.due_date) {
            const mX = GANTT_X + toPct(new Date(t.due_date).getTime()) * GANTT_W;
            doc.polygon([mX,y+2],[mX+4,y+7],[mX,y+12],[mX-4,y+7]).fill(phRgb);
          }
          doc.rect(L, y+TASK_H-0.5, LABEL_W+8+GANTT_W, 0.5).fill([28,28,31]);
          y += TASK_H;
        }
      }

      // Today line (drawn on top)
      if (todayPct >= 0 && todayPct <= 1) {
        doc.rect(todayX, y - (HDR_H + phases.reduce((s,p)=>s+PH_H+(taskMap[p.id]||[]).length*TASK_H,0)), 1,
          HDR_H + phases.reduce((s,p)=>s+PH_H+(taskMap[p.id]||[]).length*TASK_H,0))
          .fillOpacity(0.5).fill(RED).fillOpacity(1);
      }

      y += 20;
    }

    // ── New page for list view if gantt took a lot of space ───────────────────
    if (y > doc.page.height - 200) {
      doc.addPage();
      doc.rect(0,0,doc.page.width,doc.page.height).fill(DARK);
      y = 40;
    }

    // ── List View ─────────────────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(9).fillColor(GOLD)
       .text("SCHEDULE — LIST VIEW", L, y, { characterSpacing: 1.2 });
    y += 16;

    // Table header
    const COL = { phase:200, start:90, end:90, status:90, progress:W-200-90-90-90 };
    const cols = [
      { label:"PHASE / TASK",   w:COL.phase,    x:L },
      { label:"START",          w:COL.start,    x:L+COL.phase },
      { label:"END / DUE",      w:COL.end,      x:L+COL.phase+COL.start },
      { label:"STATUS",         w:COL.status,   x:L+COL.phase+COL.start+COL.end },
      { label:"ASSIGNEE / NOTE",w:COL.progress, x:L+COL.phase+COL.start+COL.end+COL.status },
    ];

    // Header bg
    doc.rect(L, y, W, 18).fill([13,13,15]);
    for (const c of cols) {
      doc.font("Helvetica-Bold").fontSize(7).fillColor(GOLD)
         .text(c.label, c.x+4, y+6, { width:c.w-6, ellipsis:true, characterSpacing:0.8 });
    }
    // Gold underline
    doc.rect(L, y+17, W, 0.5).fill(GOLD);
    y += 19;

    const PH_ROW = 18;
    const TK_ROW = 14;

    for (const ph of phases) {
      if (y > doc.page.height - 60) {
        doc.addPage();
        doc.rect(0,0,doc.page.width,doc.page.height).fill(DARK);
        y = 40;
      }

      const phRgb  = hexToRgb(ph.color || "#C9A84C");
      const tasks  = taskMap[ph.id] || [];
      const doneC  = tasks.filter((t:any) => t.status==="completed").length;
      const stClr  = ST_CLR[ph.status] ?? DIM;

      // Phase row
      doc.rect(L, y, W, PH_ROW).fill(CARD);
      doc.rect(L+COL.phase, y, W-COL.phase, PH_ROW).fill(CARD);

      // Color swatch
      doc.rect(L+4, y+5, 8, 8).fill(phRgb);
      // Phase name
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(WHITE)
         .text(ph.name, L+16, y+5, { width:COL.phase-20, ellipsis:true });
      // Dates
      doc.font("Helvetica").fontSize(8).fillColor(DIM)
         .text(fmtDate(ph.start_date), cols[1].x+4, y+5, { width:COL.start-6 })
         .text(fmtDate(ph.end_date),   cols[2].x+4, y+5, { width:COL.end-6   });
      // Status badge
      doc.rect(cols[3].x+4, y+4, 76, 11).fill([stClr[0],stClr[1],stClr[2]]);
      doc.font("Helvetica-Bold").fontSize(7).fillColor(DARK)
         .text(ST_LBL[ph.status]??ph.status, cols[3].x+7, y+6, { width:70 });
      // Task count
      doc.font("Helvetica").fontSize(8).fillColor(DIM)
         .text(`${doneC}/${tasks.length} tasks`, cols[4].x+4, y+5, { width:COL.progress-8 });

      doc.rect(L, y+PH_ROW-0.5, W, 0.5).fill(MID);
      y += PH_ROW;

      // Tasks
      for (const t of tasks) {
        if (y > doc.page.height - 40) {
          doc.addPage();
          doc.rect(0,0,doc.page.width,doc.page.height).fill(DARK);
          y = 40;
        }

        const tStClr = ST_CLR[t.status] ?? DIM;
        const tFill  = t.status === "completed" ? DIM : ([161,161,170] as [number,number,number]);

        doc.rect(L, y, W, TK_ROW).fill([24,24,27]);
        doc.circle(L+14, y+7, 2.5).fill(tStClr);
        doc.font(t.status==="completed"?"Helvetica":"Helvetica").fontSize(8)
           .fillColor(tFill)
           .text(t.name, L+22, y+3, { width:COL.phase-26, ellipsis:true });
        doc.font("Helvetica").fontSize(7.5).fillColor(DIM)
           .text(fmtDate(t.start_date), cols[1].x+4, y+3, { width:COL.start-6 })
           .text(fmtDate(t.due_date),   cols[2].x+4, y+3, { width:COL.end-6   });
        // Mini status
        doc.font("Helvetica").fontSize(7).fillColor(tStClr)
           .text(ST_LBL[t.status]??t.status, cols[3].x+4, y+3, { width:COL.status-6 });
        // Assignee / notes
        const meta = [t.assignee, t.notes?.slice(0,30)].filter(Boolean).join(" · ");
        doc.font("Helvetica").fontSize(7).fillColor([63,63,70] as any)
           .text(meta||"—", cols[4].x+4, y+3, { width:COL.progress-8, ellipsis:true });

        doc.rect(L, y+TK_ROW-0.5, W, 0.5).fill([28,28,31]);
        y += TK_ROW;
      }
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 32;
    doc.rect(L, footerY-8, W, 0.5).fill([28,28,31]);
    doc.font("Helvetica").fontSize(8).fillColor(DIM)
       .text("Powered by Signal Strike  ·  HillTop Ave", L, footerY, { width:W/2 })
       .text(exportDate, L, footerY, { width:W, align:"right" });

    doc.end();
  });
}

// ── CSV Builder ───────────────────────────────────────────────────────────────
function buildCSV(project: any, phases: any[], taskMap: Record<string,any[]>, dealTitle: string): string {
  const meta = [
    ["Project", project.name],
    ...(dealTitle ? [["Deal", dealTitle]] : []),
    ["Exported", new Date().toLocaleDateString("en-US")],
    [],
    ["Phase","Task","Assignee","Start Date","End Date","Status","Notes"],
  ];
  const dataRows: string[][] = [];
  for (const ph of phases) {
    dataRows.push([ph.name,"","",fmtDate(ph.start_date),fmtDate(ph.end_date),ST_LBL[ph.status]??ph.status,""]);
    for (const t of (taskMap[ph.id]||[])) {
      dataRows.push([ph.name,t.name,t.assignee??"",fmtDate(t.start_date),fmtDate(t.due_date),ST_LBL[t.status]??t.status,t.notes??""]);
    }
  }
  return [...meta,...dataRows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { projectId, recipientEmail, recipientName } = await req.json();
    if (!projectId || !recipientEmail) {
      return NextResponse.json({ error: "Missing projectId or recipientEmail" }, { status:400 });
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

    const pdfBuffer = await buildPDF(project, phList, taskMap, dealTitle);
    const csvData   = buildCSV(project, phList, taskMap, dealTitle);
    const safeName  = project.name.replace(/[^a-zA-Z0-9\s-]/g,"").trim().replace(/\s+/g,"-").slice(0,60);

    const escXML = (s:string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

    const { error: sendErr } = await resend.emails.send({
      from:    "Signal Strike <onboarding@resend.dev>",
      to:      recipientEmail,
      subject: `📋 Project Schedule — ${project.name}`,
      html: `<div style="background:#0a0a0b;color:#fafafa;font-family:Arial,sans-serif;padding:40px;max-width:600px;margin:0 auto;">
        <p style="color:#C9A84C;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Signal Strike · Project Export</p>
        <h1 style="font-size:20px;font-weight:800;margin:0 0 6px;">${escXML(project.name)}</h1>
        ${dealTitle?`<p style="color:#C9A84C;font-size:13px;margin:0 0 20px;">${escXML(dealTitle)}</p>`:`<p style="margin-bottom:20px;"></p>`}
        <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin-bottom:24px;">
          ${recipientName?`Hi ${escXML(recipientName)},<br/><br/>`:""}
          Your project schedule is attached as a PDF (with Gantt chart + list view) and CSV.
        </p>
        <div style="background:#111113;border:1px solid #27272a;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
          <p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Attachments</p>
          <p style="color:#fafafa;font-size:13px;margin:0 0 4px;">📕 ${safeName}-schedule.pdf</p>
          <p style="color:#fafafa;font-size:13px;margin:0;">📊 ${safeName}-schedule.csv</p>
        </div>
        <p style="color:#3f3f46;font-size:11px;border-top:1px solid #1c1c1f;padding-top:16px;margin:0;">Powered by Signal Strike · HillTop Ave</p>
      </div>`,
      attachments: [
        { filename:`${safeName}-schedule.pdf`, content:pdfBuffer.toString("base64"), content_type:"application/pdf" },
        { filename:`${safeName}-schedule.csv`, content:Buffer.from(csvData).toString("base64"), content_type:"text/csv" },
      ],
    });

    if (sendErr) return NextResponse.json({ error: sendErr.message }, { status:500 });
    return NextResponse.json({ ok:true });
  } catch (err:any) {
    console.error("[projects/export]", err);
    return NextResponse.json({ error: err?.message ?? "Export failed" }, { status:500 });
  }
}
