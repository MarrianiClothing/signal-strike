import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

// ── Helpers ───────────────────────────────────────────────────────────────────
type RGB3 = [number,number,number];
const GOLD  : RGB3 = [0.79,0.66,0.30];
const WHITE : RGB3 = [0.98,0.98,0.98];
const DARK  : RGB3 = [0.04,0.04,0.04];
const CARD  : RGB3 = [0.07,0.07,0.07];
const MID   : RGB3 = [0.11,0.11,0.12];
const DIM   : RGB3 = [0.32,0.32,0.36];
const BORDER: RGB3 = [0.15,0.15,0.17];
const GREEN : RGB3 = [0.20,0.83,0.60];
const RED   : RGB3 = [0.97,0.44,0.44];
const BLUE  : RGB3 = [0.38,0.65,0.98];

const STAGE_LABEL: Record<string,string> = {
  prospecting:"Prospecting", qualification:"Qualified", proposal:"Proposal",
  negotiation:"Negotiation", closed_won:"Won",          closed_lost:"Lost",
};
const STAGE_CLR: Record<string,RGB3> = {
  prospecting:[0.44,0.44,0.49], qualification:[0.38,0.65,0.98],
  proposal:   [0.65,0.55,0.98], negotiation:  [0.98,0.75,0.14],
  closed_won: [0.79,0.66,0.30], closed_lost:  [0.97,0.44,0.44],
};

