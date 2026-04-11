import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const key = process.env.APOLLO_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: "APOLLO_API_KEY is not set" });
  }

  // Test a minimal Apollo call with the key
  try {
    const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, per_page: 1, page: 1 }),
    });
    const data = await res.json();
    return NextResponse.json({
      ok:         res.ok,
      status:     res.status,
      key_prefix: key.slice(0, 6) + "...",
      apollo_response: data?.error ?? data?.message ?? (res.ok ? "success" : "failed"),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, fetch_error: err?.message });
  }
}
