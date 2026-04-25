import type { Message } from "../../../types";
import { API_URL } from "../../../config/constants";
import { readQuerySseStream } from "../api/readQuerySseStream";
import { formatMessageTime } from "../lib/formatTime";

type UpdateFn = (m: Message[]) => void;

export async function runStreamedTextQuery(
  newMessages: Message[],
  question: string,
  useLightRAG: boolean,
  sessionId: string,
  updateCurrentChat: UpdateFn
): Promise<void> {
  const body = { question, useLightRAG, k: 4, sessionId };
  const response = await fetch(`${API_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");
  const assistantMsg: Message = { role: "assistant", text: "", time: formatMessageTime(), metadata: {} };
  const messagesWithAssistant = [...newMessages, assistantMsg];
  updateCurrentChat(messagesWithAssistant);
  let accumulatedAnswer = "";
  let metadata: { docs?: unknown[]; usedLightRAG?: boolean } = {};
  await readQuerySseStream(
    reader,
    (token) => {
      accumulatedAnswer += token;
      updateCurrentChat([
        ...messagesWithAssistant.slice(0, -1),
        { ...assistantMsg, text: accumulatedAnswer },
      ]);
    },
    (complete) => {
      metadata = complete;
    }
  );
  updateCurrentChat([
    ...messagesWithAssistant.slice(0, -1),
    {
      ...assistantMsg,
      text: accumulatedAnswer,
      metadata: { docsUsed: metadata.docs?.length, usedLightRAG: metadata.usedLightRAG },
    },
  ]);
}
