"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  analyzeSpeakingAttemptAction,
  beginSpeakingAttemptAction,
} from "@/app/actions/speaking";
import {
  MAX_SPEAKING_SECONDS,
  SPEAKING_SAMPLE_RATE,
  prepareSpeakingAudio,
} from "@/lib/speaking/audio";
import type { SpeakingAttempt, SpeakingPrompt } from "@/lib/speaking/types";
import { createClient } from "@/lib/supabase/client";

type SpeakingPhase =
  | "idle"
  | "requesting"
  | "recording"
  | "uploading"
  | "analyzing"
  | "completed"
  | "failed";

type RecorderRuntime = {
  context: AudioContext;
  processor: ScriptProcessorNode;
  source: MediaStreamAudioSourceNode;
  silentGain: GainNode;
  stream: MediaStream;
  chunks: Float32Array[];
  startedAt: number;
};

function phaseForAttempt(attempt: SpeakingAttempt | null): SpeakingPhase {
  if (attempt?.analysis_status === "completed") return "completed";
  if (attempt) return "failed";
  return "idle";
}

function releaseRecorder(runtime: RecorderRuntime) {
  runtime.processor.onaudioprocess = null;
  runtime.source.disconnect();
  runtime.processor.disconnect();
  runtime.silentGain.disconnect();
  runtime.stream.getTracks().forEach((track) => track.stop());
  void runtime.context.close();
}

function isDuplicateUpload(error: { message?: string; statusCode?: string | number }) {
  return error.statusCode === 409
    || error.statusCode === "409"
    || /duplicate|already exists/i.test(error.message ?? "");
}

