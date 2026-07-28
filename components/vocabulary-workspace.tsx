"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addVocabularyAction,
  deleteVocabularyItemsAction,
  importVocabularyAction,
  updateVocabularyItemAction,
} from "@/app/actions/vocabulary";
import { parseVocabularyCsv, type ParsedVocabularyCsv } from "@/lib/vocabulary/csv";
import {
  STUDY_SESSION_LIMIT,
  isReviewDue,
  isStudyEligible,
} from "@/lib/vocabulary/study-session";
import type { VocabularyGroup, VocabularyItem } from "@/lib/vocabulary/types";

const filters: Array<"all" | VocabularyGroup> = [
  "all",
  "unknown",
  "learning",
  "weak",
  "repeat",
  "known",
];

function formatDueDate(date: string | null) {
  if (!date) return "Not scheduled";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function VocabularyWorkspace({
  initialItems,
  loadError,
  today,
}: {
  initialItems: VocabularyItem[];
  loadError: string;
  today: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [message, setMessage] = useState(loadError);
  const [pending, setPending] = useState(false);
  const [csv, setCsv] = useState<ParsedVocabularyCsv | null>(null);
  const [csvName, setCsvName] = useState("");
  const [importSummary, setImportSummary] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMessage, setSelectionMessage] = useState("");
  const [editingItem, setEditingItem] = useState<VocabularyItem | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");

  const counts = useMemo(() => {
    const result = Object.fromEntries(filters.map((name) => [name, 0])) as Record<
      (typeof filters)[number],
      number
    >;
    result.all = initialItems.length;
    initialItems.forEach((item) => {
      result[item.current_group] += 1;
    });
    return result;
  }, [initialItems]);

  const itemsById = useMemo(
    () => new Map(initialItems.map((item) => [item.id, item])),
    [initialItems],
  );
  const activeSelectedItems = selectedIds.flatMap((id) => {
    const item = itemsById.get(id);
    return item ? [item] : [];
  });
  const activeSelectedIds = activeSelectedItems.map((item) => item.id);
  const activeSelectedIdSet = new Set(activeSelectedIds);
  const eligibleSelectedItems = activeSelectedItems.filter(isStudyEligible);
  const studySelectedIds = eligibleSelectedItems
    .slice(0, STUDY_SESSION_LIMIT)
    .map((item) => item.id);
  const reviewSelectedItems = activeSelectedItems.filter((item) =>
    isReviewDue(item, today),
  );
  const reviewSelectedIds = reviewSelectedItems
    .slice(0, STUDY_SESSION_LIMIT)
    .map((item) => item.id);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("en");
    return initialItems.filter((item) => {
      const matchesFilter = filter === "all" || item.current_group === filter;
      const matchesQuery =
        !normalizedQuery ||
        item.english_word.toLocaleLowerCase("en").includes(normalizedQuery) ||
        item.translation.toLocaleLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, initialItems, query]);

  async function addWord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await addVocabularyAction(
      String(data.get("word") ?? ""),
      String(data.get("translation") ?? ""),
    );
    setMessage(result.message);
    setPending(false);
    if (result.ok) {
      form.reset();
      router.refresh();
    }
  }

  async function chooseCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImportSummary("");
    if (!file) {
      setCsv(null);
      setCsvName("");
      return;
    }
    try {
      setCsv(parseVocabularyCsv(await file.text()));
      setCsvName(file.name);
    } catch (error) {
      setCsv(null);
      setCsvName(file.name);
      setImportSummary(
        error instanceof Error ? error.message : "This CSV could not be read.",
      );
    }
  }

  async function importCsv() {
    if (!csv) return;
    setPending(true);
    const result = await importVocabularyAction(csv.rows);
    setPending(false);
    if (!result.ok) {
      setImportSummary(result.message);
      return;
    }
    setImportSummary(
      `${result.added} added · ${result.duplicates} duplicates skipped · ${csv.invalidRows} invalid rows`,
    );
    router.refresh();
  }

  function toggleSelection(item: VocabularyItem, checked: boolean) {
    if (!checked) {
      setSelectedIds(activeSelectedIds.filter((id) => id !== item.id));
      setSelectionMessage("");
      return;
    }

    if (activeSelectedIdSet.has(item.id)) return;
    if (activeSelectedIds.length >= 500) {
      setSelectionMessage("You can manage up to 500 selected words at a time.");
      return;
    }

    setSelectedIds([...activeSelectedIds, item.id]);
    setSelectionMessage("");
  }

  function openStudySession() {
    if (studySelectedIds.length === 0) return;
    const search = new URLSearchParams();
    studySelectedIds.forEach((id) => search.append("id", id));
    router.push(`/vocabulary/study?${search.toString()}`);
  }

  function openReviewSession() {
    if (reviewSelectedIds.length === 0) return;
    const search = new URLSearchParams();
    reviewSelectedIds.forEach((id) => search.append("id", id));
    router.push(`/review?${search.toString()}`);
  }

  function openEditSelected() {
    if (activeSelectedItems.length !== 1) {
      setSelectionMessage("Select exactly one word to edit.");
      return;
    }
    setEditMessage("");
    setEditingItem(activeSelectedItems[0]);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingItem) return;

    const data = new FormData(event.currentTarget);
    setPending(true);
    setEditMessage("");
    let result: Awaited<ReturnType<typeof updateVocabularyItemAction>>;
    try {
      result = await updateVocabularyItemAction({
        itemId: editingItem.id,
        word: String(data.get("word") ?? ""),
        translation: String(data.get("translation") ?? ""),
      });
    } catch {
      setPending(false);
      setEditMessage("This word could not be updated. Try again.");
      return;
    }
    setPending(false);
    if (!result.ok) {
      setEditMessage(result.message);
      return;
    }

    setEditingItem(null);
    setSelectedIds([]);
    setSelectionMessage(result.message);
    router.refresh();
  }

  async function deleteSelected() {
    if (activeSelectedIds.length === 0) return;

    setPending(true);
    setDeleteMessage("");
    let result: Awaited<ReturnType<typeof deleteVocabularyItemsAction>>;
    try {
      result = await deleteVocabularyItemsAction(activeSelectedIds);
    } catch {
      setPending(false);
      setDeleteMessage("The selected words could not be deleted. Try again.");
      return;
    }
    setPending(false);
    if (!result.ok) {
      setDeleteMessage(result.message);
      return;
    }

    setDeleteConfirmationOpen(false);
    setSelectedIds([]);
    setSelectionMessage(result.message);
    router.refresh();
  }

  return (
    <div className="page-container vocabulary-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Vocabulary</p>
          <h1>Build a collection you will actually review.</h1>
          <p>New words stay in intake until you deliberately choose to learn them.</p>
        </div>
        <div className="total-chip">
          <strong>{initialItems.length}</strong>
          <span>total words</span>
        </div>
      </section>

      <section className="input-grid">
        <article className="panel-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Manual entry</p>
              <h2>Add one word</h2>
            </div>
            <span className="panel-step">01</span>
          </div>
          <form className="inline-form" onSubmit={addWord}>
            <label>
              English word
              <input name="word" autoComplete="off" required />
            </label>
            <label>
              Translation
              <input name="translation" autoComplete="off" required />
            </label>
            <button className="primary-button" type="submit" disabled={pending}>
              Add word
            </button>
          </form>
          {message ? (
            <p className="form-message" role="status">
              {message}
            </p>
          ) : null}
        </article>

        <article className="panel-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Google Sheets</p>
              <h2>Import a CSV</h2>
            </div>
            <span className="panel-step">02</span>
          </div>
          <p className="panel-description">
            Export your sheet as CSV. Column one is the English word; column two is its
            translation.
          </p>
          <div className="file-row">
            <label className="file-button">
              Choose CSV
              <input type="file" accept=".csv,text/csv" onChange={chooseCsv} />
            </label>
            <span>{csvName || "No file selected"}</span>
            <button
              className="secondary-button"
              type="button"
              onClick={importCsv}
              disabled={!csv || pending}
            >
              Import
            </button>
          </div>
          {csv ? (
            <p className="file-preview">
              {csv.rows.length} valid rows ready{csv.headerDetected ? " · header detected" : ""}
            </p>
          ) : null}
          {importSummary ? (
            <p className="form-message" role="status">
              {importSummary}
            </p>
          ) : null}
        </article>
      </section>

      <section
        className="study-panel selection-study-panel"
        aria-labelledby="study-selection-heading"
      >
        <p className="eyebrow">Manage and study</p>
        <h2 id="study-selection-heading">
          {activeSelectedIds.length > 0
            ? `${activeSelectedIds.length} ${activeSelectedIds.length === 1 ? "word" : "words"} selected`
            : "Choose words from your collection."}
        </h2>
        <p className="study-selection-copy">
          Start unscheduled words in Study. Words whose review date has arrived open
          directly in Review.
        </p>
        <div className="selection-actions">
          <button
            className={
              studySelectedIds.length > 0 || reviewSelectedIds.length === 0
                ? "primary-button"
                : "secondary-button"
            }
            type="button"
            disabled={studySelectedIds.length === 0 || pending}
            onClick={openStudySession}
          >
            Study selected ({studySelectedIds.length})
          </button>
          <button
            className={
              reviewSelectedIds.length > 0 && studySelectedIds.length === 0
                ? "primary-button"
                : "secondary-button"
            }
            type="button"
            disabled={reviewSelectedIds.length === 0 || pending}
            onClick={openReviewSession}
          >
            Review selected ({reviewSelectedIds.length})
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={activeSelectedItems.length !== 1 || pending}
            onClick={openEditSelected}
          >
            Edit selected
          </button>
          <button
            className="danger-button"
            type="button"
            disabled={activeSelectedIds.length === 0 || pending}
            onClick={() => {
              setDeleteMessage("");
              setDeleteConfirmationOpen(true);
            }}
          >
            Delete selected ({activeSelectedIds.length})
          </button>
          {activeSelectedIds.length > 0 ? (
            <button
              className="selection-clear"
              type="button"
              disabled={pending}
              onClick={() => {
                setSelectedIds([]);
                setSelectionMessage("");
              }}
            >
              Clear selection
            </button>
          ) : null}
        </div>
        <p className="selection-message" role="status" aria-live="polite">
          {selectionMessage}
        </p>
        <small>
          Editing preserves progress and schedule. Deleting also removes review history.
          {eligibleSelectedItems.length > STUDY_SESSION_LIMIT
            ? " Study uses the first 10 eligible selected words."
            : ""}
          {reviewSelectedItems.length > STUDY_SESSION_LIMIT
            ? " Review uses the first 10 due selected words."
            : ""}
        </small>
      </section>

      <section className="collection-card" aria-labelledby="collection-heading">
        <div className="collection-topbar">
          <div>
            <p className="eyebrow">Your collection</p>
            <h2 id="collection-heading">Words and review state</h2>
          </div>
          <label className="search-field">
            <span className="sr-only">Search vocabulary</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search words…"
            />
          </label>
        </div>
        <div className="filter-tabs" role="group" aria-label="Filter by vocabulary group">
          {filters.map((name) => (
            <button
              className={filter === name ? "active" : ""}
              type="button"
              onClick={() => setFilter(name)}
              key={name}
            >
              {name}
              <span>{counts[name]}</span>
            </button>
          ))}
        </div>
        <div className="word-table" role="table" aria-label="Vocabulary items">
          <div className="word-table-head" role="row">
            <span>Word</span>
            <span>Group</span>
            <span>Stage</span>
            <span>Next review</span>
            <span>Select</span>
          </div>
          {visibleItems.map((item) => {
            const selected = activeSelectedIdSet.has(item.id);

            return (
              <div
                className={selected ? "word-table-row selected" : "word-table-row"}
                role="row"
                key={item.id}
              >
                <div>
                  <strong>{item.english_word}</strong>
                  <small>{item.translation}</small>
                </div>
                <span>
                  <span className={`group-badge ${item.current_group}`}>
                    {item.current_group}
                  </span>
                </span>
                <span>{item.repetition_stage === 0 ? "—" : `${item.repetition_stage} / 5`}</span>
                <span>{formatDueDate(item.next_review_date)}</span>
                <span>
                  <label className="selection-control">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => toggleSelection(item, event.target.checked)}
                      aria-label={`Select ${item.english_word}`}
                    />
                    <span>{selected ? "Selected" : "Select"}</span>
                  </label>
                </span>
              </div>
            );
          })}
          {visibleItems.length === 0 ? (
            <div className="empty-state">
              <strong>No words here yet.</strong>
              <p>Add a word or adjust your filters.</p>
            </div>
          ) : null}
        </div>
      </section>

      {editingItem ? (
        <div className="management-dialog-backdrop">
          <section
            className="management-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-word-heading"
          >
            <p className="eyebrow">Edit vocabulary</p>
            <h2 id="edit-word-heading">Update this card.</h2>
            <p className="management-dialog-copy">
              Its group, stage, next review date and review history will stay unchanged.
            </p>
            <form className="management-form" onSubmit={saveEdit}>
              <label>
                English word
                <input
                  name="word"
                  defaultValue={editingItem.english_word}
                  autoComplete="off"
                  required
                  autoFocus
                />
              </label>
              <label>
                Translation
                <input
                  name="translation"
                  defaultValue={editingItem.translation}
                  autoComplete="off"
                  required
                />
              </label>
              {editMessage ? (
                <p className="form-message" role="status">
                  {editMessage}
                </p>
              ) : null}
              <div className="management-dialog-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={pending}
                  onClick={() => setEditingItem(null)}
                >
                  Cancel
                </button>
                <button className="primary-button" type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {deleteConfirmationOpen ? (
        <div className="management-dialog-backdrop">
          <section
            className="management-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-words-heading"
            aria-describedby="delete-words-description"
          >
            <p className="eyebrow">Delete vocabulary</p>
            <h2 id="delete-words-heading">
              Delete {activeSelectedIds.length}{" "}
              {activeSelectedIds.length === 1 ? "word" : "words"}?
            </h2>
            <p id="delete-words-description" className="management-dialog-copy">
              This permanently removes the selected cards and all of their review
              history. This action cannot be undone.
            </p>
            <p className="delete-word-preview">
              {activeSelectedItems
                .slice(0, 5)
                .map((item) => item.english_word)
                .join(", ")}
              {activeSelectedItems.length > 5
                ? ` and ${activeSelectedItems.length - 5} more`
                : ""}
            </p>
            {deleteMessage ? (
              <p className="form-message" role="status">
                {deleteMessage}
              </p>
            ) : null}
            <div className="management-dialog-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={pending}
                onClick={() => setDeleteConfirmationOpen(false)}
              >
                Keep words
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={pending || activeSelectedIds.length === 0}
                onClick={() => void deleteSelected()}
              >
                {pending ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
