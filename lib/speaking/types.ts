export type SpeakingAnalysisStatus = "pending" | "processing" | "completed" | "failed";

export type SpeakingFailureCode =
  | "provider_timeout"
  | "provider_unavailable"
  | "provider_error"
  | "configuration"
  | "invalid_audio"
  | "no_speech"
  | "storage_error"
  | "persistence_error";

export type SpeakingPrompt = {
  id: string;
  user_id: string;
  prompt_date: string;
  reference_text: string;
  cefr: string;
  created_at: string;
};

export type SpeakingMetrics = {
  completeness: number;
  wordAccuracy: number;
  fluency: number;
  wordsPerMinute: number;
  referenceWords: number;
  transcriptWords: number;
};

export type SpeakingAttempt = {
  id: string;
  submission_id: string;
  user_id: string;
  prompt_id: string;
  attempt_date: string;
  audio_path: string;
  audio_format: "lpcm16-16000-mono";
  audio_bytes: number;
  duration_seconds: number;
  analysis_status: SpeakingAnalysisStatus;
  transcript: string | null;
  score: number | null;
  strengths: string[];
  improvements: string[];
  metrics: Partial<SpeakingMetrics>;
  failure_code: SpeakingFailureCode | null;
  provider: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
};
