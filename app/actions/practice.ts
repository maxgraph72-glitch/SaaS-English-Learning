"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/supabase/viewer";
import type { PracticeAttemptOutcome } from "@/lib/practice/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function submitPracticeAttemptAction(input: {
  exerciseId: string;
  answer: string;
  responseMs: number;
  submissionId: string;
}) {
  if (
    !input
    || !UUID_PATTERN.test(input.exerciseId)
    || !UUID_PATTERN.test(input.submissionId)
    || typeof input.answer !== "string"
    || !input.answer.trim()
    || input.answer.length > 200
    || !Number.isFinite(input.responseMs)
  ) {
    return { ok: false as const, message: "Enter a valid answer and try again." };
  }

  const { supabase } = await requireViewer();
  const { data, error } = await supabase.rpc("submit_practice_attempt", {
    p_exercise_id: input.exerciseId,
    p_submitted_answer: input.answer,
    p_response_ms: Math.min(3_600_000, Math.max(0, Math.round(input.responseMs))),
    p_submission_id: input.submissionId,
  });
  const outcome = (data as PracticeAttemptOutcome[] | null)?.[0] ?? null;
  if (error || !outcome) {
    return {
      ok: false as const,
      message: "Your answer could not be saved. Check your connection and retry.",
    };
  }

  revalidatePath("/practice");
  return { ok: true as const, outcome };
}
