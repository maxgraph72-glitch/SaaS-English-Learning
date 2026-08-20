"use server";

import { revalidatePath } from "next/cache";
import {
  SpeakingProviderError,
  transcribeSpeakingAudio,
} from "@/lib/ai/speaking-provider";
import { MAX_SPEAKING_BYTES, MAX_SPEAKING_SECONDS } from "@/lib/speaking/audio";
import { evaluateSpeaking } from "@/lib/speaking/evaluation";
import type {
  SpeakingAttempt,
  SpeakingFailureCode,
} from "@/lib/speaking/types";
import { requireViewer } from "@/lib/supabase/viewer";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const attemptSelect = "id,submission_id,user_id,prompt_id,attempt_date,audio_path,audio_format,audio_bytes,duration_seconds,analysis_status,transcript,score,strengths,improvements,metrics,failure_code,provider,model,created_at,updated_at";

function revalidateSpeaking() {
  revalidatePath("/speaking");
  revalidatePath("/dashboard");
}

async function loadAttempt(
  supabase: Awaited<ReturnType<typeof requireViewer>>["supabase"],
  userId: string,
  attemptId: string,
) {
  const { data } = await supabase
    .from("speaking_attempts")
    .select(attemptSelect)
    .eq("id", attemptId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as SpeakingAttempt | null) ?? null;
}

async function markFailed(
  supabase: Awaited<ReturnType<typeof requireViewer>>["supabase"],
  attemptId: string,
  code: SpeakingFailureCode,
) {
  await supabase.rpc("mark_speaking_attempt_failed", {
    p_attempt_id: attemptId,
    p_failure_code: code,
  });
}

function failureMessage(code: SpeakingFailureCode) {
  if (code === "provider_timeout") return "Your recording is private and saved, but transcription took too long. Please retry.";
  if (code === "configuration") return "Your recording is saved, but SpeechKit is not configured for transcription yet.";
  if (code === "invalid_audio") return "The recording could not be read. Please record it again in a quieter place.";
  if (code === "no_speech") return "No clear English speech was recognized. Try again a little closer to the microphone.";
  if (code === "storage_error") return "The private recording could not be loaded. Please record it again.";
  if (code === "persistence_error") return "The feedback was created but could not be saved. Please retry.";
  return "Speaking feedback is temporarily unavailable. Please retry.";
}

export async function beginSpeakingAttemptAction(input: {
  promptId: string;
  submissionId: string;
  durationSeconds: number;
  audioBytes: number;
}) {
  if (
    !input
    || !UUID_PATTERN.test(input.promptId)
    || !UUID_PATTERN.test(input.submissionId)
  ) {
    return { ok: false as const, message: "This speaking attempt could not be identified." };
  }

  const durationSeconds = Math.round(input.durationSeconds);
  const audioBytes = Math.round(input.audioBytes);
  if (
    !Number.isFinite(durationSeconds)
    || !Number.isFinite(audioBytes)
    || durationSeconds < 1
    || durationSeconds > MAX_SPEAKING_SECONDS
    || audioBytes < 3_200
    || audioBytes > MAX_SPEAKING_BYTES
  ) {
    return { ok: false as const, message: "Record between 1 second and 2 minutes before submitting." };
  }

  const { supabase, user } = await requireViewer();
  const audioPath = `${user.id}/${input.submissionId}.pcm`;
  const { data, error } = await supabase.rpc("begin_speaking_attempt", {
    p_prompt_id: input.promptId,
    p_submission_id: input.submissionId,
    p_audio_path: audioPath,
    p_duration_seconds: durationSeconds,
    p_audio_bytes: audioBytes,
  });

  if (error) {
    const limitReached = error.message.includes("Daily speaking limit reached");
    return {
      ok: false as const,
      message: limitReached
        ? "You have reached today’s limit of five Speaking analyses."
        : "The speaking attempt could not be prepared. Please try again.",
    };
  }

  revalidateSpeaking();
  return {
    ok: true as const,
    attempt: data as SpeakingAttempt,
    uploadPath: audioPath,
  };
}

export async function analyzeSpeakingAttemptAction(attemptId: string) {
  if (!UUID_PATTERN.test(attemptId)) {
    return { ok: false as const, message: "This speaking attempt could not be identified." };
  }

  const { supabase, user } = await requireViewer();
  const attempt = await loadAttempt(supabase, user.id, attemptId);
  if (!attempt) return { ok: false as const, message: "Your speaking attempt could not be loaded." };

  const { data: claim, error: claimError } = await supabase.rpc("claim_speaking_attempt", {
    p_attempt_id: attemptId,
  });
  const claimRow = (claim as Array<{
    attempt_id: string;
    analysis_status: SpeakingAttempt["analysis_status"];
    should_process: boolean;
  }> | null)?.[0];

  if (claimError || !claimRow) {
    return { ok: false as const, message: "Speaking analysis could not be started. Please retry." };
  }
  if (!claimRow.should_process) {
    const current = await loadAttempt(supabase, user.id, attemptId);
    return current?.analysis_status === "completed"
      ? { ok: true as const, attempt: current, status: "completed" as const }
      : {
          ok: true as const,
          attempt: current,
          status: "processing" as const,
          message: "This recording is already being analyzed. Refresh shortly to see the result.",
        };
  }

  const { data: prompt, error: promptError } = await supabase
    .from("speaking_prompts")
    .select("reference_text")
    .eq("id", attempt.prompt_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (promptError || !prompt) {
    await markFailed(supabase, attemptId, "persistence_error");
    return { ok: false as const, message: failureMessage("persistence_error") };
  }

  const { data: audioBlob, error: storageError } = await supabase.storage
    .from("speaking-audio")
    .download(attempt.audio_path);
  if (storageError || !audioBlob) {
    await markFailed(supabase, attemptId, "storage_error");
    revalidateSpeaking();
    return {
      ok: false as const,
      attempt: await loadAttempt(supabase, user.id, attemptId),
      failureCode: "storage_error" as const,
      message: failureMessage("storage_error"),
    };
  }

  try {
    const audio = new Uint8Array(await audioBlob.arrayBuffer());
    const recognized = await transcribeSpeakingAudio(audio);
    const feedback = evaluateSpeaking(
      prompt.reference_text,
      recognized.transcript,
      attempt.duration_seconds,
    );
    const { error: completeError } = await supabase.rpc("complete_speaking_attempt", {
      p_attempt_id: attemptId,
      p_transcript: recognized.transcript,
      p_score: feedback.score,
      p_strengths: feedback.strengths,
      p_improvements: feedback.improvements,
      p_metrics: feedback.metrics,
      p_provider: recognized.provider,
      p_model: recognized.model,
    });

    if (completeError) {
      await markFailed(supabase, attemptId, "persistence_error");
      revalidateSpeaking();
      return {
        ok: false as const,
        attempt: await loadAttempt(supabase, user.id, attemptId),
        failureCode: "persistence_error" as const,
        message: failureMessage("persistence_error"),
      };
    }

    const completed = await loadAttempt(supabase, user.id, attemptId);
    revalidateSpeaking();
    return { ok: true as const, attempt: completed, status: "completed" as const };
  } catch (error) {
    const failureCode: SpeakingFailureCode = error instanceof SpeakingProviderError
      ? error.code
      : "provider_unavailable";
    await markFailed(supabase, attemptId, failureCode);
    revalidateSpeaking();
    return {
      ok: false as const,
      attempt: await loadAttempt(supabase, user.id, attemptId),
      failureCode,
      message: failureMessage(failureCode),
    };
  }
}
