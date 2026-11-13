export interface ExportMsg {
  id: string;
  owner_email: string;
  role: string;
  content: string;
  created_at: string;
}

export const EDIT_COLUMNS = ["instruction", "trigger_question", "ideal_answer"] as const;

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per Copilot answer, paired with the question before it, plus blank edit columns to fill in. */
export function buildChatsCsv(messages: ExportMsg[], ratings: Record<string, string>) {
  const header = ["conversation_email", "message_id", "asked_at", "trigger_question", "copilot_answer", "rating", "instruction", "ideal_answer"];
  const rows: string[] = [header.join(",")];
  const byEmail = new Map<string, ExportMsg[]>();
  for (const m of messages) {
    const k = (m.owner_email || "").toLowerCase();
    if (!byEmail.has(k)) byEmail.set(k, []);
    byEmail.get(k)!.push(m);
  }
  for (const [email, list] of byEmail) {
    const sorted = [...list].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    let lastQ = "";
    for (const m of sorted) {
      if (m.role === "user") { lastQ = m.content || ""; continue; }
      if (m.role !== "assistant") continue;
      rows.push([email, m.id, m.created_at, lastQ, m.content, ratings[m.id] || "", "", ""].map(esc).join(","));
    }
  }
  return rows.join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Accepts the exported file (fills instruction and/or ideal_answer) or a simple instruction/trigger_question/ideal_answer sheet. */
export function csvToPromptEdits(text: string) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const h = rows[0].map((x) => x.trim().toLowerCase());
  const idx = (n: string) => h.indexOf(n);
  const iI = idx("instruction"), iQ = idx("trigger_question"), iA = idx("ideal_answer");
  if (iI < 0 && iA < 0) throw new Error('File needs an "instruction" or "ideal_answer" column');
  return rows.slice(1).map((r) => {
    const instruction = (iI >= 0 ? r[iI] : "")?.trim() || "";
    const trigger_question = (iQ >= 0 ? r[iQ] : "")?.trim() || null;
    const ideal_answer = (iA >= 0 ? r[iA] : "")?.trim() || null;
    return {
      instruction: instruction || (ideal_answer ? "Answer questions like this one with the ideal answer below." : ""),
      trigger_question: ideal_answer || instruction ? trigger_question : null,
      ideal_answer,
    };
  }).filter((e) => e.instruction);
}
