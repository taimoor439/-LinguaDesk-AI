/**
 * Heuristic language detection for EN / DE / FR / IT.
 *
 * HONEST LIMITATION: this is a small word-list heuristic, NOT a language
 * model or a statistical detector. It scores whole-word matches against
 * common-word lists per language, plus a small bonus for language-specific
 * characters (ß/ä/ö/ü → German, é/è/ç → French, ì/ò/ù → Italian). Short,
 * ambiguous, or mixed-language text will often be wrong, and anything
 * outside the four supported languages falls back to 'en'. It exists so
 * the widget can store a better-than-blind language guess on incoming
 * visitor messages without an API call; it must never be presented as
 * certain. The AI draft flow answers in the conversation's stored
 * language, and agents can correct it.
 *
 * Pure function — no imports, no I/O — so it can be unit-tested directly.
 */

export type SupportedLanguage = "en" | "de" | "fr" | "it";

/** word → weight. Distinctive words score 3, common words 1–2. */
const WORDS: Record<SupportedLanguage, Record<string, number>> = {
  en: {
    the: 2, i: 1, you: 2, my: 2, hello: 3, hi: 2, thank: 3, thanks: 3,
    please: 3, help: 2, order: 2, delivery: 2, address: 3, change: 2,
    question: 2, would: 2, like: 2, need: 2, when: 2, will: 2, very: 2,
    much: 2, today: 2, your: 2, have: 2, with: 1, for: 1, and: 1, is: 1,
    it: 1, to: 1, me: 1, can: 2, arrive: 2, sorry: 2, want: 2, know: 2,
    how: 2, what: 2, where: 2, about: 1, this: 1, that: 1,
    refund: 3, invoice: 2, payment: 2, shipping: 2, tracking: 2,
  },
  de: {
    ich: 3, nicht: 3, und: 2, die: 2, der: 2, das: 2, ist: 2, ein: 2,
    eine: 2, danke: 3, hallo: 3, bitte: 2, haben: 2, mit: 2, für: 3,
    von: 2, zu: 2, meine: 2, möchten: 3, brauche: 3, hilfe: 3, frage: 2,
    rechnung: 3, lieferadresse: 3, ändern: 3, vielen: 3, wann: 2,
    wird: 2, sie: 2, es: 2, auch: 1, sehr: 1, gut: 1, kann: 2, oder: 1,
    aber: 1, wenn: 1, dann: 1, noch: 1, schon: 1, hier: 1, bestellung: 3,
    geliefert: 3, lieferung: 3, adresse: 2, entschuldigung: 3,
    gerne: 2, heute: 2,
  },
  fr: {
    je: 3, vous: 3, nous: 3, merci: 3, bonjour: 3, avec: 2, pour: 2,
    les: 2, des: 2, une: 2, être: 3, besoin: 3, aide: 3, commande: 3,
    facture: 3, livraison: 3, adresse: 3, changer: 3, voudrais: 3,
    question: 2, quand: 2, sera: 3, livrée: 3, beaucoup: 3, votre: 2,
    mon: 2, ma: 2, ai: 2, avez: 3, est: 2, sur: 1, pas: 2, plus: 1,
    dans: 2, qui: 2, que: 2, ce: 1, il: 1, elle: 2, de: 1, s: 1,
    plaît: 3, bonsoir: 3, excusez: 3,
    aujourd: 1, hui: 1, suis: 2, notre: 2, leur: 1, aux: 1, par: 1,
    colis: 3, remboursement: 3, paiement: 2,
  },
  it: {
    io: 3, grazie: 3, buongiorno: 3, sono: 3, che: 2, per: 2, con: 2,
    una: 2, delle: 3, ciao: 3, ho: 3, bisogno: 3, aiuto: 3, ordine: 3,
    fattura: 3, consegna: 3, indirizzo: 3, cambiare: 3, vorrei: 3,
    domanda: 2, quando: 2, verrà: 3, consegnato: 3, mille: 3,
    vostro: 2, mio: 2, mia: 2, prego: 3, il: 1, la: 2, di: 2, e: 1,
    non: 2, mi: 2, si: 2, questo: 2, anche: 1, molto: 2, bene: 1,
    buonasera: 3, scusi: 3, oggi: 2, fare: 1, sapere: 2, come: 1,
    dove: 2, rimborso: 3, pagamento: 2, spedizione: 3, pacco: 3,
  },
};

/**
 * Score each supported language for a piece of text. Exported for
 * testing/debugging; callers should use detectLanguage().
 */
export function scoreLanguages(text: string): Record<SupportedLanguage, number> {
  const scores: Record<SupportedLanguage, number> = { en: 0, de: 0, fr: 0, it: 0 };
  if (!text) return scores;

  const lower = text.toLowerCase();

  // Character bonuses (capped so one word cannot dominate).
  const count = (re: RegExp) => (lower.match(re) ?? []).length;
  scores.de += Math.min(count(/[ß]/g), 2) * 6 + Math.min(count(/[äöü]/g), 3) * 3;
  scores.fr += Math.min(count(/[éèêëàâç]/g), 3) * 3;
  scores.it += Math.min(count(/[ìòù]/g), 2) * 4;

  // Whole-token word matches only — substring matching would make
  // "une" fire inside "una" and similar cross-language false hits.
  // (Latin-1 letter range instead of \p{L}: tsconfig targets ES5,
  // which rejects the unicode regex flag.)
  const tokens = lower.split(/[^a-zA-ZÀ-ÿ]+/).filter(Boolean);
  for (const token of tokens) {
    for (const lang of ["en", "de", "fr", "it"] as const) {
      const weight = WORDS[lang][token];
      if (weight) scores[lang] += weight;
    }
  }
  return scores;
}

/**
 * Best-guess language for a text. Returns 'en' when nothing matches
 * or when scores tie — English is the workspace default, not a claim
 * that the text is English.
 */
export function detectLanguage(text: string): SupportedLanguage {
  const scores = scoreLanguages(text);
  let best: SupportedLanguage = "en";
  let bestScore = 0;
  for (const lang of ["de", "fr", "it", "en"] as const) {
    if (scores[lang] > bestScore) {
      best = lang;
      bestScore = scores[lang];
    }
  }
  return best;
}