function formatRecordingTime(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = String(wholeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function SpeakingWorkspace({
  prompt,
  initialAttempt,
  loadError,
}: {
  prompt: SpeakingPrompt | null;
  initialAttempt: SpeakingAttempt | null;
  loadError: string;
}) {
  const [attempt, setAttempt] = useState(initialAttempt);
  const [phase, setPhase] = useState<SpeakingPhase>(() => phaseForAttempt(initialAttempt));
  const [message, setMessage] = useState("");
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const runtimeRef = useRef<RecorderRuntime | null>(null);
  const timerRef = useRef<number | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  function clearTimer() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  useEffect(() => () => {
    clearTimer();
    if (runtimeRef.current) releaseRecorder(runtimeRef.current);
    runtimeRef.current = null;
  }, []);

  useEffect(() => {
    if (phase !== "completed") return;
    const frame = window.requestAnimationFrame(() => resultHeading.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  async function runAnalysis(attemptId: string) {
    setPhase("analyzing");
    setMessage("Your private recording is saved. SpeechKit is transcribing it now.");
    const result = await analyzeSpeakingAttemptAction(attemptId);
    if ("attempt" in result && result.attempt) setAttempt(result.attempt);
    if (result.ok && result.status === "completed" && result.attempt) {
      setMessage("");
      setPhase("completed");
      return;
    }
    setMessage(result.message ?? "The recording could not be analyzed. Please retry.");
    setPhase("failed");
  }

  async function finishRecording() {
    const runtime = runtimeRef.current;
    if (!runtime || !prompt) return;
    runtimeRef.current = null;
    clearTimer();
    releaseRecorder(runtime);

    const prepared = prepareSpeakingAudio(runtime.chunks, runtime.context.sampleRate);
    const maximumBytes = MAX_SPEAKING_SECONDS * SPEAKING_SAMPLE_RATE * 2;
    const pcm = prepared.pcm.slice(0, maximumBytes);
    const durationSeconds = Math.min(
      MAX_SPEAKING_SECONDS,
      pcm.byteLength / 2 / SPEAKING_SAMPLE_RATE,
    );
    if (durationSeconds < 1 || pcm.byteLength < 3_200) {
      setMessage("The recording was too short. Speak for at least one full second.");
      setPhase("failed");
      return;
    }

    setRecordedSeconds(Math.round(durationSeconds));
    setPhase("uploading");
    setMessage("Preparing a private upload for your recording.");
    const submissionId = crypto.randomUUID();
    const started = await beginSpeakingAttemptAction({
      promptId: prompt.id,
      submissionId,
      durationSeconds,
      audioBytes: pcm.byteLength,
    });
    if (!started.ok) {
      setMessage(started.message);
      setPhase("failed");
      return;
    }
    setAttempt(started.attempt);

    const body = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength) as ArrayBuffer;
    const { error } = await createClient().storage
      .from("speaking-audio")
      .upload(started.uploadPath, body, {
        contentType: "audio/l16",
        cacheControl: "0",
        upsert: false,
      });
    if (error && !isDuplicateUpload(error)) {
      setMessage("The private audio upload failed. Please record the passage again.");
      setPhase("failed");
      return;
    }

    await runAnalysis(started.attempt.id);
  }

  async function startRecording() {
    if (!prompt || phase === "requesting" || phase === "recording") return;
    setAttempt(null);
    setRecordedSeconds(0);
    setMessage("Allow microphone access to begin.");
    setPhase("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const context = new AudioContext();
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silentGain = context.createGain();
      silentGain.gain.value = 0;
      const chunks: Float32Array[] = [];
      processor.onaudioprocess = (event) => {
        chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);
      runtimeRef.current = {
        context,
        processor,
        source,
        silentGain,
        stream,
        chunks,
        startedAt: performance.now(),
      };
      setMessage("Read the five sentences aloud. The recording stops automatically after 2 minutes.");
      setPhase("recording");
      timerRef.current = window.setInterval(() => {
        const runtime = runtimeRef.current;
        if (!runtime) return;
        const elapsed = (performance.now() - runtime.startedAt) / 1000;
        setRecordedSeconds(Math.min(MAX_SPEAKING_SECONDS, Math.floor(elapsed)));
        if (elapsed >= MAX_SPEAKING_SECONDS) void finishRecording();
      }, 250);
    } catch {
      setMessage("Microphone access was not available. Check browser permission and try again.");
      setPhase("failed");
    }
  }

  if (loadError || !prompt) {
    return (
      <div className="page-container speaking-page">
        <section className="empty-review" role="alert">
          <p className="eyebrow">Daily speaking</p>
          <h1>Speaking is unavailable</h1>
          <p>{loadError || "Today’s prompt could not be prepared."}</p>
          <Link className="secondary-button" href="/dashboard">Back to today</Link>
        </section>
      </div>
    );
  }

  if (phase === "completed" && attempt?.transcript && attempt.score !== null) {
    const metrics = attempt.metrics;
    return (
      <div className="page-container speaking-page">
        <section className="speaking-result-heading">
          <div>
            <p className="eyebrow">Speaking complete</p>
            <h1 ref={resultHeading} tabIndex={-1}>Your voice is becoming clearer.</h1>
            <p>This score reflects recognized words, completeness, and pace—not phoneme-level pronunciation.</p>
          </div>
          <div className="speaking-score" aria-label={`Speaking score ${attempt.score} out of 100`}>
            <strong>{attempt.score}</strong><span>/ 100</span>
          </div>
        </section>

        <section className="speaking-metrics" aria-label="Speaking metrics">
          {[
            ["Completeness", metrics.completeness],
            ["Word match", metrics.wordAccuracy],
            ["Steady pace", metrics.fluency],
            ["Words / min", metrics.wordsPerMinute],
          ].map(([label, value]) => (
            <article className="panel-card" key={label}>
              <span>{label}</span><strong>{value ?? "—"}{label === "Words / min" ? "" : "%"}</strong>
            </article>
          ))}
        </section>

        <section className="speaking-comparison">
          <article className="panel-card speaking-text-card">
            <p className="eyebrow">Practice text</p>
            <p>{prompt.reference_text}</p>
          </article>
          <article className="panel-card speaking-text-card transcript">
            <p className="eyebrow">Recognized transcript</p>
            <p>{attempt.transcript}</p>
          </article>
        </section>

        <section className="speaking-feedback-grid">
          <article className="panel-card">
            <p className="eyebrow">What went well</p>
            <ul>{attempt.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
          <article className="panel-card">
            <p className="eyebrow">Try next</p>
            <ul>{attempt.improvements.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        </section>

        <div className="speaking-actions">
          <button className="secondary-button" type="button" onClick={() => {
            setAttempt(null);
            setPhase("idle");
            setMessage("");
            setRecordedSeconds(0);
          }}>Practice again</button>
          <Link className="primary-button compact" href="/dashboard">Back to today</Link>
        </div>
      </div>
    );
  }

  const analyzing = phase === "uploading" || phase === "analyzing";
  const canRetry = attempt
    && attempt.analysis_status === "failed"
    && !["storage_error", "invalid_audio"].includes(attempt.failure_code ?? "");

  return (
    <div className="page-container speaking-page">
      <section className="page-heading speaking-intro">
        <div>
          <p className="eyebrow">Daily speaking</p>
          <h1>Give English your voice.</h1>
          <p>Read today’s five sentences aloud. Focus on calm, complete phrases instead of perfect pronunciation.</p>
        </div>
        <div className="total-chip peach-chip"><strong>10</strong><span>min guide</span></div>
      </section>

      <section className="panel-card speaking-practice-card">
        <div className="panel-heading">
          <div><p className="eyebrow">Today’s passage · {prompt.cefr}</p><h2>Read at a comfortable pace</h2></div>
          <span className="panel-step">02</span>
        </div>
        <blockquote>{prompt.reference_text}</blockquote>

        <div className={`speaking-recorder ${phase === "recording" ? "recording" : ""}`}>
          <div className="speaking-orb" aria-hidden="true"><span>●</span></div>
          <div>
            <strong>{phase === "recording"
              ? `${formatRecordingTime(recordedSeconds)} / ${formatRecordingTime(MAX_SPEAKING_SECONDS)}`
              : "Up to 2 minutes"}</strong>
            <span>Mono audio · private storage</span>
          </div>
          {phase === "recording" ? (
            <button className="primary-button" type="button" onClick={() => void finishRecording()}>
              Stop and check
            </button>
          ) : (
            <button className="primary-button" type="button" disabled={phase === "requesting" || analyzing} onClick={() => void startRecording()}>
              {phase === "requesting" ? "Opening microphone…" : "Start recording"}
            </button>
          )}
        </div>

        <p className={phase === "failed" ? "form-message speaking-error" : "form-message"} role={phase === "failed" ? "alert" : "status"} aria-live="polite">
          {message || "Your audio stays private in Supabase and is sent to Yandex SpeechKit only for transcription."}
        </p>

        {phase === "failed" ? (
          <div className="saved-writing-actions">
            {canRetry ? (
              <button className="primary-button" type="button" onClick={() => void runAnalysis(attempt.id)}>Retry analysis</button>
            ) : null}
            <button className="secondary-button" type="button" onClick={() => void startRecording()}>Record again</button>
            <Link className="secondary-button" href="/dashboard">Back to today</Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
