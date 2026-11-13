type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

/** Consume provider SSE with chunk-boundary-safe framing and tool-call assembly. */
export async function readCompletion(response: Response, onText: (text: string) => void) {
  if (!response.body) throw new Error("The AI returned no response stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", content = "";
  const calls = new Map<number, ToolCall>();
  const consume = (line: string) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    const event = JSON.parse(data);
    if (event.error) throw new Error(event.error.message || "AI response failed.");
    const delta = event.choices?.[0]?.delta;
    if (!delta) return;
    if (typeof delta.content === "string") { content += delta.content; onText(delta.content); }
    for (const part of delta.tool_calls || []) {
      const call = calls.get(part.index) || { id: "", type: "function" as const, function: { name: "", arguments: "" } };
      if (part.id) call.id = part.id;
      if (part.function?.name) call.function.name += part.function.name;
      if (part.function?.arguments) call.function.arguments += part.function.arguments;
      calls.set(part.index, call);
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let end: number;
      while ((end = buffer.indexOf("\n")) >= 0) { consume(buffer.slice(0, end).trimEnd()); buffer = buffer.slice(end + 1); }
      if (done) { if (buffer.trim()) consume(buffer.trimEnd()); break; }
    }
  } finally { reader.releaseLock(); }
  return { role: "assistant" as const, content, ...(calls.size ? { tool_calls: [...calls.values()] } : {}) };
}