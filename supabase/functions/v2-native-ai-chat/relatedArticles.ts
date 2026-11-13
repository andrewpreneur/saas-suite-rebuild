/** A related article needs this many title tokens in the customer's question. */
export const MIN_DIRECT_TITLE_MATCHES = 2;

// Function words, plus generic help-title words. One of these, or a single
// specific word, is not enough to call an article related. Ported from
// software-onboarding PR #6 (b877c172). The check runs after stemming, so
// "workflows", "emails", "accounts", and "settings" do not count either.
const ARTICLE_STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "could",
  "from",
  "have",
  "help",
  "into",
  "just",
  "need",
  "please",
  "that",
  "their",
  "there",
  "these",
  "this",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "your",
  "workflow",
  "email",
  "account",
  "setting",
  "action",
  "trigger",
  "contact",
  "integration",
]);

export const normalizeArticleToken = (word: string) => {
  if (word.endsWith("ies") && word.length > 5) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ing") && word.length > 6) {
    const root = word.slice(0, -3);
    return root.length > 1 && root.at(-1) === root.at(-2) ? root.slice(0, -1) : root;
  }
  if (word.endsWith("ed") && word.length > 5) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 4) return word.slice(0, -1);
  return word;
};

export const articleTokens = (value: string) => {
  const tokens = new Set<string>();
  for (const word of value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)) {
    if (word.length < 4) continue;
    const token = normalizeArticleToken(word);
    if (token.length < 4 || ARTICLE_STOP_WORDS.has(token)) continue;
    tokens.add(token);
  }
  return tokens;
};

export const directTitleMatches = (
  titleTokens: ReadonlySet<string>,
  questionTokens: ReadonlySet<string>,
) => {
  let matches = 0;
  for (const token of titleTokens) if (questionTokens.has(token)) matches += 1;
  return matches;
};

/** True when the title and question share at least two non-generic words. */
export const hasRelatedTitle = (title: string, question: string) =>
  directTitleMatches(articleTokens(title), articleTokens(question)) >= MIN_DIRECT_TITLE_MATCHES;
