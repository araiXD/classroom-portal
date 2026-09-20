import { config } from "./config.js";

const NOTIFY_TIMEOUT_MS = 3000;

// Tell the realtime service a student just submitted, so it can push a live
// notification to the class's teacher. Best effort: fire-and-forget with a short
// timeout, and every failure is only logged, so a down or slow realtime service
// can never fail or delay a submission.
export function notifySubmission(db, user, submission) {
  if (!config.realtimeUrl) return;
  push(db, user, submission).catch((err) => {
    console.warn(`Live notification not sent: ${err.message}`);
  });
}

async function push(db, user, submission) {
  // The student can read this assignment and its class (RLS: they're enrolled),
  // which is all we need to find the teacher and label the notification.
  const { data: assignment, error } = await db
    .from("assignments")
    .select("id, title, class:classes(id, name, teacher_id)")
    .eq("id", submission.assignment_id)
    .single();
  if (error || !assignment?.class) throw new Error(`could not look up assignment (${error?.message ?? "no class"})`);

  const res = await fetch(`${config.realtimeUrl}/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Notify-Secret": config.notifySecret },
    body: JSON.stringify({
      teacher_id: assignment.class.teacher_id,
      message: {
        type: "submission",
        submission_id: submission.id,
        assignment_id: assignment.id,
        assignment_title: assignment.title,
        class_id: assignment.class.id,
        class_name: assignment.class.name,
        student_name: user.full_name,
        submitted_at: submission.submitted_at,
      },
    }),
    signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`realtime service returned ${res.status}`);
}
