/**
 * Knowledge-base grounding for AI drafts — pure functions, no I/O.
 *
 * HONEST LIMITATION: this is simple keyword-overlap scoring against
 * published articles, NOT a vector/embedding search. It finds articles
 * whose words overlap the customer's latest message; it cannot do
 * semantic matching, and a low score means "no article matches" rather
 * than "no answer exists". When nothing matches, the draft prompt
 * instructs the model to say so and recommend a human — never to
 * invent business facts.
 */

export interface GroundingArticle {
  id: string;
  title: string | null;
  slug: string | null;
  content: string | null;
}

/** Prefix marking the single current AI summary of a conversation. */
export const AI_SUMMARY_PREFIX = "[AI summary]";

/** Words too common to count as evidence of a match. */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "i", "you", "we", "my", "your", "it", "this",
  "that", "please", "hello", "hi", "thanks", "thank",
  "die", "der", "das", "und", "ist", "ein", "eine", "ich", "mit", "für",
  "von", "zu", "bitte", "hallo", "danke",
  "je", "le", "la", "les", "des", "une", "et", "pour", "avec", "est",
  "vous", "merci", "bonjour", "dans", "sur", "pas", "qui", "que",
  "il", "lo", "la", "gli", "le", "di", "che", "per", "con", "una",
  "sono", "ho", "grazie", "ciao", "non", "mi", "si",
]);

/** Lower-cased content words (length ≥ 3, stopwords removed). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // Latin-1 letters/digits instead of \p{L}\p{N}: tsconfig targets
    // ES5, which rejects the unicode regex flag.
    .split(/[^a-z0-9À-ÿ]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

export interface RankedArticle extends GroundingArticle {
  /** Number of distinct query words found in title + content. */
  score: number;
}

/**
 * Rank published articles by distinct-word overlap with the query
 * (latest customer message). Title matches count double. Returns the
 * best matches first; articles with score 0 are excluded.
 */
export function rankArticlesForGrounding(
  query: string,
  articles: GroundingArticle[],
  limit = 3,
): RankedArticle[] {
  const queryWords = Array.from(new Set(tokenize(query)));
  if (queryWords.length === 0) return [];

  const ranked: RankedArticle[] = [];
  for (const article of articles) {
    const titleWords = new Set(tokenize(article.title ?? ""));
    const contentWords = new Set(tokenize(article.content ?? ""));
    let score = 0;
    for (const word of queryWords) {
      if (titleWords.has(word)) score += 2;
      else if (contentWords.has(word)) score += 1;
    }
    if (score > 0) ranked.push({ ...article, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  de: "German",
  fr: "French",
  it: "Italian",
};

/**
 * Build the draft prompt. The model must answer ONLY from the given
 * articles, in the customer's language. When no article matched, the
 * prompt says so explicitly and instructs the model to say the
 * knowledge base has no answer and recommend a human — never invent.
 */
export function buildDraftPrompt(
  customerLanguage: string,
  recentMessages: { sender_type: string; body: string }[],
  matchedArticles: RankedArticle[],
): { system: string; user: string } {
  const languageName = LANGUAGE_NAMES[customerLanguage] ?? "English";
  const thread = recentMessages
    .map((m) => `${m.sender_type === "customer" ? "Customer" : "Agent"}: ${m.body}`)
    .join("\n");

  const system =
    `You draft customer-support replies for LinguaDesk AI. ` +
    `Answer ONLY using the knowledge-base excerpts below, in ${languageName}. ` +
    `Do not invent prices, policies, dates, or any other business fact that is not in the excerpts. ` +
    `If the excerpts do not answer the customer's question, say plainly that the knowledge base has no answer ` +
    `and that a human agent will follow up — do not guess. ` +
    `Keep the reply short, polite, and in the customer's language (${languageName}). ` +
    `Write only the reply itself, no preamble and no explanation of what you did.`;

  const excerpts =
    matchedArticles.length > 0
      ? matchedArticles
          .map((a) => `--- Article: ${a.title ?? "Untitled"}\n${(a.content ?? "").slice(0, 3000)}`)
          .join("\n\n")
      : "(No knowledge-base article matched the customer's question.)";

  const user =
    `Knowledge-base excerpts:\n${excerpts}\n\n` +
    `Recent conversation (latest last):\n${thread}\n\n` +
    `Draft a reply to the customer's latest message.`;
  return { system, user };
}

/** Prompt for translating a text into a target language. */
export function buildTranslatePrompt(text: string, targetLanguage: string): { system: string; user: string } {
  const languageName = LANGUAGE_NAMES[targetLanguage] ?? "English";
  return {
    system:
      `You translate customer-support messages. Translate the given text into ${languageName}. ` +
      `Preserve the meaning, tone, and formatting exactly; do not add, remove, or explain anything. ` +
      `Return only the translation, nothing else.`,
    user: text,
  };
}

/** Prompt for summarizing a conversation thread. */
export function buildSummarizePrompt(
  messages: { sender_type: string; body: string }[],
): { system: string; user: string } {
  const thread = messages
    .map((m) => `${m.sender_type === "customer" ? "Customer" : m.sender_type === "agent" ? "Agent" : "Note"}: ${m.body}`)
    .join("\n");
  return {
    system:
      `You summarize customer-support conversations for the support team. ` +
      `Write a short summary (3–6 sentences): what the customer asked, what was already answered, ` +
      `and what still needs a human. Stick strictly to the thread — do not invent facts. ` +
      `Write the summary in English. Return only the summary, nothing else.`,
    user: `Conversation thread (oldest first):\n${thread}`,
  };
}
