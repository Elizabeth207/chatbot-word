export async function readQuerySseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onToken: (t: string) => void,
  onComplete: (meta: { docs?: unknown[]; usedLightRAG?: boolean }) => void
): Promise<void> {
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6)) as {
          token?: string;
          complete?: { docs?: unknown[]; usedLightRAG?: boolean };
        };
        if (data.token) onToken(data.token);
        else if (data.complete) onComplete(data.complete);
      } catch {
        /* ignore */
      }
    }
  }
}
