import { MAX_SPEAKING_BYTES } from "../speaking/audio";
import type { SpeakingFailureCode } from "../speaking/types";

export const SPEAKING_PROVIDER_ID = "yandex_speechkit";
export const SPEAKING_MODEL_ID = "general-en-us-v1";
const SPEECHKIT_CHUNK_BYTES = 28 * 16_000 * 2;

export class SpeakingProviderError extends Error {
  constructor(
    public readonly code: SpeakingFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "SpeakingProviderError";
  }
}
function parseTimeout(value: string | undefined) {
  const parsed = Number(value ?? "30000");
  if (!Number.isFinite(parsed)) return 30_000;
  return Math.min(60_000, Math.max(1_000, Math.round(parsed)));
}

export function buildSpeechRecognitionUrl() {
  const parameters = new URLSearchParams({
    topic: "general",
    lang: "en-US",
    format: "lpcm",
    sampleRateHertz: "16000",
  });
  return `https://stt.api.cloud.yandex.net/speech/v1/stt:recognize?${parameters}`;
}

export async function transcribeSpeakingAudio(
  audio: Uint8Array,
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    fixtureTranscript?: string;
  } = {},
) {
  if (audio.byteLength < 3_200 || audio.byteLength > MAX_SPEAKING_BYTES) {
    throw new SpeakingProviderError("invalid_audio", "Speaking audio is outside the supported size.");
  }

  const env = options.env ?? process.env;
  const provider = env.SPEAKING_STT_PROVIDER ?? "yandex";
  if (provider === "fixture") {
    if ((env.NODE_ENV ?? process.env.NODE_ENV) === "production") {
      throw new SpeakingProviderError("configuration", "Fixture transcription is disabled in production.");
    }
    const transcript = options.fixtureTranscript?.trim();
    if (!transcript) throw new SpeakingProviderError("no_speech", "The fixture returned no speech.");
    return { transcript, provider: "fixture", model: "deterministic-v1" };
  }
  if (provider !== "yandex") {
    throw new SpeakingProviderError("configuration", "Speaking transcription is not configured.");
  }

  const apiKey = env.YANDEX_AI_API_KEY?.trim();
  if (!apiKey) {
    throw new SpeakingProviderError("configuration", "Yandex SpeechKit credentials are missing.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), parseTimeout(env.SPEAKING_STT_TIMEOUT_MS));
  try {
    const chunks: Uint8Array[] = [];
    for (let offset = 0; offset < audio.byteLength; offset += SPEECHKIT_CHUNK_BYTES) {
      chunks.push(audio.subarray(offset, Math.min(offset + SPEECHKIT_CHUNK_BYTES, audio.byteLength)));
    }

    const transcripts = await Promise.all(chunks.map(async (chunk) => {
      const body = chunk.buffer.slice(
        chunk.byteOffset,
        chunk.byteOffset + chunk.byteLength,
      ) as ArrayBuffer;
      const response = await (options.fetchImpl ?? fetch)(buildSpeechRecognitionUrl(), {
        method: "POST",
        headers: {
          Authorization: `Api-Key ${apiKey}`,
          "Content-Type": "application/octet-stream",
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const code = response.status === 429 || response.status >= 500
          ? "provider_unavailable"
          : response.status === 400
            ? "invalid_audio"
            : "provider_error";
        throw new SpeakingProviderError(code, "Yandex SpeechKit did not accept the recording.");
      }

      const payload: unknown = await response.json();
      const result = typeof payload === "object" && payload !== null
        ? (payload as { result?: unknown }).result
        : null;
      return typeof result === "string" ? result.trim() : "";
    }));
    const transcript = transcripts.filter(Boolean).join(" ");
    if (!transcript) {
      throw new SpeakingProviderError("no_speech", "No English speech was recognized.");
    }
    if (transcript.length > 5_000) {
      throw new SpeakingProviderError("provider_error", "The transcript was unexpectedly long.");
    }

    return {
      transcript,
      provider: SPEAKING_PROVIDER_ID,
      model: SPEAKING_MODEL_ID,
    };
  } catch (error) {
    if (error instanceof SpeakingProviderError) throw error;
    if (controller.signal.aborted) {
      throw new SpeakingProviderError("provider_timeout", "Speech recognition timed out.");
    }
    throw new SpeakingProviderError("provider_unavailable", "Speech recognition is unavailable.");
  } finally {
    clearTimeout(timeout);
  }
}
