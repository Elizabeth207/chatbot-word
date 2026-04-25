export function smartChunk(text, maxChunkSize = 1024) {
  const chunks = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = "";

  for (const para of paragraphs) {
    if ((currentChunk + para).length > maxChunkSize && currentChunk) {
      chunks.push({ text: currentChunk.trim(), tokens: Math.ceil(currentChunk.length / 4) });
      currentChunk = "";
    }
    currentChunk += (currentChunk ? "\n\n" : "") + para;
  }

  if (currentChunk) {
    chunks.push({ text: currentChunk.trim(), tokens: Math.ceil(currentChunk.length / 4) });
  }

  return chunks;
}

export function chunkText(text, size = 1024) {
  return smartChunk(text, size);
}

export function mergeSmallChunks(chunks, minSize = 100) {
  if (chunks.length <= 1) return chunks;

  const merged = [];
  let current = chunks[0];

  for (let i = 1; i < chunks.length; i++) {
    const next = chunks[i];
    if (current.text.length < minSize) {
      current = { text: current.text + "\n\n" + next.text, tokens: current.tokens + next.tokens };
    } else {
      merged.push(current);
      current = next;
    }
  }

  if (current) merged.push(current);
  return merged;
}
