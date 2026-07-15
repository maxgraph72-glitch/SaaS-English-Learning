"use server";

import { revalidatePath } from "next/cache";
import {
  WritingProviderError,
  WRITING_PROMPT_VERSION,
  generateWritingFeedback,
  type WritingFailureCode,
} from "@/lib/ai/writing-provider";
import { requireViewer } from "@/lib/supabase/viewer";
import type { WritingEntry, WritingFeedback, WritingState } from "@/lib/writing/types";
import {
  clampWritingActiveSeconds,
  isUuid,
  normalizeWritingText,
} from "@/lib/writing/validation";

function revalidateWriting() {
  revalidatePath("/writing");
  revalidatePath("/");
}

async function loadWritingState(
  supabase: Awaited<ReturnType<typeof requireViewer>>["supabase"],
  userId: string,
  entryId: string,
): Promise<WritingState> {
  const { data: entry } = await supabase
    .from("writing_entries")
    .select("id,user_id,submission_id,entry_date,original_text,word_count,feedback_status,active_seconds,failure_code,created_at,updated_at")
    .eq("user_id", userId)
    .eq("id", entryId)
    .maybeSingle();

  if (!entry) return { entry: null, feedback: null };

  const { data: feedback } = await supabase
    .from("writing_feedback")
    .select("id,user_id,writing_entry_id,corrected_text,mistakes,estimated_cefr,cefr_rationale,schema_version,prompt_version,provider,model,created_at")
    .eq("user_id", userId)
    .eq("writing_entry_id", entryId)
    .maybeSingle();

  return {
    entry: entry as WritingEntry,
    feedback: (feedback as WritingFeedback | null) ?? null,
  };
}

function providerMessage(code: WritingFailureCode) {
  if (code === "provider_timeout") {
    return "Your entry is saved, but the feedback took too long. Please retry.";
  }
  if (code === "configuration") {
    return "Your entry is saved, but Writing feedback is not configured yet.";
  }
  if (code === "invalid_feedback") {
    return "Your entry is saved, but the feedback was incomplete. Please retry.";
  }
  return "Your entry is saved, but feedback is temporarily unavailable. Please retry.";
}

export async function saveWritingEntryAction(input: {
  submissionId: string;
  originalText: string;
  activeSeconds: number;
}) {
  if (!input || !isUuid(input.submissionId)) {
    return { ok: false as const, message: "This submission could not be identified. Try again." };
  }

  const validated = normalizeWritingText(input.originalText);
  if (!validated.ok) return { ok: false as const, message: validated.message };

  const { supabase, user } = await requireViewer();
  const { data, error } = await supabase.rpc("begin_writing_entry", {
    p_submission_id: input.submissionId,
    p_original_text: validated.text,
    p_active_seconds: clampWritingActiveSeconds(input.activeSeconds),
  });

  if (error) {
    const limitReached = error.message.includes("Daily writing limit reached");
    const conflict = error.message.includes("Submission ID already belongs");
    return {
      ok: false as const,
      message: limitReached
        ? "You have reached today’s limit of 10 Writing checks."
        : conflict
          ? "This submission changed while it was being saved. Start a new check."
          : "Your entry could not be saved. Please try again.",
    };
  }

  const entry = data as WritingEntry | null;
  if (!entry) return { ok: false as const, message: "Your saved entry could not be loaded." };

  const state = await loadWritingState(supabase, user.id, entry.id);
  revalidateWriting();
  return { ok: true as const, state };
}

export async function checkWritingEntryAction(entryId: string) {
  if (!isUuid(entryId)) {
    return { ok: false as const, message: "This saved entry could not be identified." };
  }

  const { supabase, user } = await requireViewer();
  const { data: entry, error: entryError } = await supabase
    .from("writing_entries")
    .select("id,user_id,submission_id,entry_date,original_text,word_count,feedback_status,active_seconds,failure_code,created_at,updated_at")
    .eq("user_id", user.id)
    .eq("id", entryId)
    .maybeSingle();

  if (entryError || !entry) {
    return { ok: false as const, message: "Your saved entry could not be loaded." };
  }

  const { data: claim, error: claimError } = await supabase.rpc(
    "claim_writing_entry_for_feedback",
    { p_entry_id: entryId },
  );
  const claimRow = (claim as Array<{
    entry_id: string;
    feedback_status: WritingEntry["feedback_status"];
    should_process: boolean;
  }> | null)?.[0];

  if (claimError || !claimRow) {
    return { ok: false as const, message: "Feedback could not be started. Please retry." };
  }

  if (!claimRow.should_process) {
    const state = await loadWritingState(supabase, user.id, entryId);
    return state.feedback
      ? { ok: true as const, state, status: "completed" as const }
      : {
          ok: true as const,
          state,
          status: "processing" as const,
          message: "This entry is already being checked. Refresh shortly to see the result.",
        };
  }

  try {
    const generated = await generateWritingFeedback(entry.original_text);
    const feedback = generated.feedback;
    const { error: acceptError } = await supabase.rpc("accept_writing_feedback", {
      p_entry_id: entryId,
      p_corrected_text: feedback.correctedText,
      p_mistakes: feedback.mistakes,
      p_estimated_cefr: feedback.estimatedCefr,
      p_cefr_rationale: feedback.cefrRationale,
      p_schema_version: feedback.schemaVersion,
      p_prompt_version: WRITING_PROMPT_VERSION,
      p_provider: generated.provider,
      p_model: generated.model,
    });

    if (acceptError) {
      await supabase.rpc("mark_writing_entry_failed", {
        p_entry_id: entryId,
        p_failure_code: "persistence_error",
      });
      revalidateWriting();
      return {
        ok: false as const,
        state: await loadWritingState(supabase, user.id, entryId),
        failureCode: "persistence_error" as const,
        message: "Your entry is saved, but feedback could not be stored. Please retry.",
      };
    }

    const state = await loadWritingState(supabase, user.id, entryId);
    if (!state.feedback) {
      return {
        ok: false as const,
        state,
        message: "Feedback was saved but could not be loaded. Refresh the page.",
      };
    }

    revalidateWriting();
    return { ok: true as const, state, status: "completed" as const };
  } catch (error) {
    const failureCode: WritingFailureCode = error instanceof WritingProviderError
      ? error.code
      : "provider_unavailable";
    await supabase.rpc("mark_writing_entry_failed", {
      p_entry_id: entryId,
      p_failure_code: failureCode,
    });
    revalidateWriting();
    return {
      ok: false as const,
      state: await loadWritingState(supabase, user.id, entryId),
      failureCode,
      message: providerMessage(failureCode),
    };
  }
}
