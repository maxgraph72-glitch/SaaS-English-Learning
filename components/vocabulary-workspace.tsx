"use client";

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addVocabularyAction,
  importVocabularyAction,
  markVocabularyLearnedAction,
  startVocabularyLearningAction,
} from "@/app/actions/vocabulary";
import { parseVocabularyCsv, type ParsedVocabularyCsv } from "@/lib/vocabulary/csv";
import type { VocabularyGroup, VocabularyItem } from "@/lib/vocabulary/types";

const filters: Array<"all" | VocabularyGroup> = ["all", "unknown", "learning", "weak", "repeat", "known"];

function formatDueDate(date: string | null) {
  if (!date) return "Not scheduled";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export function VocabularyWorkspace({ initialItems, loadError }: { initialItems: VocabularyItem[]; loadError: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [message, setMessage] = useState(loadError);
  const [pending, setPending] = useState(false);
  const [csv, setCsv] = useState<ParsedVocabularyCsv | null>(null);
  const [csvName, setCsvName] = useState("");
  const [importSummary, setImportSummary] = useState("");
  const [studyItem, setStudyItem] = useState<VocabularyItem | null>(null);
  const [translationVisible, setTranslationVisible] = useState(false);
  const learnedSubmission = useRef<string | null>(null);

  const counts = useMemo(() => {
    const result = Object.fromEntries(filters.map((name) => [name, 0])) as Record<(typeof filters)[number], number>;
    result.all = initialItems.length;
    initialItems.forEach((item) => { result[item.current_group] += 1; });
    return result;
  }, [initialItems]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("en");
    return initialItems.filter((item) => {
      const matchesFilter = filter === "all" || item.current_group === filter;
      const matchesQuery = !normalizedQuery || item.english_word.toLocaleLowerCase("en").includes(normalizedQuery) || item.translation.toLocaleLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, initialItems, query]);

  async function addWord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await addVocabularyAction(String(data.get("word") ?? ""), String(data.get("translation") ?? ""));
    setMessage(result.message);
    setPending(false);
    if (result.ok) { form.reset(); router.refresh(); }
  }

  async function chooseCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImportSummary("");
    if (!file) { setCsv(null); setCsvName(""); return; }
    try {
      setCsv(parseVocabularyCsv(await file.text()));
      setCsvName(file.name);
    } catch (error) {
      setCsv(null);
      setCsvName(file.name);
      setImportSummary(error instanceof Error ? error.message : "This CSV could not be read.");
    }
  }

  async function importCsv() {
    if (!csv) return;
    setPending(true);
    const result = await importVocabularyAction(csv.rows);
    setPending(false);
    if (!result.ok) { setImportSummary(result.message); return; }
    setImportSummary(`${result.added} added · ${result.duplicates} duplicates skipped · ${csv.invalidRows} invalid rows`);
    router.refresh();
  }

  async function study(item: VocabularyItem) {
    setPending(true);
    setMessage("");
    if (item.current_group === "unknown") {
      const result = await startVocabularyLearningAction(item.id);
      if (!result.ok) { setMessage(result.message); setPending(false); return; }
    }
    learnedSubmission.current = crypto.randomUUID();
    setStudyItem({ ...item, current_group: "learning" });
    setTranslationVisible(false);
    setPending(false);
    router.refresh();
  }

  async function markLearned() {
    if (!studyItem || !translationVisible) return;
    learnedSubmission.current ??= crypto.randomUUID();
    setPending(true);
    const result = await markVocabularyLearnedAction(studyItem.id, learnedSubmission.current);
    setPending(false);
    if (!result.ok) { setMessage(result.message); return; }
    setMessage(`“${studyItem.english_word}” is due tomorrow.`);
    setStudyItem(null);
    learnedSubmission.current = null;
    router.refresh();
  }

  return (
    <div className="page-container vocabulary-page">
      <section className="page-heading">
        <div><p className="eyebrow">Vocabulary</p><h1>Build a collection you will actually review.</h1><p>New words stay in intake until you deliberately choose to learn them.</p></div>
        <div className="total-chip"><strong>{initialItems.length}</strong><span>total words</span></div>
      </section>

      <section className="input-grid">
        <article className="panel-card">
          <div className="panel-heading"><div><p className="eyebrow">Manual entry</p><h2>Add one word</h2></div><span className="panel-step">01</span></div>
          <form className="inline-form" onSubmit={addWord}>
            <label>English word<input name="word" autoComplete="off" required /></label>
            <label>Translation<input name="translation" autoComplete="off" required /></label>
            <button className="primary-button" type="submit" disabled={pending}>Add word</button>
          </form>
          {message ? <p className="form-message" role="status">{message}</p> : null}
        </article>

        <article className="panel-card">
          <div className="panel-heading"><div><p className="eyebrow">Google Sheets</p><h2>Import a CSV</h2></div><span className="panel-step">02</span></div>
          <p className="panel-description">Export your sheet as CSV. Column one is the English word; column two is its translation.</p>
          <div className="file-row">
            <label className="file-button">Choose CSV<input type="file" accept=".csv,text/csv" onChange={chooseCsv} /></label>
            <span>{csvName || "No file selected"}</span>
            <button className="secondary-button" type="button" onClick={importCsv} disabled={!csv || pending}>Import</button>
          </div>
          {csv ? <p className="file-preview">{csv.rows.length} valid rows ready{csv.headerDetected ? " · header detected" : ""}</p> : null}
          {importSummary ? <p className="form-message" role="status">{importSummary}</p> : null}
        </article>
      </section>

      {studyItem ? (
        <section className="study-panel" aria-labelledby="study-word">
          <button className="close-button" type="button" onClick={() => setStudyItem(null)} aria-label="Close study card">×</button>
          <p className="eyebrow">Study before scheduling</p><h2 id="study-word">{studyItem.english_word}</h2>
          {translationVisible ? <p className="study-translation">{studyItem.translation}</p> : <button className="reveal-link" type="button" onClick={() => setTranslationVisible(true)}>Show translation</button>}
          <button className="primary-button" type="button" disabled={!translationVisible || pending} onClick={markLearned}>Mark as learned</button>
          <small>The first review will be scheduled for your next local calendar day.</small>
        </section>
      ) : null}

      <section className="collection-card" aria-labelledby="collection-heading">
        <div className="collection-topbar">
          <div><p className="eyebrow">Your collection</p><h2 id="collection-heading">Words and review state</h2></div>
          <label className="search-field"><span className="sr-only">Search vocabulary</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search words…" /></label>
        </div>
        <div className="filter-tabs" role="group" aria-label="Filter by vocabulary group">
          {filters.map((name) => <button className={filter === name ? "active" : ""} type="button" onClick={() => setFilter(name)} key={name}>{name}<span>{counts[name]}</span></button>)}
        </div>
        <div className="word-table" role="table" aria-label="Vocabulary items">
          <div className="word-table-head" role="row"><span>Word</span><span>Group</span><span>Stage</span><span>Next review</span><span>Action</span></div>
          {visibleItems.map((item) => (
            <div className="word-table-row" role="row" key={item.id}>
              <div><strong>{item.english_word}</strong><small>{item.translation}</small></div>
              <span><span className={`group-badge ${item.current_group}`}>{item.current_group}</span></span>
              <span>{item.repetition_stage === 0 ? "—" : `${item.repetition_stage} / 5`}</span>
              <span>{formatDueDate(item.next_review_date)}</span>
              <span>{item.current_group === "unknown" || (item.current_group === "learning" && item.repetition_stage === 0) ? <button className="table-action" type="button" disabled={pending} onClick={() => study(item)}>{item.current_group === "unknown" ? "Start learning" : "Study"}</button> : <span className="scheduled-label">Scheduled</span>}</span>
            </div>
          ))}
          {visibleItems.length === 0 ? <div className="empty-state"><strong>No words here yet.</strong><p>Add a word or adjust your filters.</p></div> : null}
        </div>
      </section>
    </div>
  );
}
