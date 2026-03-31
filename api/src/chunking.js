const TOKENS_PER_CHUNK = 512;
const OVERLAP_TOKENS = 50;
const SENTENCES_BUFFER = 2;

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function splitBySentences(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.map(s => s.trim());
}

function splitByParagraphs(text) {
  return text.split(/\n\n+/).filter(p => p.trim());
}

export function chunkText(text, maxTokens = TOKENS_PER_CHUNK) {
  if (!text || !text.trim()) return [];

  const chunks = [];
  let currentChunk = '';
  let chunkStartChar = 0;

  const paragraphs = splitByParagraphs(text);

  for (const paragraph of paragraphs) {
    const sentences = splitBySentences(paragraph);

    for (const sentence of sentences) {
      const sentenceTokens = estimateTokens(sentence);
      const currentTokens = estimateTokens(currentChunk);

      if (currentTokens + sentenceTokens > maxTokens && currentChunk.trim()) {
        chunks.push({
          text: currentChunk.trim(),
          tokens: currentTokens,
          startChar: chunkStartChar,
          endChar: chunkStartChar + currentChunk.length
        });

        const previousSentences = splitBySentences(currentChunk);
        const overlapSentences = previousSentences.slice(-SENTENCES_BUFFER).join(' ');
        currentChunk = overlapSentences + ' ' + sentence;
        chunkStartChar += currentChunk.length;
      } else {
        currentChunk += (currentChunk.trim() ? ' ' : '') + sentence.trim();
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      tokens: estimateTokens(currentChunk),
      startChar: chunkStartChar,
      endChar: chunkStartChar + currentChunk.length
    });
  }

  return chunks;
}

export function smartChunk(text, maxTokens = TOKENS_PER_CHUNK) {
  if (!text || !text.trim()) return [];

  const chunks = [];
  const sections = text.split(/^#+\s+/m);

  let globalChunkIndex = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;

    const sectionTokens = estimateTokens(section);
    if (sectionTokens <= maxTokens) {
      chunks.push({
        text: section,
        tokens: sectionTokens,
        section: i > 0 ? `Section ${i}` : 'Introduction',
        chunkIndex: globalChunkIndex++,
        startChar: text.indexOf(section),
        endChar: text.indexOf(section) + section.length
      });
      continue;
    }

    const paragraphs = section.split(/\n\n+/).filter(p => p.trim());
    let currentChunk = '';

    for (const para of paragraphs) {
      const paraTokens = estimateTokens(para);
      const currentTokens = estimateTokens(currentChunk);

      if (currentTokens + paraTokens > maxTokens && currentChunk.trim()) {
        chunks.push({
          text: currentChunk.trim(),
          tokens: currentTokens,
          chunkIndex: globalChunkIndex++,
          startChar: text.indexOf(currentChunk),
          endChar: text.indexOf(currentChunk) + currentChunk.length
        });
        currentChunk = para;
      } else {
        currentChunk += (currentChunk.trim() ? '\n\n' : '') + para;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        tokens: estimateTokens(currentChunk),
        chunkIndex: globalChunkIndex++,
        startChar: text.indexOf(currentChunk),
        endChar: text.indexOf(currentChunk) + currentChunk.length
      });
    }
  }

  return chunks;
}

export function mergeSmallChunks(chunks, minTokens = 100) {
  if (!chunks.length) return chunks;

  const merged = [];
  let current = chunks[0];

  for (let i = 1; i < chunks.length; i++) {
    const nextChunk = chunks[i];
    const combinedTokens = current.tokens + nextChunk.tokens;

    if (combinedTokens <= TOKENS_PER_CHUNK && current.tokens < minTokens) {
      current = {
        ...current,
        text: current.text + '\n\n' + nextChunk.text,
        tokens: combinedTokens,
        endChar: nextChunk.endChar
      };
    } else {
      merged.push(current);
      current = nextChunk;
    }
  }

  merged.push(current);
  return merged;
}

export default {
  chunkText,
  smartChunk,
  mergeSmallChunks,
  estimateTokens
};
