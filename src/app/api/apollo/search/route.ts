import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const key = process.env.APOLLO_API_KEY;
    if (!key) return NextResponse.json({ error: "APOLLO_API_KEY not configured" }, { status: 500 });

    const body = await req.json();
    const {
      titles, keywords, industry, company_size,
      location, seniority, page = 1, per_page = 25,
    } = body;

    const payload: any = {
      page,
      per_page,
      person_titles:                     titles?.length     ? titles     : undefined,
      person_seniorities:                seniority?.length  ? seniority  : undefined,
      organization_num_employees_ranges: company_size?.length ? company_size : undefined,
      person_locations:                  location?.length   ? location   : undefined,
      q_keywords:                        keywords || undefined,
    };

    // Remove undefined keys
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key":    key,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data?.message ?? "Apollo search failed" }, { status: res.status });
    }

    return NextResponse.json({
      people:      data.people                    ?? [],
      total:       data.pagination?.total_entries ?? 0,
      page:        data.pagination?.page          ?? 1,
      total_pages: data.pagination?.total_pages   ?? 1,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Search error" }, { status: 500 });
  }
}
