export const SPEAKING_SAMPLE_RATE = 16_000;
export const MAX_SPEAKING_SECONDS = 28;
export const MAX_SPEAKING_BYTES = 1_000_000;

export function mergeAudioChunks(chunks: readonly Float32Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

export function downsampleMono(
  input: Float32Array,
  inputRate: number,
  outputRate = SPEAKING_SAMPLE_RATE,
) {
  if (!Number.isFinite(inputRate) || inputRate <= 0 || outputRate <= 0) {
    throw new Error("Audio sample rate is invalid.");
  }
  if (input.length === 0) return new Float32Array();
  if (inputRate === outputRate) return input.slice();

  const outputLength = Math.max(1, Math.floor(input.length * outputRate / inputRate));
  const output = new Float32Array(outputLength);
  const ratio = inputRate / outputRate;
  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const fraction = position - left;
    output[index] = input[left] * (1 - fraction) + input[right] * fraction;
  }
  return output;
}

export function encodePcm16(samples: Float32Array) {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    const value = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(index * 2, Math.round(value), true);
  }
  return bytes;
}

export function prepareSpeakingAudio(
  chunks: readonly Float32Array[],
  inputRate: number,
) {
  const merged = mergeAudioChunks(chunks);
  const downsampled = downsampleMono(merged, inputRate);
  const pcm = encodePcm16(downsampled);
  const durationSeconds = downsampled.length / SPEAKING_SAMPLE_RATE;
  return { pcm, durationSeconds };
}
