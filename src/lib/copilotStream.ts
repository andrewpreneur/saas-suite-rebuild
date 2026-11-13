export type CopilotEvent = { type: "delta"; text: string } | { type: "working" } | { type: "replace"; text: string } | { type: "done"; actions?: unknown[]; handover?: boolean; needsHelp?: boolean; id?: string } | { type: "error"; message: string; status?: number };

export async function consumeCopilotStream(response: Response, onEvent: (event: CopilotEvent) => void): Promise<void> {
  if (!response.body) throw new Error("The reply was interrupted.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  const consume = (line: string) => {
    if (!line.startsWith("data:")) return;
    const event = JSON.parse(line.slice(5).trim()) as CopilotEvent;
    if (event.type === "error") throw new Error(event.message || "The reply was interrupted.");
    if (event.type === "done") completed = true;
    onEvent(event);
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        consume(buffer.slice(0, newline).trimEnd());
        buffer = buffer.slice(newline + 1);
        if (completed) break;
      }
      // done is the application completion boundary. The HTTP connection may
      // stay open while the server finishes background work; never lock the UI
      // waiting for that transport-level close or accept events after done.
      if (completed) {
        void reader.cancel().catch(() => {});
        break;
      }
      if (done) { if (buffer.trim()) consume(buffer.trimEnd()); break; }
    }
    if (!completed) throw new Error("The reply was interrupted. Please send a new message to continue.");
  } finally { reader.releaseLock(); }
}