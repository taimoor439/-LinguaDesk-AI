"use client";

/**
 * ChatDemo — an interactive live-chat demo for the marketing homepage.
 *
 * Pure client-side: no server actions, no Supabase, no network calls.
 * The visitor picks a language (EN / DE / FR / IT), types a message and
 * gets a CANNED reply in that language (delivery, returns, opening
 * hours). The demo is clearly labelled as canned replies, not live AI.
 */

import { useRef, useState } from "react";

type Lang = "en" | "de" | "fr" | "it";

const LANGUAGES: { code: Lang; label: string; greeting: string }[] = [
  { code: "en", label: "English", greeting: "Hello" },
  { code: "de", label: "Deutsch", greeting: "Hallo" },
  { code: "fr", label: "Français", greeting: "Bonjour" },
  { code: "it", label: "Italiano", greeting: "Ciao" },
];

type DemoCopy = {
  welcome: string;
  delivery: string;
  returns: string;
  hours: string;
  fallback: string;
  handoff: string;
  inputPlaceholder: string;
  send: string;
  talkToHuman: string;
  typing: string;
  demoNote: string;
};

const COPY: Record<Lang, DemoCopy> = {
  en: {
    welcome:
      "Hi! I'm the LinguaDesk demo assistant. Ask me about delivery, returns, or opening hours.",
    delivery:
      "We deliver within 2–4 business days in Germany, Switzerland, France and Italy. Tracking is sent by email once your order ships.",
    returns:
      "You can return any item within 30 days for a full refund. Start a return from your orders page and we'll email you a label.",
    hours: "Our support team is available Monday to Friday, 9:00–18:00 CET.",
    fallback:
      "Thanks for your message! In this demo I can answer questions about delivery, returns, and opening hours. Try one of those topics.",
    handoff:
      "Connecting you to a human agent… An agent will join shortly. (Demo — no real agent is connected.)",
    inputPlaceholder: "Type your message…",
    send: "Send",
    talkToHuman: "Talk to a human",
    typing: "Demo assistant is typing…",
    demoNote: "Demo — canned replies, not live AI.",
  },
  de: {
    welcome:
      "Hallo! Ich bin der LinguaDesk-Demo-Assistent. Fragen Sie mich zu Lieferung, Rückgabe oder Öffnungszeiten.",
    delivery:
      "Wir liefern innerhalb von 2–4 Werktagen in Deutschland, der Schweiz, Frankreich und Italien. Die Sendungsverfolgung erhalten Sie per E-Mail, sobald Ihre Bestellung versandt wird.",
    returns:
      "Sie können jeden Artikel innerhalb von 30 Tagen kostenlos zurückgeben. Starten Sie die Rückgabe über Ihre Bestellungen — wir senden Ihnen ein Etikett per E-Mail.",
    hours:
      "Unser Support-Team ist Montag bis Freitag von 9:00 bis 18:00 Uhr (MEZ) erreichbar.",
    fallback:
      "Danke für Ihre Nachricht! In dieser Demo beantworte ich Fragen zu Lieferung, Rückgabe und Öffnungszeiten. Probieren Sie eines dieser Themen.",
    handoff:
      "Ich verbinde Sie mit einem menschlichen Mitarbeiter… Ein Agent wird sich gleich melden. (Demo — kein echter Agent verbunden.)",
    inputPlaceholder: "Nachricht eingeben…",
    send: "Senden",
    talkToHuman: "Mit einem Menschen sprechen",
    typing: "Demo-Assistent schreibt…",
    demoNote: "Demo — vorgefertigte Antworten, keine Live-KI.",
  },
  fr: {
    welcome:
      "Bonjour ! Je suis l'assistant de démonstration LinguaDesk. Posez-moi une question sur la livraison, les retours ou les horaires d'ouverture.",
    delivery:
      "Nous livrons sous 2 à 4 jours ouvrés en Allemagne, en Suisse, en France et en Italie. Le suivi vous est envoyé par e-mail dès l'expédition de votre commande.",
    returns:
      "Vous pouvez retourner tout article sous 30 jours pour un remboursement complet. Lancez le retour depuis vos commandes et nous vous enverrons une étiquette par e-mail.",
    hours:
      "Notre équipe d'assistance est disponible du lundi au vendredi, de 9h00 à 18h00 (CET).",
    fallback:
      "Merci pour votre message ! Dans cette démo, je réponds aux questions sur la livraison, les retours et les horaires d'ouverture. Essayez l'un de ces sujets.",
    handoff:
      "Je vous mets en relation avec un agent humain… Un agent va vous rejoindre sous peu. (Démo — aucun vrai agent connecté.)",
    inputPlaceholder: "Écrivez votre message…",
    send: "Envoyer",
    talkToHuman: "Parler à un humain",
    typing: "L'assistant de démo écrit…",
    demoNote: "Démo — réponses préenregistrées, pas d'IA en direct.",
  },
  it: {
    welcome:
      "Ciao! Sono l'assistente demo di LinguaDesk. Chiedimi informazioni su consegna, resi o orari di apertura.",
    delivery:
      "Consegniamo entro 2–4 giorni lavorativi in Germania, Svizzera, Francia e Italia. Il tracciamento viene inviato via e-mail non appena l'ordine parte.",
    returns:
      "Puoi restituire qualsiasi articolo entro 30 giorni per un rimborso completo. Avvia il reso dalla pagina dei tuoi ordini e ti invieremo un'etichetta via e-mail.",
    hours:
      "Il nostro team di assistenza è disponibile dal lunedì al venerdì, dalle 9:00 alle 18:00 (CET).",
    fallback:
      "Grazie per il messaggio! In questa demo rispondo a domande su consegna, resi e orari di apertura. Prova uno di questi argomenti.",
    handoff:
      "Ti metto in contatto con un agente umano… Un agente si unirà a breve. (Demo — nessun agente reale collegato.)",
    inputPlaceholder: "Scrivi il tuo messaggio…",
    send: "Invia",
    talkToHuman: "Parla con un umano",
    typing: "L'assistente demo sta scrivendo…",
    demoNote: "Demo — risposte predefinite, non IA dal vivo.",
  },
};

