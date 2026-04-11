import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "APOLLO_API_KEY is not set" });

  try {
    const res = await fetch("https://api.apollo.io/v1/mixed_people/api_search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key":    key,
      },
      body: JSON.stringify({ per_page: 1, page: 1 }),
    });
    const data = await res.json();
    return NextResponse.json({
      ok:              res.ok,
      status:          res.status,
      key_prefix:      key.slice(0, 6) + "...",
      people_count:    data.people?.length ?? 0,
      total:           data.pagination?.total_entries ?? 0,
      apollo_error:    data?.message ?? data?.error ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, fetch_error: err?.message });
  }
}
