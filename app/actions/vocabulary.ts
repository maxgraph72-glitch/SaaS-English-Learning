"use server";

import { revalidatePath } from "next/cache";
import { isValidTimeZone } from "@/lib/learning/calendar";
import { requireViewer } from "@/lib/supabase/viewer";
import type { DailyBlockStatus } from "@/lib/vocabulary/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MANAGED_ITEMS = 500;

function revalidateVocabulary() {
  revalidatePath("/vocabulary");
  revalidatePath("/review");
  revalidatePath("/");
}

export async function addVocabularyAction(wordInput: string, translationInput: string) {
  const word = wordInput.trim();
  const translation = translationInput.trim();
  if (!word || !translation) {
    return { ok: false as const, message: "Word and translation are required." };
  }

  const { supabase, user } = await requireViewer();
  const { error } = await supabase.from("vocabulary_items").insert({
    user_id: user.id,
    english_word: word,
    translation,
    source: "manual",
  });

  if (error?.code === "23505") {
    return { ok: false as const, message: `“${word}” is already in your vocabulary.` };
  }
  if (error) return { ok: false as const, message: "The word could not be saved." };

  revalidatePath("/vocabulary");
  revalidatePath("/");
  return { ok: true as const, message: "Word added." };
}

export async function importVocabularyAction(
  rowsInput: Array<{ word: string; translation: string }>,
) {
  const { supabase, user } = await requireViewer();
  const rows = rowsInput
    .slice(0, 5000)
    .map((row) => ({ word: row.word.trim(), translation: row.translation.trim() }))
    .filter((row) => row.word && row.translation);

  let added = 0;
  const batchSize = 200;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize).map((row) => ({
      user_id: user.id,
      english_word: row.word,
      translation: row.translation,
      source: "csv" as const,
    }));
    const { data, error } = await supabase
      .from("vocabulary_items")
      .upsert(batch, {
        onConflict: "user_id,normalized_word",
        ignoreDuplicates: true,
      })
      .select("id");

    if (error) {
      return {
        ok: false as const,
        message: "The CSV could not be imported. No existing progress was changed.",
      };
    }
    added += data?.length ?? 0;
  }

  revalidatePath("/vocabulary");
  revalidatePath("/");
  return {
    ok: true as const,
    added,
    duplicates: rows.length - added,
  };
}

export async function updateVocabularyItemAction(input: {
  itemId: string;
  word: string;
  translation: string;
}) {
  if (
    !input ||
    typeof input.itemId !== "string" ||
    typeof input.word !== "string" ||
    typeof input.translation !== "string"
  ) {
    return { ok: false as const, message: "Invalid vocabulary update." };
  }
  const word = input.word.trim();
  const translation = input.translation.trim();
  if (!UUID_PATTERN.test(input.itemId) || !word || !translation) {
    return {
      ok: false as const,
      message: "Word and translation are required.",
    };
  }

  const { supabase, user } = await requireViewer();
  const { data, error } = await supabase
    .from("vocabulary_items")
    .update({ english_word: word, translation })
    .eq("id", input.itemId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error?.code === "23505") {
    return {
      ok: false as const,
      message: `“${word}” is already in your vocabulary.`,
    };
  }
  if (error || !data) {
    return { ok: false as const, message: "This word could not be updated." };
  }

  revalidateVocabulary();
  return { ok: true as const, message: `“${word}” was updated.` };
}

export async function deleteVocabularyItemsAction(itemIds: string[]) {
  if (
    !Array.isArray(itemIds) ||
    itemIds.length === 0 ||
    itemIds.length > MAX_MANAGED_ITEMS
  ) {
    return { ok: false as const, message: "Invalid vocabulary selection." };
  }
  const ids = Array.from(
    new Set(
      itemIds.filter(
        (itemId): itemId is string =>
          typeof itemId === "string" && UUID_PATTERN.test(itemId),
      ),
    ),
  );
  if (ids.length === 0) {
    return {
      ok: false as const,
      message: "Select between 1 and 500 words to delete.",
    };
  }

  const { supabase, user } = await requireViewer();
  const { data, error } = await supabase
    .from("vocabulary_items")
    .delete()
    .eq("user_id", user.id)
    .in("id", ids)
    .select("id");

  if (error) {
    return { ok: false as const, message: "The selected words could not be deleted." };
  }

  const deleted = data?.length ?? 0;
  if (deleted === 0) {
    return { ok: false as const, message: "No selected words were deleted." };
  }

  revalidateVocabulary();
  return {
    ok: true as const,
    deleted,
    message: `${deleted} ${deleted === 1 ? "word" : "words"} deleted.`,
  };
}

export async function startVocabularyLearningAction(itemId: string) {
  const { supabase } = await requireViewer();
  const { error } = await supabase.rpc("start_vocabulary_learning", {
    p_item_id: itemId,
  });
  if (error) return { ok: false as const, message: "This word could not be opened." };

  revalidatePath("/vocabulary");
  revalidatePath("/");
  return { ok: true as const };
}

export async function markVocabularyLearnedAction(
  itemId: string,
  submissionId: string,
) {
  const { supabase } = await requireViewer();
  const { data, error } = await supabase.rpc("mark_vocabulary_learned", {
    p_item_id: itemId,
    p_submission_id: submissionId,
  });
  if (error) return { ok: false as const, message: "The review date could not be saved." };

  revalidatePath("/vocabulary");
  revalidatePath("/review");
  revalidatePath("/");
  return { ok: true as const, item: data };
}

export async function submitVocabularyReviewAction(input: {
  itemId: string;
  correct: boolean;
  responseTimeMs: number;
  submissionId: string;
}) {
  const responseTimeMs = Math.max(0, Math.round(input.responseTimeMs));
  const { supabase } = await requireViewer();
  const { data, error } = await supabase.rpc("submit_vocabulary_review", {
    p_item_id: input.itemId,
    p_correct: input.correct,
    p_response_time_ms: responseTimeMs,
    p_submission_id: input.submissionId,
  });

  if (error) return { ok: false as const, message: "The review could not be saved. Try again." };

  revalidatePath("/vocabulary");
  revalidatePath("/review");
  revalidatePath("/");
  return { ok: true as const, outcome: data?.[0] ?? null };
}

export async function setDailyBlockStatusAction(
  block: "vocabulary" | "speaking" | "writing" | "review",
  status: DailyBlockStatus,
) {
  const { supabase } = await requireViewer();
  const { error } = await supabase.rpc("set_daily_block_status", {
    p_block: block,
    p_status: status,
  });
  if (error) return { ok: false as const };

  revalidatePath("/");
  return { ok: true as const };
}

export async function updateTimezoneAction(timeZone: string) {
  if (!isValidTimeZone(timeZone)) return { ok: false as const };
  const { supabase, user } = await requireViewer();
  const { error } = await supabase.from("user_settings").upsert(
    { user_id: user.id, timezone: timeZone },
    { onConflict: "user_id" },
  );
  return { ok: !error };
}
