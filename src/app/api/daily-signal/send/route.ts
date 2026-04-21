import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
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
  return "$" + n.toFixed(0);
}

const STAGE_LABELS: Record<string, string> = {
  prospecting: "Prospecting", qualification: "Qualified",
  proposal: "Proposal", negotiation: "Negotiation",
  closed_won: "Won", closed_lost: "Lost",
};

const STAGE_COLORS: Record<string, string> = {
  prospecting: "#71717a", qualification: "#60a5fa", proposal: "#a78bfa",
  negotiation: "#fbbf24", closed_won: "#C9A84C", closed_lost: "#f87171",
};


async function buildPDF(deals: any[], tiers: any[], today: string, teamReports: any[] = []): Promise<Buffer> {
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  const tiersMap: Record<string, any> = {};
  for (const t of tiers) tiersMap[t.id] = t;
  const activeDeals = deals.filter(d => d.stage !== "closed_lost");
  const totalValue  = activeDeals.reduce((s, d) => s + (d.value || 0), 0);
  const totalComm   = activeDeals.reduce((s, d) => {
    const tier = d.commission_tier_id ? tiersMap[d.commission_tier_id] : null;
    return s + (tier ? (d.value || 0) * (tier.rate / 100) : 0);
  }, 0);

  const STAGE_LABELS: Record<string, string> = {
    prospecting: "Prospecting", qualification: "Qualified",
    proposal: "Proposal", negotiation: "Negotiation",
    closed_won: "Won", closed_lost: "Lost",
  };
  // rgb values 0-1
  const STAGE_RGB: Record<string, [number,number,number]> = {
    prospecting:   [0.44, 0.44, 0.48],
    qualification: [0.38, 0.64, 0.98],
    proposal:      [0.65, 0.54, 0.98],
    negotiation:   [0.98, 0.75, 0.14],
    closed_won:    [0.79, 0.66, 0.30],
    closed_lost:   [0.97, 0.53, 0.44],
  };

  const doc = await PDFDocument.create();

  // Embed standard fonts
  const fontBold   = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg    = await doc.embedFont(StandardFonts.Helvetica);

  // Color helpers
  const GOLD  = rgb(0.79, 0.66, 0.30);
  const GREEN = rgb(0.20, 0.83, 0.60);
  const WHITE = rgb(0.98, 0.98, 0.98);
  const MUTED = rgb(0.44, 0.44, 0.48);
  const DARK  = rgb(0.07, 0.07, 0.08);
  const CARD  = rgb(0.10, 0.10, 0.11);
  const BORDER = rgb(0.15, 0.15, 0.16);
  const BG    = rgb(0.035, 0.035, 0.04);

  const PW = 612; // Letter width
  const PH = 792; // Letter height
  const M  = 50;  // Margin

  // ── helpers ────────────────────────────────────────────────────────────────
  const clampText = (text: string, font: any, size: number, maxW: number): string => {
    let t = text;
    while (t.length > 0 && font.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -1);
    return t.length < text.length ? t.slice(0, -1) + "…" : t;
  };

  let page = doc.addPage([PW, PH]);
  let y = PH; // top of page, we draw downward (pdf-lib Y is from bottom)

  const newPage = () => {
    page = doc.addPage([PW, PH]);
    y = M;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > PH - 40) newPage();
  };

  // Draw filled rect (coords: top-left x,y, w, h — converted to pdf-lib bottom-left)
  const fillRect = (x: number, ty: number, w: number, h: number, color: any) => {
    page.drawRectangle({ x, y: PH - ty - h, width: w, height: h, color });
  };

  const strokeRect = (x: number, ty: number, w: number, h: number, color: any) => {
    page.drawRectangle({ x, y: PH - ty - h, width: w, height: h, borderColor: color, borderWidth: 0.5, opacity: 0 });
  };

  const drawText = (text: string, x: number, ty: number, opts: any = {}) => {
    page.drawText(text, {
      x, y: PH - ty - (opts.size || 10),
      font: opts.bold ? fontBold : fontReg,
      size: opts.size || 10,
      color: opts.color || WHITE,
      ...opts,
    });
  };

  const hline = (ty: number, x1 = M, x2 = PW - M) => {
    page.drawLine({ start: { x: x1, y: PH - ty }, end: { x: x2, y: PH - ty }, thickness: 0.5, color: BORDER });
  };

  // ── HEADER ─────────────────────────────────────────────────────────────────
  fillRect(0, 0, PW, 82, DARK);
  drawText("SIGNAL STRIKE  -  REVENUE CRM", M, 16, { font: fontBold, size: 9, color: GOLD, bold: true });
  drawText("Daily Signal", M, 30, { font: fontBold, size: 26, color: WHITE, bold: true });
  drawText(today, M, 62, { font: fontReg, size: 11, color: MUTED });
  y = 90;

  // ── SUMMARY STATS ──────────────────────────────────────────────────────────
  const statW = (PW - M * 2) / 3;
  const statData = [
    { label: "ACTIVE DEALS",    value: String(activeDeals.length), color: WHITE },
    { label: "PIPELINE VALUE",  value: fmt(totalValue),             color: GOLD  },
    { label: "TOTAL COMMISSION",value: fmt(totalComm),              color: GREEN },
  ];
  const statH = 58;
  statData.forEach((st, i) => {
    const sx = M + i * statW;
    fillRect(sx, y, statW, statH, CARD);
    strokeRect(sx, y, statW, statH, BORDER);
    // label
    const lx = sx + statW / 2 - fontBold.widthOfTextAtSize(st.label, 7.5) / 2;
    drawText(st.label, lx, y + 12, { font: fontBold, size: 7.5, color: MUTED, bold: true });
    // value
    const valSize = 20;
    const vx = sx + statW / 2 - (st.color === WHITE ? fontBold : fontBold).widthOfTextAtSize(st.value, valSize) / 2;
    drawText(st.value, vx, y + 26, { font: fontBold, size: valSize, color: st.color, bold: true });
  });
  y += statH + 18;

  // ── SECTION LABEL ──────────────────────────────────────────────────────────
  drawText("YOUR DEALS", M, y, { font: fontBold, size: 8, color: MUTED, bold: true });
  y += 12;
  hline(y);
  y += 10;

  // ── DEAL CARDS ─────────────────────────────────────────────────────────────
  for (const d of activeDeals) {
    const tier       = d.commission_tier_id ? tiersMap[d.commission_tier_id] : null;
    const commission = tier ? (d.value || 0) * (tier.rate / 100) : null;
    const stageRgb   = STAGE_RGB[d.stage] || [0.44, 0.44, 0.48];
    const stageColor = rgb(stageRgb[0], stageRgb[1], stageRgb[2]);
    const stageLabel = (STAGE_LABELS[d.stage] || d.stage).toUpperCase();
    const closeDate  = d.expected_close_date
      ? new Date(d.expected_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : null;

    const cardH = 104 + (d.next_task ? 38 : 0);
    ensureSpace(cardH + 14);

    const cW = PW - M * 2;

    // Card bg + border
    fillRect(M, y, cW, cardH, CARD);
    strokeRect(M, y, cW, cardH, BORDER);
    // Stage bar
    fillRect(M, y, 5, cardH, stageColor);

    // Title
    const titleText = clampText(d.title || "", fontBold, 13, 280);
    drawText(titleText, M + 12, y + 12, { font: fontBold, size: 13, color: WHITE, bold: true });

    // Company
    const compText = clampText(d.company || "", fontReg, 9, 280);
    drawText(compText, M + 12, y + 28, { font: fontReg, size: 9, color: MUTED });

    // Value (right)
    const valStr = fmt(d.value || 0);
    const valW = fontBold.widthOfTextAtSize(valStr, 15);
    drawText(valStr, M + cW - valW - 10, y + 12, { font: fontBold, size: 15, color: GOLD, bold: true });

    // Stage badge
    const badgeW = fontBold.widthOfTextAtSize(stageLabel, 8);
    drawText(stageLabel, M + cW - badgeW - 10, y + 32, { font: fontBold, size: 8, color: stageColor, bold: true });

    // Divider
    hline(y + 50, M + 5, M + cW - 5);

    // Details
    let detY = y + 57;
    if (d.contact_name) {
      const ct = clampText(d.contact_name + (d.contact_email ? "  " + d.contact_email : ""), fontReg, 9, cW - 160);
      drawText(ct, M + 12, detY, { font: fontReg, size: 9, color: rgb(0.63, 0.63, 0.67) });
      detY += 13;
    }
    if (closeDate) {
      drawText("Close: " + closeDate, M + 12, detY, { font: fontReg, size: 9, color: MUTED });
    }

    // Commission (right)
    if (commission !== null) {
      const commStr = fmt(commission);
      const commW = fontBold.widthOfTextAtSize(commStr, 14);
      drawText("COMMISSION", M + cW - 120, y + 52, { font: fontBold, size: 7.5, color: MUTED, bold: true });
      drawText(commStr, M + cW - commW - 10, y + 63, { font: fontBold, size: 14, color: GREEN, bold: true });
      const tierLabel = tier.name + "  " + tier.rate + "%";
      const tierW = fontReg.widthOfTextAtSize(tierLabel, 8);
      drawText(tierLabel, M + cW - tierW - 10, y + 80, { font: fontReg, size: 8, color: MUTED });
    }

    // Next task
    if (d.next_task) {
      const taskY = y + cardH - 36;
      fillRect(M + 5, taskY - 6, cW - 10, 34, rgb(0.09, 0.08, 0.055));
      drawText(">> NEXT TASK", M + 12, taskY, { font: fontBold, size: 8, color: GOLD, bold: true });
      const taskText = clampText(d.next_task, fontReg, 10, cW - 30);
      drawText(taskText, M + 12, taskY + 14, { font: fontReg, size: 10, color: WHITE });
    }

    y += cardH + 12;
  }

  // ── TEAM SUMMARY (managers only) ───────────────────────────────────────────
  if (teamReports.length > 0) {
    ensureSpace(40 + teamReports.length * 28 + 40);
    y += 10;
    drawText("TEAM SUMMARY", M, y, { font: fontBold, size: 8, color: MUTED, bold: true });
    y += 12;
    hline(y);
    y += 10;

    // Header row
    const colW = (PW - M * 2) / 4;
    fillRect(M, y, PW - M * 2, 20, rgb(0.07, 0.07, 0.08));
    drawText("REP",      M + 8,           y + 6, { font: fontBold, size: 8, color: MUTED, bold: true });
    drawText("PIPELINE", M + colW * 1 + 8, y + 6, { font: fontBold, size: 8, color: MUTED, bold: true });
    drawText("WON",      M + colW * 2 + 8, y + 6, { font: fontBold, size: 8, color: MUTED, bold: true });
    drawText("OPEN",     M + colW * 3 + 8, y + 6, { font: fontBold, size: 8, color: MUTED, bold: true });
    y += 20;

    let teamPipeline = 0, teamWon = 0, teamOpen = 0;
    for (let i = 0; i < teamReports.length; i++) {
      const r = teamReports[i];
      teamPipeline += r.pipeline;
      teamWon      += r.won_revenue;
      teamOpen     += r.open_deals;
      const rowBg = i % 2 === 0 ? rgb(0.10, 0.10, 0.11) : rgb(0.09, 0.09, 0.10);
      fillRect(M, y, PW - M * 2, 24, rowBg);
      strokeRect(M, y, PW - M * 2, 24, BORDER);

      const nameText = r.full_name?.length > 28 ? r.full_name.slice(0, 26) + "…" : r.full_name;
      drawText(nameText,         M + 8,            y + 7, { font: fontBold, size: 9, color: WHITE, bold: true });
      drawText(fmt(r.pipeline),  M + colW * 1 + 8, y + 7, { font: fontBold, size: 9, color: rgb(0.65, 0.54, 0.98), bold: true });
      drawText(fmt(r.won_revenue), M + colW * 2 + 8, y + 7, { font: fontBold, size: 9, color: GOLD, bold: true });
      drawText(String(r.open_deals), M + colW * 3 + 8, y + 7, { font: fontBold, size: 9, color: rgb(0.38, 0.64, 0.98), bold: true });
      y += 24;
    }

    // Totals row
    fillRect(M, y, PW - M * 2, 26, rgb(0.05, 0.05, 0.06));
    strokeRect(M, y, PW - M * 2, 26, BORDER);
    drawText("TEAM TOTAL",     M + 8,            y + 8, { font: fontBold, size: 9, color: MUTED, bold: true });
    drawText(fmt(teamPipeline), M + colW * 1 + 8, y + 8, { font: fontBold, size: 10, color: rgb(0.65, 0.54, 0.98), bold: true });
    drawText(fmt(teamWon),      M + colW * 2 + 8, y + 8, { font: fontBold, size: 10, color: GOLD, bold: true });
    drawText(String(teamOpen),  M + colW * 3 + 8, y + 8, { font: fontBold, size: 10, color: rgb(0.38, 0.64, 0.98), bold: true });
    y += 30;
  }

  // ── TEAM DEALS (managers only) ──────────────────────────────────────────────
  if (teamReports.length > 0) {
    const allTeamDeals: Array<{ rep: string; deal: any }> = [];
    for (const r of teamReports) {
      for (const d of (r.deals || [])) {
        if (d.stage !== "closed_lost") allTeamDeals.push({ rep: r.full_name, deal: d });
      }
    }

    if (allTeamDeals.length > 0) {
      y += 10;
      drawText("TEAM DEALS", M, y, { font: fontBold, size: 8, color: MUTED, bold: true });
      y += 12;
      hline(y);
      y += 10;

      for (const { rep, deal: d } of allTeamDeals) {
        const stageRgb   = STAGE_RGB[d.stage] || [0.44, 0.44, 0.48];
        const stageColor = rgb(stageRgb[0], stageRgb[1], stageRgb[2]);
        const stageLabel = (STAGE_LABELS[d.stage] || d.stage).toUpperCase();
        const cardH = 80;
        ensureSpace(cardH + 12);

        const cW = PW - M * 2;
        fillRect(M, y, cW, cardH, CARD);
        strokeRect(M, y, cW, cardH, BORDER);
        fillRect(M, y, 5, cardH, stageColor);

        // Rep name tag
        drawText(rep.toUpperCase(), M + 12, y + 10, { font: fontBold, size: 7.5, color: GOLD, bold: true });

        // Title
        const titleText = clampText(d.title || "", fontBold, 12, 280);
        drawText(titleText, M + 12, y + 22, { font: fontBold, size: 12, color: WHITE, bold: true });

        // Company
        const compText = clampText(d.company || "", fontReg, 9, 280);
        drawText(compText, M + 12, y + 37, { font: fontReg, size: 9, color: MUTED });

        // Value
        const valStr = fmt(d.value || 0);
        const valW = fontBold.widthOfTextAtSize(valStr, 14);
        drawText(valStr, M + cW - valW - 10, y + 18, { font: fontBold, size: 14, color: GOLD, bold: true });

        // Stage badge
        const badgeW = fontBold.widthOfTextAtSize(stageLabel, 8);
        drawText(stageLabel, M + cW - badgeW - 10, y + 36, { font: fontBold, size: 8, color: stageColor, bold: true });

        // Close date
        if (d.expected_close_date) {
          const closeStr = "Close: " + new Date(d.expected_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          drawText(closeStr, M + 12, y + 55, { font: fontReg, size: 9, color: MUTED });
        }

        y += cardH + 10;
      }
    }
  }

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  ensureSpace(30);
  hline(y + 8);
  const footerText = "Signal Strike  ·  Revenue CRM  ·  Powered by Hilltop Ave";
  const footerW = fontReg.widthOfTextAtSize(footerText, 8);
  drawText(footerText, PW / 2 - footerW / 2, y + 16, { font: fontReg, size: 8, color: MUTED });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}



async function buildExcel(deals: any[], tiers: any[], today: string, teamReports: any[] = []): Promise<Buffer> {
  const tiersMap: Record<string, any> = {};
  for (const t of tiers) tiersMap[t.id] = t;

  const activeDeals = deals.filter(d => d.stage !== "closed_lost");
  const totalValue  = activeDeals.reduce((s, d) => s + (d.value || 0), 0);
  const totalComm   = activeDeals.reduce((s, d) => {
    const tier = d.commission_tier_id ? tiersMap[d.commission_tier_id] : null;
    return s + (tier ? (d.value || 0) * (tier.rate / 100) : 0);
  }, 0);

  const STAGE_LABELS: Record<string, string> = {
    prospecting: "Prospecting", qualification: "Qualified",
    proposal: "Proposal", negotiation: "Negotiation",
    closed_won: "Won", closed_lost: "Lost",
  };

  const fmtUSD = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Signal Strike";
  wb.created = new Date();

  // ── SUMMARY SHEET ─────────────────────────────────────────────────────────
  const ws = wb.addWorksheet("Summary");
  ws.columns = [{ width: 26 }, { width: 24 }, { width: 18 }];

  const titleRow = ws.addRow(["SIGNAL STRIKE — Daily Signal", "", ""]);
  titleRow.height = 26;
  titleRow.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
    cell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle" };
  });

  const dateRow = ws.addRow([today, "", ""]);
  dateRow.height = 18;
  dateRow.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
    cell.font = { size: 10, color: { argb: "FF71717A" } };
    cell.alignment = { vertical: "middle" };
  });

  ws.addRow([]);

  const summaryLabelRow = ws.addRow(["SUMMARY", "", ""]);
  summaryLabelRow.height = 20;
  summaryLabelRow.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle" };
  });

  const summaryData = [
    ["Active Deals",      activeDeals.length,        null],
    ["Pipeline Value",    fmtUSD(totalValue),         null],
    ["Total Commission",  fmtUSD(totalComm),          null],
    ["Tasks Pending",     activeDeals.filter((d: any) => d.next_task).length, null],
  ];
  for (const [label, value] of summaryData) {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { size: 10 };
    row.getCell(2).font = { bold: true, size: 11 };
  }

  // ── DEALS SHEET ───────────────────────────────────────────────────────────
  const ds = wb.addWorksheet("Deals");
  ds.columns = [
    { key: "title",         width: 30 },
    { key: "company",       width: 22 },
    { key: "contact_name",  width: 20 },
    { key: "contact_email", width: 28 },
    { key: "contact_phone", width: 16 },
    { key: "stage",         width: 14 },
    { key: "value",         width: 16 },
    { key: "probability",   width: 16 },
    { key: "commission",    width: 18 },
    { key: "tier_name",     width: 20 },
    { key: "tier_rate",     width: 18 },
    { key: "close_date",    width: 16 },
    { key: "next_task",     width: 40 },
    { key: "notes",         width: 40 },
  ];

  const headers = [
    "Deal Title", "Company", "Contact Name", "Contact Email", "Contact Phone",
    "Stage", "Value ($)", "Probability (%)", "Commission ($)", "Commission Tier",
    "Commission Rate (%)", "Expected Close", "Next Task", "Notes",
  ];

  const headerRow = ds.addRow(headers);
  headerRow.eachCell(cell => {
    cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
    cell.font   = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF333333" } },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
  headerRow.height = 22;

  for (const d of activeDeals) {
    const tier       = d.commission_tier_id ? tiersMap[d.commission_tier_id] : null;
    const commission = tier ? (d.value || 0) * (tier.rate / 100) : "";
    ds.addRow([
      d.title || "",
      d.company || "",
      d.contact_name || "",
      d.contact_email || "",
      d.contact_phone || "",
      STAGE_LABELS[d.stage] || d.stage || "",
      d.value ? fmtUSD(d.value) : "",
      d.probability || "",
      commission ? fmtUSD(commission as number) : "",
      tier ? tier.name : "",
      tier ? tier.rate + "%" : "",
      d.expected_close_date
        ? new Date(d.expected_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "",
      d.next_task || "",
      d.notes || "",
    ]);
  }

  // ── TEAM SUMMARY SHEET (managers only) ───────────────────────────────────
  if (teamReports.length > 0) {
    const ts = wb.addWorksheet("Team Summary");
    ts.columns = [{ width: 28 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 14 }];

    const tsTitleRow = ts.addRow(["SIGNAL STRIKE — Team Summary", "", "", "", ""]);
    tsTitleRow.height = 26;
    tsTitleRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
      cell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle" };
    });

    const tsDateRow = ts.addRow([today, "", "", "", ""]);
    tsDateRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
      cell.font = { size: 10, color: { argb: "FF71717A" } };
    });

    ts.addRow([]);

    const tsHeaderRow = ts.addRow(["Rep", "Pipeline", "Won Revenue", "Open Deals", "Total Deals"]);
    tsHeaderRow.height = 22;
    tsHeaderRow.eachCell(cell => {
      cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111113" } };
      cell.font   = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.border = { bottom: { style: "thin", color: { argb: "FF333333" } } };
      cell.alignment = { vertical: "middle" };
    });

    let totPipeline = 0, totWon = 0, totOpen = 0, totDeals = 0;
    for (const r of teamReports) {
      totPipeline += r.pipeline;
      totWon      += r.won_revenue;
      totOpen     += r.open_deals;
      totDeals    += r.total_deals;
      const row = ts.addRow([
        r.full_name,
        fmtUSD(r.pipeline),
        fmtUSD(r.won_revenue),
        r.open_deals,
        r.total_deals,
      ]);
      row.getCell(2).font = { color: { argb: "FFA78BFA" }, bold: true };
      row.getCell(3).font = { color: { argb: "FFC9A84C" }, bold: true };
    }

    ts.addRow([]);
    const totRow = ts.addRow(["TEAM TOTAL", fmtUSD(totPipeline), fmtUSD(totWon), totOpen, totDeals]);
    totRow.height = 22;
    totRow.eachCell((cell, col) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A0A0B" } };
      cell.font = { bold: true, size: 11, color: { argb: col === 2 ? "FFA78BFA" : col === 3 ? "FFC9A84C" : "FFFFFFFF" } };
      cell.border = { top: { style: "thin", color: { argb: "FF333333" } } };
    });
  }

  // ── TEAM DEALS SHEET (managers only) ────────────────────────────────────
  if (teamReports.length > 0) {
    const td = wb.addWorksheet("Team Deals");
    td.columns = [
      { key: "rep",          width: 22 },
      { key: "title",        width: 30 },
      { key: "company",      width: 22 },
      { key: "contact_name", width: 20 },
      { key: "stage",        width: 14 },
      { key: "value",        width: 16 },
      { key: "probability",  width: 14 },
      { key: "close_date",   width: 16 },
      { key: "notes",        width: 40 },
    ];

    const tdTitleRow = td.addRow(["SIGNAL STRIKE — Team Deals", "", "", "", "", "", "", "", ""]);
    tdTitleRow.height = 26;
    tdTitleRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
      cell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle" };
    });
    const tdDateRow = td.addRow([today, "", "", "", "", "", "", "", ""]);
    tdDateRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
      cell.font = { size: 10, color: { argb: "FF71717A" } };
    });
    td.addRow([]);

    const tdHeaders = ["Rep", "Deal Title", "Company", "Contact", "Stage", "Value ($)", "Probability (%)", "Expected Close", "Notes"];
    const tdHeaderRow = td.addRow(tdHeaders);
    tdHeaderRow.height = 22;
    tdHeaderRow.eachCell(cell => {
      cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111113" } };
      cell.font   = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.border = { bottom: { style: "thin", color: { argb: "FF333333" } } };
      cell.alignment = { vertical: "middle" };
    });

    const STAGE_LABELS_TD: Record<string, string> = {
      prospecting: "Prospecting", qualification: "Qualified", proposal: "Proposal",
      negotiation: "Negotiation", closed_won: "Won", closed_lost: "Lost",
    };

    for (const r of teamReports) {
      const repDeals = (r.deals || []).filter((d: any) => d.stage !== "closed_lost");
      for (const d of repDeals) {
        const row = td.addRow([
          r.full_name,
          d.title || "",
          d.company || "",
          d.contact_name || "",
          STAGE_LABELS_TD[d.stage] || d.stage || "",
          d.value ? fmtUSD(d.value) : "",
          d.probability ? d.probability + "%" : "",
          d.expected_close_date
            ? new Date(d.expected_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "",
          d.notes || "",
        ]);
        row.getCell(1).font = { bold: true, color: { argb: "FFC9A84C" } };
        row.getCell(6).font = { bold: true, color: { argb: "FFC9A84C" } };
      }
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}




async function getTeamReports(supabaseClient: any, manager_id: string): Promise<any[]> {
  const { data: reports } = await supabaseClient
    .from("profiles")
    .select("id, full_name")
    .eq("manager_id", manager_id);

  if (!reports?.length) return [];

  const enriched = await Promise.all(reports.map(async (r: any) => {
    const { data: deals } = await supabaseClient
      .from("deals").select("id,title,company,contact_name,value,stage,probability,expected_close_date,notes,updated_at").eq("user_id", r.id);
    const dealList  = deals || [];
    const open      = dealList.filter((d: any) => !["closed_won","closed_lost"].includes(d.stage));
    const won       = dealList.filter((d: any) => d.stage === "closed_won");
    return {
      full_name:   r.full_name ?? "Unnamed",
      open_deals:  open.length,
      total_deals: dealList.length,
      pipeline:    open.reduce((s: number, d: any) => s + (d.value || 0), 0),
      won_revenue: won.reduce((s: number, d: any) => s + (d.value || 0), 0),
      deals:       dealList,
    };
  }));
  return enriched;
}

function buildEmailHtml(userName: string, deals: any[], tiers: any[], teamReports: any[] = []) {
  const tiersMap: Record<string, any> = {};
  for (const t of tiers) tiersMap[t.id] = t;

  const activeDeals = deals.filter(d => d.stage !== "closed_lost");
  const totalValue  = activeDeals.reduce((s, d) => s + (d.value || 0), 0);
  const totalCommission = activeDeals.reduce((s, d) => {
    const tier = d.commission_tier_id ? tiersMap[d.commission_tier_id] : null;
    return s + (tier ? (d.value || 0) * (tier.rate / 100) : 0);
  }, 0);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const dealRows = activeDeals.map((d, i) => {
    const tier       = d.commission_tier_id ? tiersMap[d.commission_tier_id] : null;
    const commission = tier ? (d.value || 0) * (tier.rate / 100) : null;
    const stageColor = STAGE_COLORS[d.stage] || "#71717a";
    const stageLabel = STAGE_LABELS[d.stage] || d.stage;
    const closeDate  = d.expected_close_date
      ? new Date(d.expected_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : null;

    return `
      <!-- Deal Card -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border-radius:12px;overflow:hidden;border:1px solid #27272a;">
        <!-- Stage color bar + title row -->
        <tr>
          <td width="4" style="background:${stageColor};border-radius:12px 0 0 0;"></td>
          <td style="background:#1a1a1d;padding:16px 18px 12px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0 0 3px 0;font-size:17px;font-weight:700;color:#ffffff;line-height:1.3;">${d.title}</p>
                  <p style="margin:0;font-size:13px;color:#71717a;">${d.company || "&nbsp;"}</p>
                </td>
                <td align="right" valign="top" style="padding-left:12px;white-space:nowrap;">
                  <p style="margin:0 0 5px 0;font-size:20px;font-weight:800;color:#C9A84C;font-family:Georgia,serif;">${fmt(d.value || 0)}</p>
                  <span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${stageColor}30;color:${stageColor};letter-spacing:0.04em;">${stageLabel.toUpperCase()}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td colspan="2" style="height:1px;background:#27272a;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Details row -->
        <tr>
          <td width="4" style="background:${stageColor}40;"></td>
          <td style="background:#141416;padding:12px 18px 12px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <!-- Left: contact + close date -->
                <td valign="top" style="padding-right:12px;">
                  ${d.contact_name ? `
                  <p style="margin:0 0 5px 0;font-size:13px;color:#a1a1aa;">
                    <span style="color:#52525b;">&#128100;</span>&nbsp;
                    <strong style="color:#d4d4d8;">${d.contact_name}</strong>
                    ${d.contact_email ? `<br><span style="color:#52525b;font-size:12px;">${d.contact_email}</span>` : ""}
                  </p>` : ""}
                  ${closeDate ? `
                  <p style="margin:0;font-size:12px;color:#71717a;">
                    <span>&#128197;</span>&nbsp;Close: <strong style="color:#a1a1aa;">${closeDate}</strong>
                  </p>` : ""}
                </td>
                <!-- Right: commission -->
                ${commission !== null ? `
                <td align="right" valign="top" style="white-space:nowrap;">
                  <p style="margin:0 0 2px 0;font-size:11px;color:#52525b;text-transform:uppercase;letter-spacing:0.06em;">Commission</p>
                  <p style="margin:0 0 2px 0;font-size:18px;font-weight:800;color:#34d399;font-family:Georgia,serif;">${fmt(commission)}</p>
                  <p style="margin:0;font-size:11px;color:#52525b;">${tier.name} &middot; ${tier.rate}%</p>
                </td>` : "<td></td>"}
              </tr>
            </table>
          </td>
        </tr>

        ${d.next_task ? `
        <!-- Divider -->
        <tr><td colspan="2" style="height:1px;background:#27272a;font-size:0;line-height:0;">&nbsp;</td></tr>
        <!-- Next Task -->
        <tr>
          <td width="4" style="background:#C9A84C;border-radius:0 0 0 12px;"></td>
          <td style="background:#17150e;padding:11px 18px 11px 16px;border-radius:0 0 12px 0;">
            <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#C9A84C;text-transform:uppercase;letter-spacing:0.08em;">&#9889; Next Task</p>
            <p style="margin:0;font-size:14px;color:#fafafa;line-height:1.5;">${d.next_task}</p>
          </td>
        </tr>` : `
        <!-- No task -->
        <tr>
          <td width="4" style="background:#27272a;border-radius:0 0 0 12px;"></td>
          <td style="background:#111113;padding:9px 18px 9px 16px;border-radius:0 0 12px 0;">
            <p style="margin:0;font-size:12px;color:#3f3f46;font-style:italic;">No next task assigned</p>
          </td>
        </tr>`}
      </table>
    `;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Daily Signal</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;min-height:100vh;">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- ── HEADER ── -->
  <tr>
    <td align="center" style="padding-bottom:28px;">
      <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#C9A84C;text-transform:uppercase;letter-spacing:0.2em;">SIGNAL STRIKE</p>
      <h1 style="margin:0 0 6px 0;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Daily Signal</h1>
      <p style="margin:0;font-size:14px;color:#52525b;">${today}</p>
    </td>
  </tr>

  <!-- ── SUMMARY STATS ── -->
  <tr>
    <td style="padding-bottom:28px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid #27272a;">
        <tr>
          <td align="center" style="background:#111113;padding:20px 12px;border-right:1px solid #27272a;">
            <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;color:#52525b;text-transform:uppercase;letter-spacing:0.1em;">Active Deals</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;">${activeDeals.length}</p>
          </td>
          <td align="center" style="background:#111113;padding:20px 12px;border-right:1px solid #27272a;">
            <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;color:#52525b;text-transform:uppercase;letter-spacing:0.1em;">Pipeline Value</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#C9A84C;font-family:Georgia,serif;">${fmt(totalValue)}</p>
          </td>
          <td align="center" style="background:#111113;padding:20px 12px;border-right:1px solid #27272a;">
            <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;color:#52525b;text-transform:uppercase;letter-spacing:0.1em;">Total Commission</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#34d399;font-family:Georgia,serif;">${fmt(totalCommission)}</p>
          </td>
          <td align="center" style="background:#111113;padding:20px 12px;">
            <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;color:#52525b;text-transform:uppercase;letter-spacing:0.1em;">Tasks Pending</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;">${activeDeals.filter((d: any) => d.next_task).length}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── SECTION HEADER ── -->
  <tr>
    <td style="padding-bottom:12px;">
      <p style="margin:0;font-size:11px;font-weight:700;color:#52525b;text-transform:uppercase;letter-spacing:0.12em;">Your Deals</p>
    </td>
  </tr>

  <!-- ── DEAL CARDS ── -->
  <tr>
    <td>
      ${activeDeals.length === 0
        ? `<p style="color:#52525b;font-size:15px;padding:24px 0;">No active deals right now.</p>`
        : dealRows
      }
    </td>
  </tr>

  <!-- ── TEAM SUMMARY (managers only) ── -->
  ${teamReports.length > 0 ? `
  <tr>
    <td style="padding-bottom:12px;padding-top:8px;">
      <p style="margin:0 0 12px 0;font-size:11px;font-weight:700;color:#52525b;text-transform:uppercase;letter-spacing:0.12em;">Team Summary</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid #27272a;">
        <tr style="background:#0f0f10;">
          <td style="padding:10px 14px;font-size:11px;font-weight:700;color:#52525b;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #27272a;">Rep</td>
          <td style="padding:10px 14px;font-size:11px;font-weight:700;color:#52525b;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #27272a;" align="right">Pipeline</td>
          <td style="padding:10px 14px;font-size:11px;font-weight:700;color:#52525b;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #27272a;" align="right">Won</td>
          <td style="padding:10px 14px;font-size:11px;font-weight:700;color:#52525b;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #27272a;" align="right">Open</td>
        </tr>
        ${teamReports.map((r: any, i: number) => `
        <tr style="background:${i % 2 === 0 ? '#111113' : '#0f0f10'};">
          <td style="padding:12px 14px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#fafafa;">${r.full_name}</p>
          </td>
          <td style="padding:12px 14px;" align="right">
            <p style="margin:0;font-size:13px;font-weight:700;color:#a78bfa;font-family:Georgia,serif;">${fmt(r.pipeline)}</p>
          </td>
          <td style="padding:12px 14px;" align="right">
            <p style="margin:0;font-size:13px;font-weight:700;color:#C9A84C;font-family:Georgia,serif;">${fmt(r.won_revenue)}</p>
          </td>
          <td style="padding:12px 14px;" align="right">
            <p style="margin:0;font-size:13px;font-weight:700;color:#60a5fa;">${r.open_deals}</p>
          </td>
        </tr>`).join('')}
        <!-- Team totals row -->
        <tr style="background:#0a0a0b;border-top:1px solid #27272a;">
          <td style="padding:12px 14px;">
            <p style="margin:0;font-size:12px;font-weight:700;color:#52525b;text-transform:uppercase;letter-spacing:0.06em;">Team Total</p>
          </td>
          <td style="padding:12px 14px;" align="right">
            <p style="margin:0;font-size:14px;font-weight:800;color:#a78bfa;font-family:Georgia,serif;">${fmt(teamReports.reduce((s: number, r: any) => s + r.pipeline, 0))}</p>
          </td>
          <td style="padding:12px 14px;" align="right">
            <p style="margin:0;font-size:14px;font-weight:800;color:#C9A84C;font-family:Georgia,serif;">${fmt(teamReports.reduce((s: number, r: any) => s + r.won_revenue, 0))}</p>
          </td>
          <td style="padding:12px 14px;" align="right">
            <p style="margin:0;font-size:14px;font-weight:800;color:#60a5fa;">${teamReports.reduce((s: number, r: any) => s + r.open_deals, 0)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>` : ''}

  <!-- ── FOOTER ── -->
  <tr>
    <td align="center" style="padding-top:32px;border-top:1px solid #18181b;margin-top:8px;">
      <p style="margin:0 0 4px 0;font-size:12px;color:#3f3f46;">Signal Strike &middot; Revenue CRM &middot; Powered by Hilltop Ave</p>
      <p style="margin:0;font-size:11px;color:#27272a;">Manage Daily Signal settings: Signal Strike &rarr; Settings</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const preview = req.nextUrl.searchParams.get("preview") === "true";

  // Auth: Vercel cron sends "Authorization: Bearer <CRON_SECRET>" header
  if (!preview) {
    const authHeader = req.headers.get("authorization") || "";
    const cronSecret = process.env.CRON_SECRET || "";
    // Accept header-based OR legacy query-param secret for manual testing
    const legacySecret = req.nextUrl.searchParams.get("secret");
    const validHeader = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const validQuery  = cronSecret && legacySecret === cronSecret;
    if (!validHeader && !validQuery) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Pull all enabled profiles — we'll filter by timezone-aware time in JS
    // (DB stores daily_signal_time in user local time; cron runs in UTC)
    // Select * avoids PostgREST rejecting 'timezone' as a reserved word
    let query = supabase
      .from("profiles")
      .select("*")
      .eq("daily_signal_enabled", true);

    if (!preview) {
      // For preview: just get the current user (first profile returned, no filter)
      query = query.limit(1);
    }

    // For preview mode, get any enabled user
    if (preview) {
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .limit(1);
      const profile = allProfiles?.[0];
      if (!profile?.id) {
        return NextResponse.json({ ok: false, error: "No user profile found." });
      }
      // Get email from auth.users via admin API
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(profile.id);
      const email = authUser?.email;
      if (!email) {
        return NextResponse.json({ ok: false, error: "No email found for user." });
      }
      // fetch their deals and tiers
      const { data: deals } = await supabase
        .from("deals").select("*").eq("user_id", profile.id);
      const { data: tiers } = await supabase
        .from("commission_tiers").select("*").eq("user_id", profile.id);

      const today2 = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const teamReports = await getTeamReports(supabase, profile.id);
      const html = buildEmailHtml(profile.full_name || "there", deals || [], tiers || [], teamReports);
      const pdfBuffer = await buildPDF(deals || [], tiers || [], today2, teamReports);
      const dateStr = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const xlsxBuffer = await buildExcel(deals || [], tiers || [], today2, teamReports);
      await resend.emails.send({
        from:    "Signal Strike <noreply@hilltopave.com>",
        to:      email,
        subject: `Daily Signal · ${dateStr}`,
        html,
        attachments: [
          {
            filename: `Daily-Signal-${new Date().toISOString().slice(0,10)}.pdf`,
            content: pdfBuffer.toString("base64"),
          },
          {
            filename: `Daily-Signal-${new Date().toISOString().slice(0,10)}.xlsx`,
            content: xlsxBuffer.toString("base64"),
          },
        ],
      });
      return NextResponse.json({ ok: true, sent_to: email });
    }

    const { data: allEnabledProfiles, error: profilesError } = await query;
    if (profilesError) {
      console.error("[cron] Supabase profiles query error:", JSON.stringify(profilesError));
      return NextResponse.json({ ok: false, error: profilesError.message }, { status: 500 });
    }
    if (!allEnabledProfiles?.length) {
      return NextResponse.json({ ok: true, sent: 0, message: "No enabled users found." });
    }
    console.log(`[cron] Found ${allEnabledProfiles.length} enabled profile(s)`);

    // Filter: for each user, convert current UTC time to their timezone
    // and check if it falls within the next 15-minute window
    const nowUtc = new Date();
    const profiles = allEnabledProfiles.filter(profile => {
      if (!profile.daily_signal_time) return false;
      const tz = profile.timezone || "UTC";
      try {
        // Use formatToParts — reliable in all Node.js environments
        // unlike toLocaleString which can return "07:00 AM" even with hour12:false
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          hour:     "2-digit",
          minute:   "2-digit",
          hour12:   false,
        }).formatToParts(nowUtc);

        const localHH = parseInt(parts.find(p => p.type === "hour")?.value   || "0", 10);
        const localMM = parseInt(parts.find(p => p.type === "minute")?.value || "0", 10);
        // Normalize: formatToParts can return hour=24 for midnight
        const localMinutes = (localHH % 24) * 60 + localMM;

        // Parse the stored send time (format: "HH:MM" or "HH:MM:SS")
        const [sendHH, sendMM] = profile.daily_signal_time.split(":").map(Number);
        const sendMinutes = sendHH * 60 + sendMM;

        console.log(`[cron] ${profile.full_name} | tz=${tz} | local=${localHH}:${String(localMM).padStart(2,"0")} | send=${sendHH}:${String(sendMM).padStart(2,"0")} | match=${localMinutes >= sendMinutes && localMinutes < sendMinutes + 15}`);

        // Match if within the current 15-minute window
        return localMinutes >= sendMinutes && localMinutes < sendMinutes + 15;
      } catch (e) {
        console.error(`[cron] timezone error for ${profile.full_name}:`, e);
        return false;
      }
    });

    if (!profiles.length) {
      return NextResponse.json({ ok: true, sent: 0, message: "No users scheduled for this window.", utc: nowUtc.toISOString() });
    }

    let sent = 0;
    for (const profile of profiles) {
      // Get email from auth.users
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(profile.id);
      const userEmail = authUser?.email;
      if (!userEmail) continue;
      const { data: deals } = await supabase
        .from("deals").select("*").eq("user_id", profile.id);
      const { data: tiers } = await supabase
        .from("commission_tiers").select("*").eq("user_id", profile.id);

      const todayCron = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const teamReports = await getTeamReports(supabase, profile.id);
      const html = buildEmailHtml(profile.full_name || "there", deals || [], tiers || [], teamReports);
      const pdfBuf = await buildPDF(deals || [], tiers || [], todayCron, teamReports);
      const dateStrCron = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const xlsxBuf = await buildExcel(deals || [], tiers || [], todayCron, teamReports);
      await resend.emails.send({
        from:    "Signal Strike <noreply@hilltopave.com>",
        to:      userEmail,
        subject: `Daily Signal · ${dateStrCron}`,
        html,
        attachments: [
          {
            filename: `Daily-Signal-${new Date().toISOString().slice(0,10)}.pdf`,
            content: pdfBuf.toString("base64"),
          },
          {
            filename: `Daily-Signal-${new Date().toISOString().slice(0,10)}.xlsx`,
            content: xlsxBuf.toString("base64"),
          },
        ],
      });
      sent++;
    }

    return NextResponse.json({ ok: true, sent });
  } catch (err: any) {
    console.error("Daily Signal error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
