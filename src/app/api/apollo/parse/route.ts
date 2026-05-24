import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SENIORITY_OPTS = ["owner","founder","c_suite","partner","vp","head","director","manager","senior","mid","junior","entry"];
const SIZE_OPTS = ["1,10","11,50","51,200","201,500","501,1000","1001,10000"];

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query?.trim()) return NextResponse.json({ error: "No query provided" }, { status: 400 });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: `You are a sales prospecting assistant. Parse the user's natural language search query into structured Apollo.io search filters.

Return ONLY a valid JSON object with these optional fields:
- "keywords": string (general search terms, company names, industries)
- "titles": string[] (job titles, e.g. ["VP Operations", "Facilities Manager"])
- "location": string (city, state, or region, e.g. "Kansas City, MO")
- "seniority": string[] (from: ${SENIORITY_OPTS.join(", ")})
- "company_size": string[] (from: ${SIZE_OPTS.join(", ")} — these are employee count ranges)

Rules:
- Only include fields that are clearly implied by the query
- "titles" should be specific job titles, not general descriptions
- "seniority" should match the list exactly
- If company size is mentioned (e.g. "small", "mid-size", "large enterprise"), map to the appropriate range(s)
- Return valid JSON only, no explanation, no markdown`,
        messages: [{ role: "user", content: query }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";

    // Parse Claude's JSON response
    const cleaned = text.replace(/```json|```/g, "").trim();
    let filters: any = {};
    try {
      filters = JSON.parse(cleaned);
    } catch {
      // Claude returned something unparseable — return empty filters
      return NextResponse.json({ filters: {}, raw: text });
    }

    // Validate and sanitize
    const out: any = {};
    if (filters.keywords && typeof filters.keywords === "string") out.keywords = filters.keywords;
    if (Array.isArray(filters.titles) && filters.titles.length)   out.titles   = filters.titles;
    if (filters.location && typeof filters.location === "string") out.location = filters.location;
    if (Array.isArray(filters.seniority))
      out.seniority = filters.seniority.filter((s: string) => SENIORITY_OPTS.includes(s));
    if (Array.isArray(filters.company_size))
      out.company_size = filters.company_size.filter((s: string) => SIZE_OPTS.includes(s));

    return NextResponse.json({ filters: out });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Parse error" }, { status: 500 });
  }
}
