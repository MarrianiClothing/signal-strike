import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const key = process.env.APOLLO_API_KEY;
    if (!key) return NextResponse.json({ error: "APOLLO_API_KEY not configured" }, { status: 500 });

    const { person_id, first_name, last_name, organization_name, linkedin_url } = await req.json();

    const payload: any = {
      id:                person_id         || undefined,
      first_name:        first_name        || undefined,
      last_name:         last_name         || undefined,
      organization_name: organization_name || undefined,
      linkedin_url:      linkedin_url      || undefined,
      reveal_personal_emails: false,
    };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    const res = await fetch("https://api.apollo.io/v1/people/match", {
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
      return NextResponse.json({ error: data?.message ?? "Enrichment failed" }, { status: res.status });
    }

    const person = data.person ?? {};
    return NextResponse.json({
      email:        person.email                                    ?? null,
      phone:        person.phone_numbers?.[0]?.sanitized_number     ?? null,
      linkedin_url: person.linkedin_url                             ?? null,
      title:        person.title                                    ?? null,
      company:      person.organization?.name                       ?? null,
      city:         person.city                                     ?? null,
      state:        person.state                                    ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Enrich error" }, { status: 500 });
  }
}
