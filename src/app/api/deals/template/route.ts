import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const headers = [
    "Title","Company","Contact Name","Contact Email","Contact Phone",
    "Value","Stage","Probability","Close Date","Notes"
  ];
  const example = [
    "KC-26-0168 Quality Inn Renovation","Quality Inn","Michael Stoycheff",
    "mstoycheff@qualityinn.com","816-555-0100",
    "806798","negotiation","70","2026-06-30","Sprinkler water loss, 22 rooms"
  ];
  const stages = ["prospecting","qualification","proposal","negotiation","closed_won","closed_lost"];

  const csv = [
    headers.join(","),
    example.map(v => `"${v}"`).join(","),
    "",
    "# Stage options: " + stages.join(" | "),
    "# Value: number only, no $ or commas",
    "# Probability: 0-100",
    "# Close Date: YYYY-MM-DD or MM/DD/YYYY",
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="signal-strike-deals-template.csv"',
    },
  });
}
