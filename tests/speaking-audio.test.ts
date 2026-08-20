import { describe, expect, it } from "vitest";
import {
  MAX_SPEAKING_BYTES,
  SPEAKING_SAMPLE_RATE,
  downsampleMono,
  encodePcm16,
  mergeAudioChunks,
  prepareSpeakingAudio,
} from "../lib/speaking/audio";

describe("browser speaking audio preparation", () => {
  it("merges captured chunks without changing their order", () => {
    expect(Array.from(mergeAudioChunks([
      new Float32Array([0.1, 0.2]),
      new Float32Array([0.3]),
    ]))).toEqual(expect.arrayContaining([
      expect.closeTo(0.1),
      expect.closeTo(0.2),
      expect.closeTo(0.3),
    ]));
  });

  it("downsamples common browser audio to SpeechKit 16 kHz mono", () => {
    const input = new Float32Array(48_000).fill(0.25);
    const output = downsampleMono(input, 48_000);
    expect(output).toHaveLength(SPEAKING_SAMPLE_RATE);
    expect(output[8_000]).toBeCloseTo(0.25);
  });

  it("encodes clipped little-endian signed PCM16", () => {
    const encoded = encodePcm16(new Float32Array([-2, 0, 2]));
    const view = new DataView(encoded.buffer);
    expect(view.getInt16(0, true)).toBe(-32768);
    expect(view.getInt16(2, true)).toBe(0);
    expect(view.getInt16(4, true)).toBe(32767);
  });

  it("keeps a 28 second recording below the synchronous API byte limit", () => {
    const input = new Float32Array(48_000 * 28).fill(0.05);
    const prepared = prepareSpeakingAudio([input], 48_000);
    expect(prepared.durationSeconds).toBe(28);
    expect(prepared.pcm.byteLength).toBe(896_000);
    expect(prepared.pcm.byteLength).toBeLessThan(MAX_SPEAKING_BYTES);
  });
});
