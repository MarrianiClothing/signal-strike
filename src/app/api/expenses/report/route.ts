import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toFixed(2);
}

const CATEGORIES = ["Travel", "Meals & Entertainment", "Marketing", "Client Expenses"];
const CAT_RGB: Record<string, [number,number,number]> = {
  "Travel":               [0.79, 0.66, 0.30],
  "Meals & Entertainment":[0.20, 0.83, 0.60],
  "Marketing":            [0.65, 0.54, 0.98],
  "Client Expenses":      [0.38, 0.64, 0.98],
};
const STATUS_RGB: Record<string, [number,number,number]> = {
  "Pending":    [0.98, 0.75, 0.14],
  "Submitted":  [0.38, 0.64, 0.98],
  "Approved":   [0.20, 0.83, 0.60],
  "Reimbursed": [0.79, 0.66, 0.30],
};

async function buildExpenseReportPDF(
  expenses: any[],
  deal: any | null,
  reportTitle: string,
  userName: string
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg  = await doc.embedFont(StandardFonts.Helvetica);

  const GOLD   = rgb(0.79, 0.66, 0.30);
  const GREEN  = rgb(0.20, 0.83, 0.60);
  const WHITE  = rgb(0.98, 0.98, 0.98);
  const MUTED  = rgb(0.44, 0.44, 0.48);
  const DARK   = rgb(0.07, 0.07, 0.08);
  const CARD   = rgb(0.10, 0.10, 0.11);
  const BORDER = rgb(0.15, 0.15, 0.16);
  const BG     = rgb(0.035, 0.035, 0.04);

  const PW = 612, PH = 792, M = 48;
  let page = doc.addPage([PW, PH]);
  let y = 0;

  const newPage = () => {
    page = doc.addPage([PW, PH]);
    y = 60;
    // Repeat column headers
    drawTableHeader();
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > PH - 40) newPage();
  };

  const fillRect = (x: number, ty: number, w: number, h: number, color: any) =>
    page.drawRectangle({ x, y: PH - ty - h, width: w, height: h, color });

  const strokeRect = (x: number, ty: number, w: number, h: number, color: any) =>
    page.drawRectangle({ x, y: PH - ty - h, width: w, height: h, borderColor: color, borderWidth: 0.5, opacity: 0 });

  const drawText = (text: string, x: number, ty: number, opts: any = {}) =>
    page.drawText(String(text), {
      x, y: PH - ty - (opts.size || 10),
      font: opts.bold ? fontBold : fontReg,
      size: opts.size || 10,
      color: opts.color || WHITE,
    });

  const hline = (ty: number, x1 = M, x2 = PW - M) =>
    page.drawLine({ start: { x: x1, y: PH - ty }, end: { x: x2, y: PH - ty }, thickness: 0.5, color: BORDER });

  const clamp = (text: string, font: any, size: number, maxW: number): string => {
    let t = String(text);
    while (t.length > 0 && font.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -1);
    return t.length < String(text).length ? t.slice(0, -1) + "…" : t;
  };

  // ── HEADER ─────────────────────────────────────────────────────────────────
  fillRect(0, 0, PW, 88, DARK);

  // Branding
  drawText("HILLTOP AVE  ·  SIGNAL STRIKE", M, 14, { font: fontBold, size: 8, color: GOLD, bold: true });
  drawText("Expense Report", M, 28, { font: fontBold, size: 26, color: WHITE, bold: true });
  drawText(reportTitle, M, 62, { font: fontReg, size: 11, color: MUTED });

  // Prepared by / date
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const prepStr = `Prepared by ${userName}  ·  ${dateStr}`;
  const prepW = fontReg.widthOfTextAtSize(prepStr, 9);
  drawText(prepStr, PW - M - prepW, 62, { font: fontReg, size: 9, color: MUTED });

  y = 96;

  // ── DEAL SUMMARY (if deal-filtered) ────────────────────────────────────────
  if (deal) {
    fillRect(M, y, PW - M * 2, 56, CARD);
    strokeRect(M, y, PW - M * 2, 56, BORDER);
    drawText("DEAL SUMMARY", M + 12, y + 10, { font: fontBold, size: 7.5, color: MUTED, bold: true });
    drawText(clamp(deal.title || "", fontBold, 13, 300), M + 12, y + 22, { font: fontBold, size: 13, color: WHITE, bold: true });
    if (deal.company) drawText(deal.company, M + 12, y + 38, { font: fontReg, size: 9, color: MUTED });
    if (deal.value) {
      const valStr = "Deal Value: " + fmt(deal.value);
      const vw = fontBold.widthOfTextAtSize(valStr, 10);
      drawText(valStr, PW - M - vw - 12, y + 22, { font: fontBold, size: 10, color: GOLD, bold: true });
    }
    if (deal.stage) {
      const stageTxt = deal.stage.replace("_", " ").toUpperCase();
      const sw = fontBold.widthOfTextAtSize(stageTxt, 8);
      drawText(stageTxt, PW - M - sw - 12, y + 38, { font: fontBold, size: 8, color: MUTED, bold: true });
    }
    y += 56 + 16;
  }

  // ── SUMMARY STATS ──────────────────────────────────────────────────────────
  const totalAmt = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const statW = (PW - M * 2) / 3;
  const statH = 52;
  const stats = [
    { label: "TOTAL EXPENSES", value: fmt(totalAmt), color: WHITE },
    { label: "TOTAL ITEMS",    value: String(expenses.length), color: GOLD },
    { label: "AVG PER ITEM",   value: expenses.length ? fmt(totalAmt / expenses.length) : "$0.00", color: GREEN },
  ];
  stats.forEach((st, i) => {
    const sx = M + i * statW;
    fillRect(sx, y, statW, statH, CARD);
    strokeRect(sx, y, statW, statH, BORDER);
    const lw = fontBold.widthOfTextAtSize(st.label, 7.5);
    drawText(st.label, sx + statW / 2 - lw / 2, y + 10, { font: fontBold, size: 7.5, color: MUTED, bold: true });
    const vw2 = fontBold.widthOfTextAtSize(st.value, 18);
    drawText(st.value, sx + statW / 2 - vw2 / 2, y + 22, { font: fontBold, size: 18, color: st.color, bold: true });
  });
  y += statH + 18;

  // ── CATEGORY SUBTOTALS ──────────────────────────────────────────────────────
  const catTotals = CATEGORIES.map(cat => ({
    cat,
    amt: expenses.filter(e => e.category === cat).reduce((s, e) => s + (e.amount || 0), 0),
    count: expenses.filter(e => e.category === cat).length,
    color: CAT_RGB[cat] || [0.44, 0.44, 0.48],
  })).filter(c => c.count > 0);

  if (catTotals.length > 0) {
    drawText("CATEGORY BREAKDOWN", M, y, { font: fontBold, size: 8, color: MUTED, bold: true });
    y += 10;
    hline(y);
    y += 10;

    const colW = (PW - M * 2) / Math.min(catTotals.length, 4);
    catTotals.forEach((ct, i) => {
      const sx = M + i * colW;
      const catRgb = ct.color as [number, number, number];
      fillRect(sx, y, colW - 4, 46, CARD);
      page.drawRectangle({ x: sx, y: PH - y - 46, width: 3, height: 46, color: rgb(...catRgb) });
      const lw2 = fontBold.widthOfTextAtSize(ct.cat, 7);
      drawText(clamp(ct.cat, fontBold, 7, colW - 20), sx + 10, y + 10, { font: fontBold, size: 7, color: MUTED, bold: true });
      drawText(fmt(ct.amt), sx + 10, y + 22, { font: fontBold, size: 13, color: rgb(...catRgb), bold: true });
      drawText(`${ct.count} item${ct.count !== 1 ? "s" : ""}`, sx + 10, y + 38, { font: fontReg, size: 8, color: MUTED });
    });
    y += 46 + 18;
  }

  // ── EXPENSE TABLE ──────────────────────────────────────────────────────────
  drawText("EXPENSE DETAILS", M, y, { font: fontBold, size: 8, color: MUTED, bold: true });
  y += 10;
  hline(y);
  y += 8;

  const COL = {
    date:     { x: M,       w: 64  },
    merchant: { x: M + 64,  w: 160 },
    category: { x: M + 224, w: 110 },
    status:   { x: M + 334, w: 80  },
    amount:   { x: M + 414, w: 100 },
  };

  function drawTableHeader() {
    fillRect(M, y, PW - M * 2, 20, rgb(0.08, 0.08, 0.09));
    const headers = [
      { label: "DATE",     x: COL.date.x + 4 },
      { label: "MERCHANT", x: COL.merchant.x + 4 },
      { label: "CATEGORY", x: COL.category.x + 4 },
      { label: "STATUS",   x: COL.status.x + 4 },
      { label: "AMOUNT",   x: COL.amount.x + COL.amount.w - fontBold.widthOfTextAtSize("AMOUNT", 7.5) - 4 },
    ];
    headers.forEach(h => drawText(h.label, h.x, y + 6, { font: fontBold, size: 7.5, color: MUTED, bold: true }));
    y += 20;
  }

  drawTableHeader();

  expenses.forEach((exp, idx) => {
    const hasExtra = !!(exp.notes || exp.receipt_url);
    const rowH = hasExtra ? 46 : 28;
    ensureSpace(rowH + 2);

    const rowBg = idx % 2 === 0 ? rgb(0.09, 0.09, 0.10) : rgb(0.07, 0.07, 0.075);
    fillRect(M, y, PW - M * 2, rowH, rowBg);

    // Category color bar — full row height
    const catRgbRow = CAT_RGB[exp.category] || [0.44, 0.44, 0.48];
    page.drawRectangle({ x: M, y: PH - y - rowH, width: 3, height: rowH, color: rgb(...catRgbRow) });

    // Main data row — vertically centered in top portion
    const mainY = y + 9;

    const dateLabel = exp.expense_date
      ? new Date(exp.expense_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })
      : "—";
    drawText(dateLabel, COL.date.x + 6, mainY, { font: fontReg, size: 8.5, color: MUTED });
    drawText(clamp(exp.merchant || "—", fontBold, 9, COL.merchant.w - 8), COL.merchant.x + 4, mainY, { font: fontBold, size: 9, color: WHITE, bold: true });
    drawText(clamp(exp.category || "—", fontReg, 8.5, COL.category.w - 8), COL.category.x + 4, mainY, { font: fontReg, size: 8.5, color: MUTED });

    // Status badge color
    const stRgb = STATUS_RGB[exp.status] || [0.44, 0.44, 0.48];
    drawText(exp.status || "—", COL.status.x + 4, mainY, { font: fontBold, size: 8.5, color: rgb(...stRgb), bold: true });

    // Amount right-aligned
    const amtStr = fmt(exp.amount || 0);
    const amtW = fontBold.widthOfTextAtSize(amtStr, 10);
    drawText(amtStr, COL.amount.x + COL.amount.w - amtW - 4, mainY, { font: fontBold, size: 10, color: GOLD, bold: true });

    // Notes / receipt — clearly separated second line
    if (hasExtra) {
      // Hairline divider between main row and sub-line
      page.drawLine({
        start: { x: M + 6,     y: PH - (y + 28) },
        end:   { x: PW - M - 6, y: PH - (y + 28) },
        thickness: 0.3,
        color: rgb(0.20, 0.20, 0.21),
      });
      // Arrow indicator
      drawText("↳", COL.date.x + 6, y + 31, { font: fontReg, size: 8, color: rgb(0.32, 0.32, 0.34) });
      // Notes text
      if (exp.notes) {
        drawText(clamp(exp.notes, fontReg, 8, 200), COL.merchant.x + 4, y + 31, { font: fontReg, size: 8, color: rgb(0.55, 0.55, 0.58) });
      }
      // Receipt URL — right side, blue
      if (exp.receipt_url) {
        const shortUrl = exp.receipt_url.length > 52 ? exp.receipt_url.slice(0, 52) + "…" : exp.receipt_url;
        const receiptLabel = "Receipt: " + shortUrl;
        const rw = fontReg.widthOfTextAtSize(receiptLabel, 7.5);
        drawText(receiptLabel, COL.amount.x + COL.amount.w - rw - 4, y + 31, { font: fontReg, size: 7.5, color: rgb(0.38, 0.64, 0.98) });
      }
    }

    y += rowH + 2;
  });

  // ── TOTAL ROW ──────────────────────────────────────────────────────────────
  ensureSpace(30);
  hline(y + 2);
  fillRect(M, y + 4, PW - M * 2, 24, rgb(0.12, 0.10, 0.06));
  drawText("TOTAL", COL.merchant.x + 4, y + 10, { font: fontBold, size: 9, color: GOLD, bold: true });
  const totalW = fontBold.widthOfTextAtSize(fmt(totalAmt), 12);
  drawText(fmt(totalAmt), COL.amount.x + COL.amount.w - totalW - 4, y + 8, { font: fontBold, size: 12, color: GOLD, bold: true });
  y += 36;

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  ensureSpace(30);
  hline(y + 4);
  const footerTxt = "Signal Strike  ·  Revenue CRM  ·  Powered by Hilltop Ave";
  const footerW = fontReg.widthOfTextAtSize(footerTxt, 8);
  drawText(footerTxt, PW / 2 - footerW / 2, y + 12, { font: fontReg, size: 8, color: MUTED });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode    = searchParams.get("mode") || "download";
  const month   = searchParams.get("month");
  const dealId  = searchParams.get("deal_id");
  const email   = searchParams.get("email");

  try {
    // Get current user
    const authHeader = req.headers.get("cookie") || "";
    // Use service role to find user — in production this runs server-side with session
    // We'll query all profiles and rely on RLS via anon key for the client-side call
    // For server-side, use service role + validate via Supabase auth helper
    const { createClient: createServerClient } = await import("@supabase/supabase-js");
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Build expense query
    let expQuery = sb.from("expenses").select("*");
    let reportTitle = "All Expenses";
    let deal = null;

    if (month) {
      const start = month + "-01";
      const end   = new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 0).toISOString().slice(0, 10);
      expQuery = expQuery.gte("expense_date", start).lte("expense_date", end);
      reportTitle = new Date(start + "T12:00:00").toLocaleString("en-US", { month: "long", year: "numeric" }) + " — Expense Report";
    } else if (dealId) {
      expQuery = expQuery.eq("deal_id", dealId);
      const { data: dealData } = await sb.from("deals").select("*").eq("id", dealId).single();
      deal = dealData;
      reportTitle = `${deal?.title || "Deal"} — Expense Report`;
    }

    expQuery = expQuery.order("expense_date", { ascending: true });
    const { data: expenses, error } = await expQuery;
    if (error) throw error;

    // Get user name from first expense user_id
    let userName = "Signal Strike";
    if (expenses && expenses.length > 0) {
      const { data: profile } = await sb.from("profiles").select("full_name").eq("id", expenses[0].user_id).single();
      if (profile?.full_name) userName = profile.full_name;
    }

    const pdfBuffer = await buildExpenseReportPDF(expenses || [], deal, reportTitle, userName);
    const dateSlug  = month || (deal ? deal.title?.replace(/\s+/g, "-").slice(0, 20) : "report");
    const filename  = `Expense-Report-${dateSlug}.pdf`;

    if (mode === "email" && email) {
      const dateLabel = month
        ? new Date(month + "-01T12:00:00").toLocaleString("en-US", { month: "long", year: "numeric" })
        : deal?.title || "Deal";

      await resend.emails.send({
        from:    "Signal Strike <onboarding@resend.dev>",
        to:      email,
        subject: `Expense Report · ${dateLabel}`,
        html: `
          <div style="background:#09090b;padding:32px;font-family:sans-serif;color:#fafafa;">
            <p style="color:#C9A84C;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 8px">Signal Strike · Hilltop Ave</p>
            <h1 style="font-size:24px;margin:0 0 8px;">Expense Report</h1>
            <p style="color:#71717a;margin:0 0 24px;">${reportTitle}</p>
            <p style="color:#a1a1aa;font-size:14px;">Please find your expense report attached as a PDF.</p>
            <p style="color:#52525b;font-size:12px;margin-top:32px;border-top:1px solid #27272a;padding-top:16px;">
              Signal Strike · Revenue CRM · Powered by Hilltop Ave
            </p>
          </div>
        `,
        attachments: [{
          filename,
          content: pdfBuffer.toString("base64"),
        }],
      });
      return NextResponse.json({ ok: true, sent_to: email });
    }

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("Expense report error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
