import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Map DASH status → Signal Strike stage
function mapStatus(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("pending sale"))               return "prospecting";
  if (s.includes("work in progress"))           return "negotiation";
  if (s.includes("accounts receivable"))        return "closed_won";
  if (s.includes("completed"))                  return "closed_won";
  if (s.includes("closed"))                     return "closed_lost";
  return "prospecting";
}

function parseAmount(val: string): number {
  const cleaned = val.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseDate(val: string): string | null {
  if (!val || val.trim() === "---" || val.trim() === "") return null;
  const d = new Date(val.trim());
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xls", "xlsx", "html", "htm"].includes(ext ?? "")) {
      return NextResponse.json({ error: "Please upload the DASH export file (.xls)" }, { status: 422 });
    }

    const text = await file.text();

    // DASH exports as HTML table inside an XLS wrapper — parse the table rows
    if (!text.includes("<table") && !text.includes("<TABLE")) {
      return NextResponse.json({ error: "File does not appear to be a DASH export. Please export from DASH as an Excel/XLS file." }, { status: 422 });
    }

    // Extract all <tr> rows
    const rowMatches = text.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    if (rowMatches.length < 2) {
      return NextResponse.json({ error: "No job data found in file." }, { status: 422 });
    }

    // Extract cell text from a row
    function extractCells(row: string): string[] {
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
      return cells.map(cell => {
        // Remove inner tags, decode entities
        const inner = cell.replace(/<t[dh][^>]*>/i, "").replace(/<\/t[dh]>/i, "");
        return stripHtml(inner).replace(/\s+/g, " ").trim();
      });
    }

    // First row = headers
    const headerCells = extractCells(rowMatches[0]);
    // Normalize header names
    const headers = headerCells.map(h => h.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));

    // Find column indices
    const idx = (names: string[]) => {
      for (const name of names) {
        const i = headers.findIndex(h => h.includes(name));
        if (i >= 0) return i;
      }
      return -1;
    };

    const colJobNum  = idx(["job_number", "job_num", "jobnumber"]);
    const colCustomer= idx(["customer"]);
    const colJobName = idx(["job_name", "jobname"]);
    const colStatus  = idx(["status"]);
    const colLocation= idx(["location"]);
    const colDate    = idx(["received_date", "received", "date"]);
    const colDesc    = idx(["job_description", "description", "desc"]);
    const colEstimate= idx(["estimate_amount", "estimate"]);
    const colPayment = idx(["payment_amount", "payment"]);

    if (colJobName < 0 && colJobNum < 0) {
      return NextResponse.json({
        error: `Could not find job columns. Detected columns: ${headerCells.join(", ")}`,
      }, { status: 422 });
    }

    // Parse data rows
    const jobs: any[] = [];
    for (let i = 1; i < rowMatches.length; i++) {
      const cells = extractCells(rowMatches[i]);
      if (cells.length < 2) continue;

      const jobNum   = colJobNum   >= 0 ? cells[colJobNum]   ?? "" : "";
      const customer = colCustomer >= 0 ? cells[colCustomer] ?? "" : "";
      const jobName  = colJobName  >= 0 ? cells[colJobName]  ?? "" : "";
      const status   = colStatus   >= 0 ? cells[colStatus]   ?? "" : "";
      const location = colLocation >= 0 ? cells[colLocation] ?? "" : "";
      const dateRaw  = colDate     >= 0 ? cells[colDate]     ?? "" : "";
      const desc     = colDesc     >= 0 ? cells[colDesc]     ?? "" : "";
      const estimate = colEstimate >= 0 ? cells[colEstimate] ?? "0" : "0";
      const payment  = colPayment  >= 0 ? cells[colPayment]  ?? "0" : "0";

      if (!jobNum && !jobName) continue;

      // Build deal title: "JOB_NUM — Job Name" or just job name
      const title = jobNum && jobName
        ? `${jobNum} — ${jobName}`
        : jobName || jobNum;

      // Build notes from description + location
      const notesParts: string[] = [];
      if (desc && desc !== "---") notesParts.push(desc);
      if (location) notesParts.push(`Location: ${location}`);
      if (payment && parseAmount(payment) > 0) notesParts.push(`Payment received: $${parseAmount(payment).toLocaleString()}`);

      jobs.push({
        job_number:    jobNum,
        title,
        company:       customer || null,
        contact_name:  customer || null,
        value:         parseAmount(estimate),
        stage:         mapStatus(status),
        dash_status:   status,
        location,
        received_date: parseDate(dateRaw),
        notes:         notesParts.join("\n") || null,
        description:   desc !== "---" ? desc : null,
      });
    }

    if (jobs.length === 0) {
      return NextResponse.json({ error: "No jobs found in the file." }, { status: 422 });
    }

    return NextResponse.json({ jobs, count: jobs.length });
  } catch (err: any) {
    console.error("[dash/import]", err);
    return NextResponse.json({ error: err?.message ?? "Parse error" }, { status: 500 });
  }
}
