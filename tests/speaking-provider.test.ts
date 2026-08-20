import { describe, expect, it, vi } from "vitest";
import {
  SpeakingProviderError,
  buildSpeechRecognitionUrl,
  transcribeSpeakingAudio,
} from "../lib/ai/speaking-provider";

const audio = new Uint8Array(3_200).fill(1);

describe("Yandex SpeechKit provider", () => {
  it("uses the documented English LPCM 16 kHz synchronous endpoint", () => {
    const url = new URL(buildSpeechRecognitionUrl());
    expect(url.hostname).toBe("stt.api.cloud.yandex.net");
    expect(url.pathname).toBe("/speech/v1/stt:recognize");
    expect(url.searchParams.get("lang")).toBe("en-US");
    expect(url.searchParams.get("format")).toBe("lpcm");
    expect(url.searchParams.get("sampleRateHertz")).toBe("16000");
  });

  it("keeps the API key server-side and accepts a transcript", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ result: "Today is a good day to practice English." }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    const result = await transcribeSpeakingAudio(audio, {
      env: { SPEAKING_STT_PROVIDER: "yandex", YANDEX_AI_API_KEY: "test-key" },
      fetchImpl,
    });

    expect(result.provider).toBe("yandex_speechkit");
    expect(result.transcript).toMatch(/good day/i);
    const [, init] = fetchImpl.mock.calls[0];
    expect(init?.headers).toMatchObject({
      Authorization: "Api-Key test-key",
      "Content-Type": "application/octet-stream",
    });
  });

  it("splits a two-minute recording into provider-safe chunks and joins transcripts", async () => {
    const longAudio = new Uint8Array(3_840_000).fill(1);
    const fetchImpl = vi.fn<typeof fetch>()
      .mockImplementation(async (_url, init) => {
        const body = init?.body as ArrayBuffer;
        expect(body.byteLength).toBeLessThanOrEqual(896_000);
        return new Response(
          JSON.stringify({ result: `part ${fetchImpl.mock.calls.length}` }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

    const result = await transcribeSpeakingAudio(longAudio, {
      env: { SPEAKING_STT_PROVIDER: "yandex", YANDEX_AI_API_KEY: "test-key" },
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(result.transcript).toBe("part 1 part 2 part 3 part 4 part 5");
  });

  it("supports a deterministic non-production fixture", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await transcribeSpeakingAudio(audio, {
      env: { SPEAKING_STT_PROVIDER: "fixture", NODE_ENV: "test" },
      fetchImpl,
      fixtureTranscript: "A local speaking transcript.",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.transcript).toBe("A local speaking transcript.");
  });

  it("rejects empty recognition and production fixtures", async () => {
    const emptyFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ result: "" }),
      { status: 200 },
    ));
    await expect(transcribeSpeakingAudio(audio, {
      env: { SPEAKING_STT_PROVIDER: "yandex", YANDEX_AI_API_KEY: "test-key" },
      fetchImpl: emptyFetch,
    })).rejects.toMatchObject({ code: "no_speech" } satisfies Partial<SpeakingProviderError>);

    await expect(transcribeSpeakingAudio(audio, {
      env: { SPEAKING_STT_PROVIDER: "fixture", NODE_ENV: "production" },
      fixtureTranscript: "Not allowed.",
    })).rejects.toMatchObject({ code: "configuration" } satisfies Partial<SpeakingProviderError>);
  });

  it("rejects audio outside the provider limit before making a request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(transcribeSpeakingAudio(new Uint8Array(2), {
      env: { SPEAKING_STT_PROVIDER: "yandex", YANDEX_AI_API_KEY: "test-key" },
      fetchImpl,
    })).rejects.toMatchObject({ code: "invalid_audio" } satisfies Partial<SpeakingProviderError>);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