const KEYWORDS: Record<Lang, { topic: keyof Pick<DemoCopy, "delivery" | "returns" | "hours">; words: string[] }[]> = {
  en: [
    { topic: "delivery", words: ["deliver", "ship", "track", "arrive", "order", "package"] },
    { topic: "returns", words: ["return", "refund", "exchange"] },
    { topic: "hours", words: ["hour", "open", "opening", "when", "time", "available"] },
  ],
  de: [
    { topic: "delivery", words: ["liefer", "versand", "sendung", "paket", "ankommt", "bestellung"] },
    { topic: "returns", words: ["rückgabe", "retoure", "erstatten", "umtausch", "zurück"] },
    { topic: "hours", words: ["öffnungszeit", "geöffnet", "uhrzeit", "wann", "erreichbar", "zeiten"] },
  ],
  fr: [
    { topic: "delivery", words: ["livraison", "livrer", "suivi", "colis", "commande", "arrive"] },
    { topic: "returns", words: ["retour", "rembours", "échange", "renvoyer"] },
    { topic: "hours", words: ["horaire", "ouvert", "ouverture", "quand", "heure", "disponible"] },
  ],
  it: [
    { topic: "delivery", words: ["consegna", "spedizione", "tracciamento", "pacco", "ordine", "arriva"] },
    { topic: "returns", words: ["reso", "rimborso", "cambio", "restituire"] },
    { topic: "hours", words: ["orari", "apertura", "aperto", "quando", "ora", "disponibile"] },
  ],
};

function cannedReply(lang: Lang, text: string): string {
  const lower = text.toLowerCase();
  for (const entry of KEYWORDS[lang]) {
    if (entry.words.some((w) => lower.includes(w))) {
      return COPY[lang][entry.topic];
    }
  }
  return COPY[lang].fallback;
}

type ChatMessage = { role: "visitor" | "assistant"; text: string };

export default function ChatDemo() {
  const [lang, setLang] = useState<Lang>("en");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: COPY.en.welcome },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = COPY[lang];

  function switchLanguage(next: Lang) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTyping(false);
    setHandedOff(false);
    setLang(next);
    setMessages([{ role: "assistant", text: COPY[next].welcome }]);
    setInput("");
  }

  function sendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || typing || handedOff) return;
    const reply = cannedReply(lang, text);
    setMessages((prev) => [...prev, { role: "visitor", text }]);
    setInput("");
    setTyping(true);
    timerRef.current = setTimeout(() => {
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
      setTyping(false);
    }, 700);
  }

  function requestHuman() {
    if (handedOff) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setTyping(false);
    setHandedOff(true);
    setMessages((prev) => [...prev, { role: "assistant", text: copy.handoff }]);
  }

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-xl bg-white text-left shadow-lg ring-1 ring-slate-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-navy-950 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 text-sm font-bold text-white">
            L
          </span>
          <div>
            <p className="text-sm font-semibold text-white">LinguaDesk chat</p>
            <p className="flex items-center gap-1.5 text-xs text-teal-300">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400" aria-hidden="true" />
              Online — replies instantly in your language
            </p>
          </div>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Demo language">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => switchLanguage(l.code)}
              aria-pressed={lang === l.code}
              className={
                lang === l.code
                  ? "rounded-md bg-teal-500 px-2.5 py-1 text-xs font-semibold text-white"
                  : "rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/20"
              }
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex h-72 flex-col gap-3 overflow-y-auto bg-slate-50 px-4 py-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "visitor" ? "flex justify-end" : "flex justify-start"}>
            <p
              className={
                m.role === "visitor"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-teal-600 px-3.5 py-2 text-sm text-white"
                  : "max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2 text-sm text-slate-800 shadow-sm ring-1 ring-slate-200"
              }
            >
              {m.text}
            </p>
          </div>
        ))}
        {typing && (
          <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2 text-sm italic text-slate-500 shadow-sm ring-1 ring-slate-200">
            {copy.typing}
          </p>
        )}
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="border-t border-slate-200 bg-white p-3">
        <div className="flex gap-2">
          <label htmlFor="chat-demo-input" className="sr-only">
            {copy.inputPlaceholder}
          </label>
          <input
            id="chat-demo-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={copy.inputPlaceholder}
            disabled={handedOff}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={!input.trim() || typing || handedOff}
            className="shrink-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {copy.send}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">{copy.demoNote}</p>
          <button
            type="button"
            onClick={requestHuman}
            disabled={handedOff}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-navy-900 hover:bg-slate-50 disabled:opacity-50"
          >
            {handedOff ? "✓ " : ""}
            {copy.talkToHuman}
          </button>
        </div>
      </form>
    </div>
  );
}