function r(...c: RGB3) { return rgb(c[0],c[1],c[2]); }
function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n/1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return "$" + (n/1_000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}
function fmtDate(d: string|null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
}
function esc(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── PDF Builder ───────────────────────────────────────────────────────────────
async function buildDealPDF(deal: any, tier: any|null, activities: any[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(deal.title);
  pdfDoc.setAuthor("Signal Strike · HillTop Ave");

  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Letter portrait
  const page = pdfDoc.addPage([612, 792]);
  const PW = 612; const PH = 792;
  const ML = 40; const MR = 40; const W = PW - ML - MR;

  // Background
  page.drawRectangle({ x:0, y:0, width:PW, height:PH, color:r(...DARK) });

  const exportDate = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
  const stageClr   = STAGE_CLR[deal.stage] ?? DIM;
  const commission  = tier ? deal.value * (tier.rate / 100) : null;

  let y = PH - 40;

  // ── Header bar ──────────────────────────────────────────────────────────────
  page.drawRectangle({ x:0, y:PH-80, width:PW, height:80, color:r(...CARD) });
  page.drawRectangle({ x:0, y:PH-81, width:PW, height:1.5, color:r(...GOLD) });

  // Logo area
  page.drawText("SIGNAL STRIKE", { x:ML, y:PH-30, font:fontB, size:9, color:r(...GOLD), letterSpacing:2 });
  page.drawText("REVENUE CRM  ·  DEAL SUMMARY", { x:ML, y:PH-44, font:fontR, size:7, color:r(...DIM), letterSpacing:1 });
  page.drawText(exportDate, { x:ML, y:PH-58, font:fontR, size:7, color:r(...DIM) });

  // Value block (right side of header)
  const valStr = fmt(deal.value);
  const valW   = fontB.widthOfTextAtSize(valStr, 22);
  page.drawText(valStr, { x:PW-MR-valW, y:PH-36, font:fontB, size:22, color:r(...GOLD) });
  const stgLbl = STAGE_LABEL[deal.stage] ?? deal.stage;
  const stgW   = fontB.widthOfTextAtSize(stgLbl, 9);
  page.drawRectangle({ x:PW-MR-stgW-14, y:PH-58, width:stgW+14, height:14, color:r(...stageClr) });
  page.drawText(stgLbl, { x:PW-MR-stgW-7, y:PH-54, font:fontB, size:8, color:r(0,0,0) });

  y = PH - 100;

  // ── Deal title ──────────────────────────────────────────────────────────────
  const titleSize = deal.title.length > 55 ? 13 : deal.title.length > 38 ? 15 : 18;
  // Wrap title manually if long
  const titleWords = deal.title.split(" ");
  let line1 = ""; let line2 = "";
  for (const w of titleWords) {
    if (fontB.widthOfTextAtSize(line1 + w, titleSize) < W) line1 += (line1?" ":"") + w;
    else line2 += (line2?" ":"") + w;
  }
  page.drawText(line1, { x:ML, y, font:fontB, size:titleSize, color:r(...WHITE) });
  if (line2) { y -= titleSize + 4; page.drawText(line2, { x:ML, y, font:fontB, size:titleSize, color:r(...WHITE) }); }
  y -= 10;

  if (deal.company) {
    page.drawText(deal.company, { x:ML, y, font:fontR, size:11, color:r(...GOLD) });
    y -= 16;
  }

  // Divider
  page.drawRectangle({ x:ML, y, width:W, height:0.5, color:r(...BORDER) });
  y -= 20;

  // ── Two-column info grid ────────────────────────────────────────────────────
  const COL2 = W / 2 - 10;

  function drawField(label: string, value: string, fx: number, fy: number, valColor: RGB3 = WHITE) {
    page.drawText(label, { x:fx, y:fy+13, font:fontR, size:7, color:r(...DIM), letterSpacing:0.6 });
    page.drawText(value || "—", { x:fx, y:fy, font:fontB, size:9.5, color:r(...valColor) });
  }

  const col1x = ML;
  const col2x = ML + COL2 + 20;

  // Row 1
  drawField("CONTACT NAME",  deal.contact_name  || "—", col1x, y);
  drawField("CONTACT EMAIL", deal.contact_email || "—", col2x, y);
  y -= 36;

  // Row 2
  drawField("CONTACT PHONE", deal.contact_phone || "—", col1x, y);
  drawField("EXPECTED CLOSE DATE", fmtDate(deal.expected_close_date), col2x, y);
  y -= 36;

  // Row 3
  drawField("PROBABILITY", `${deal.probability ?? 0}%`, col1x, y);
  drawField("STAGE", STAGE_LABEL[deal.stage] ?? deal.stage, col2x, y, stageClr);
  y -= 36;

  // Commission block
  if (commission !== null && tier) {
    page.drawRectangle({ x:ML, y:y-2, width:W, height:32, color:r(0.05,0.10,0.07) });
    page.drawRectangle({ x:ML, y:y-2, width:3, height:32, color:r(...GREEN) });
    page.drawText("COMMISSION",   { x:ML+10, y:y+22, font:fontR, size:7, color:r(...DIM), letterSpacing:0.6 });
    page.drawText(fmt(commission), { x:ML+10, y:y+10, font:fontB, size:14, color:r(...GREEN) });
    const tierStr = `${tier.name}  ·  ${tier.rate}% of ${fmt(deal.value)}`;
    page.drawText(tierStr, { x:ML+10+fontB.widthOfTextAtSize(fmt(commission),14)+12, y:y+12, font:fontR, size:8, color:r(...DIM) });
    y -= 42;
  } else {
    y -= 8;
  }

  // Divider
  page.drawRectangle({ x:ML, y, width:W, height:0.5, color:r(...BORDER) });
  y -= 18;

  // ── Notes ───────────────────────────────────────────────────────────────────
  if (deal.notes?.trim()) {
    page.drawText("NOTES", { x:ML, y, font:fontB, size:7.5, color:r(...GOLD), letterSpacing:1 });
    y -= 14;
    page.drawRectangle({ x:ML, y:y-4, width:W, height:1, color:r(...BORDER) });

    // Word-wrap notes
    const words = deal.notes.trim().split(/\s+/);
    let noteLine = "";
    const noteLines: string[] = [];
    for (const w of words) {
      if (fontR.widthOfTextAtSize(noteLine + " " + w, 9) < W) noteLine += (noteLine?" ":"") + w;
      else { noteLines.push(noteLine); noteLine = w; }
    }
    if (noteLine) noteLines.push(noteLine);
    y -= 6;
    for (const nl of noteLines.slice(0, 6)) {
      y -= 13;
      page.drawText(nl, { x:ML, y, font:fontR, size:9, color:r(0.75,0.75,0.78) });
    }
    y -= 16;
  }

  // ── Next task ───────────────────────────────────────────────────────────────
  if (deal.next_task?.trim()) {
    page.drawRectangle({ x:ML, y:y-2, width:W, height:30, color:r(0.07,0.07,0.05) });
    page.drawRectangle({ x:ML, y:y-2, width:3, height:30, color:r(...GOLD) });
    page.drawText("NEXT TASK", { x:ML+10, y:y+22, font:fontB, size:7, color:r(...GOLD), letterSpacing:0.8 });
    page.drawText(deal.next_task.slice(0,90), { x:ML+10, y:y+10, font:fontR, size:9, color:r(...WHITE) });
    y -= 42;
  }

  // Divider
  page.drawRectangle({ x:ML, y, width:W, height:0.5, color:r(...BORDER) });
  y -= 18;

  // ── Activity log (all entries, with page breaks) ────────────────────────────
  if (activities.length > 0) {
    // Check if we need a new page before the section header
    if (y < 120) {
      const newPg = pdfDoc.addPage([612, 792]);
      newPg.drawRectangle({ x:0, y:0, width:PW, height:PH, color:r(...DARK) });
      // Return new page ref — we use a closure-style approach
      Object.assign(page, newPg); // reassign drawing context
      y = PH - 40;
    }

    page.drawText("ACTIVITY LOG", { x:ML, y, font:fontB, size:7.5, color:r(...GOLD), letterSpacing:1 });
    y -= 16;

    for (const act of activities) {
      // Page break if needed — add a new page
      if (y < 60) {
        const nextPage = pdfDoc.addPage([612, 792]);
        nextPage.drawRectangle({ x:0, y:0, width:PW, height:PH, color:r(...DARK) });
        // Draw footer on this continuation page
        nextPage.drawRectangle({ x:0, y:0, width:PW, height:36, color:r(...CARD) });
        nextPage.drawRectangle({ x:0, y:36, width:PW, height:0.5, color:r(...BORDER) });
        nextPage.drawText("Powered by Signal Strike  ·  HillTop Ave", { x:ML, y:14, font:fontR, size:7, color:r(...DIM) });
        nextPage.drawText("CONFIDENTIAL", { x:PW/2 - fontR.widthOfTextAtSize("CONFIDENTIAL",7)/2, y:14, font:fontB, size:7, color:r(...DIM), letterSpacing:1 });
        nextPage.drawText(exportDate, { x:PW-MR-fontR.widthOfTextAtSize(exportDate,7), y:14, font:fontR, size:7, color:r(...DIM) });
        // Continuation header
        nextPage.drawText(`ACTIVITY LOG (continued) — ${act ? (deal.title||"").slice(0,50) : ""}`, {
          x:ML, y:PH-30, font:fontB, size:8, color:r(...GOLD), letterSpacing:0.8,
        });
        // Use nextPage for subsequent draws by reassigning page drawing calls
        // We accomplish this by tracking currentPage
        y = PH - 52;
        // Draw remaining on nextPage
        for (const remAct of activities.slice(activities.indexOf(act))) {
          if (y < 60) break;
          const typeClr2: RGB3 = remAct.type === "email" ? BLUE : remAct.type === "call" ? GREEN : GOLD;
          const typeStr2 = (remAct.type || "note").toUpperCase();
          const tw2      = fontB.widthOfTextAtSize(typeStr2, 7);
          nextPage.drawRectangle({ x:ML, y:y-13, width:W, height:18, color:r(...CARD) });
          nextPage.drawRectangle({ x:ML+4, y:y-11, width:tw2+8, height:13, color:r(...typeClr2) });
          nextPage.drawText(typeStr2, { x:ML+8, y:y-9, font:fontB, size:7, color:r(0,0,0) });
          const title2 = (remAct.title || "").slice(0, 70);
          nextPage.drawText(title2, { x:ML+tw2+20, y:y-8, font:fontR, size:8.5, color:r(...WHITE) });
          if (remAct.occurred_at) {
            const ds2 = new Date(remAct.occurred_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
            nextPage.drawText(ds2, { x:PW-MR-fontR.widthOfTextAtSize(ds2,7), y:y-8, font:fontR, size:7, color:r(...DIM) });
          }
          if (remAct.body?.trim()) {
            const bodySnip = remAct.body.trim().slice(0,90);
            nextPage.drawText(bodySnip, { x:ML+tw2+20, y:y-19, font:fontR, size:7.5, color:r(...DIM) });
          }
          nextPage.drawRectangle({ x:ML, y:y-14, width:W, height:0.3, color:r(...MID) });
          y -= remAct.body?.trim() ? 32 : 22;
        }
        break; // handled remaining on nextPage
      }

      const typeClr: RGB3 = act.type === "email" ? BLUE : act.type === "call" ? GREEN : GOLD;
      const typeStr = (act.type || "note").toUpperCase();
      const tw      = fontB.widthOfTextAtSize(typeStr, 7);

      page.drawRectangle({ x:ML, y:y-13, width:W, height:18, color:r(...CARD) });
      page.drawRectangle({ x:ML+4, y:y-11, width:tw+8, height:13, color:r(...typeClr) });
      page.drawText(typeStr, { x:ML+8, y:y-9, font:fontB, size:7, color:r(0,0,0) });

      const title = (act.title || "").slice(0, 70);
      page.drawText(title, { x:ML+tw+20, y:y-8, font:fontR, size:8.5, color:r(...WHITE) });

      if (act.occurred_at) {
        const dateStr = new Date(act.occurred_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
        const dw      = fontR.widthOfTextAtSize(dateStr, 7);
        page.drawText(dateStr, { x:PW-MR-dw, y:y-8, font:fontR, size:7, color:r(...DIM) });
      }

      // Show body snippet if present
      if (act.body?.trim()) {
        const bodySnip = act.body.trim().slice(0, 90);
        page.drawText(bodySnip, { x:ML+tw+20, y:y-19, font:fontR, size:7.5, color:r(...DIM) });
      }

      page.drawRectangle({ x:ML, y:y-14, width:W, height:0.3, color:r(...MID) });
      y -= act.body?.trim() ? 32 : 22;
    }
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  page.drawRectangle({ x:0, y:0, width:PW, height:36, color:r(...CARD) });
  page.drawRectangle({ x:0, y:36, width:PW, height:0.5, color:r(...BORDER) });
  page.drawText("Powered by Signal Strike  ·  HillTop Ave", { x:ML, y:14, font:fontR, size:7, color:r(...DIM) });
  const confStr = "CONFIDENTIAL";
  page.drawText(confStr, { x:PW/2 - fontR.widthOfTextAtSize(confStr,7)/2, y:14, font:fontB, size:7, color:r(...DIM), letterSpacing:1 });
  page.drawText(exportDate, { x:PW-MR-fontR.widthOfTextAtSize(exportDate,7), y:14, font:fontR, size:7, color:r(...DIM) });

  return pdfDoc.save();
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { dealId, mode, recipientEmail, recipientName } = await req.json();
    if (!dealId || !mode) {
      return NextResponse.json({ error:"Missing dealId or mode" }, { status:400 });
    }

    // Load deal
    const { data: deal } = await supabaseAdmin.from("deals").select("*").eq("id",dealId).single();
    if (!deal) return NextResponse.json({ error:"Deal not found" }, { status:404 });

    // Load commission tier
    let tier = null;
    if (deal.commission_tier_id) {
      const { data: t } = await supabaseAdmin.from("commission_tiers").select("*").eq("id",deal.commission_tier_id).single();
      tier = t ?? null;
    }

    // Load recent activities
    const { data: activities } = await supabaseAdmin
      .from("activities").select("*").eq("deal_id",dealId)
      .order("occurred_at",{ascending:false});

    const pdfBytes = await buildDealPDF(deal, tier, activities || []);
    const safeName = deal.title.replace(/[^a-zA-Z0-9\s-]/g,"").trim().replace(/\s+/g,"-").slice(0,60);

    // ── Download mode — return raw PDF ────────────────────────────────────────
    if (mode === "download") {
      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type":        "application/pdf",
          "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        },
      });
    }

    // ── Email mode — send via Resend ──────────────────────────────────────────
    if (mode === "email") {
      if (!recipientEmail) return NextResponse.json({ error:"Missing recipientEmail" }, { status:400 });

      const { error: sendErr } = await resend.emails.send({
        from:    "Signal Strike <onboarding@resend.dev>",
        to:      recipientEmail,
        subject: `📄 Deal Summary — ${deal.title}`,
        html: `<div style="background:#0a0a0b;color:#fafafa;font-family:Arial,sans-serif;padding:40px;max-width:600px;margin:0 auto;">
          <p style="color:#C9A84C;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Signal Strike · Deal Export</p>
          <h1 style="font-size:18px;font-weight:800;margin:0 0 6px;">${esc(deal.title)}</h1>
          ${deal.company?`<p style="color:#C9A84C;font-size:13px;margin:0 0 20px;">${esc(deal.company)}</p>`:`<p style="margin-bottom:20px;"></p>`}
          <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin-bottom:24px;">
            ${recipientName?`Hi ${esc(recipientName)},<br/><br/>`:""}
            Please find the deal summary attached as a PDF.
          </p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:12px;width:40%;">Deal Value</td>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#C9A84C;font-size:14px;font-weight:700;">${esc(deal.value ? ("$"+(deal.value>=1000000?(deal.value/1000000).toFixed(2)+"M":(deal.value/1000).toFixed(1)+"K")) : "—")}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:12px;">Stage</td>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fafafa;font-size:13px;">${esc(STAGE_LABEL[deal.stage]??deal.stage)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:12px;">Expected Close</td>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fafafa;font-size:13px;">${esc(fmtDate(deal.expected_close_date))}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#71717a;font-size:12px;">Probability</td>
              <td style="padding:10px 0;color:#fafafa;font-size:13px;">${deal.probability??0}%</td>
            </tr>
          </table>
          <p style="color:#3f3f46;font-size:11px;border-top:1px solid #1c1c1f;padding-top:16px;margin:0;">Powered by Signal Strike · HillTop Ave</p>
        </div>`,
        attachments: [{
          filename:     `${safeName}.pdf`,
          content:      Buffer.from(pdfBytes).toString("base64"),
          content_type: "application/pdf",
        }],
      });

      if (sendErr) return NextResponse.json({ error:sendErr.message }, { status:500 });
      return NextResponse.json({ ok:true });
    }

    return NextResponse.json({ error:"Invalid mode" }, { status:400 });
  } catch (err:any) {
    console.error("[deals/export]", err);
    return NextResponse.json({ error:err?.message??"Export failed" }, { status:500 });
  }
}
