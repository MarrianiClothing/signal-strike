import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications.server";

export const runtime = "nodejs";

/**
 * POST /api/notifications/milestone-completed
 * Body: { project_id: string, milestone_id: string, milestone_name: string }
 *
 * Fires an in-app notification to the project owner. Distinct from
 * /api/milestones/notify which sends EMAIL to the client.
 *
 * This route is called by the client after a successful complete-toggle,
 * regardless of email_client_updates setting.
 */
export async function POST(req: NextRequest) {
  try {
    const { project_id, milestone_id, milestone_name } = await req.json();
    if (!project_id || !milestone_id || !milestone_name) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Look up project — we need the owner's user_id and the project name
    const { data: project, error: projErr } = await admin
      .from("projects")
      .select("id, user_id, name, wo_display, wo_number")
      .eq("id", project_id)
      .maybeSingle();

    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const woLabel = project.wo_display
      ? project.wo_display
      : project.wo_number
        ? `WO-${project.wo_number}`
        : project.name;

    const notifId = await createNotification({
      userId: project.user_id,
      type:   "milestone_completed",
      title:  "Milestone completed",
      body:   `${milestone_name} — ${woLabel}`,
      link:   `/projects/${project.id}`,
      metadata: { project_id, milestone_id },
    });

    return NextResponse.json({ ok: true, notification_id: notifId });
  } catch (err: any) {
    console.error("[milestone-completed notify]", err);
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
