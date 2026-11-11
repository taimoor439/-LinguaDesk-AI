export type Locale = "en" | "de" | "fr" | "it";

export const LOCALES: { code: Locale; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "de", label: "German", nativeLabel: "Deutsch" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "it", label: "Italian", nativeLabel: "Italiano" },
];

export const LOCALE_STORAGE_KEY = "linguadesk-locale";

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string): value is Locale {
  return value === "en" || value === "de" || value === "fr" || value === "it";
}

/** Client-only: read the persisted locale. Safe to call on the server (returns default). */
export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored !== null && isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Client-only: persist the locale and reflect it on <html lang>. No-op on the server. */
export function setStoredLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage unavailable (e.g. private mode) — locale still applies for this session.
  }
  document.documentElement.lang = locale;
  window.dispatchEvent(
    new CustomEvent<Locale>("linguadesk:locale-change", { detail: locale }),
  );
}

export type DictionaryKey =
  | "overview"
  | "inbox"
  | "liveChat"
  | "email"
  | "contacts"
  | "aiAssistant"
  | "knowledgeBase"
  | "savedReplies"
  | "team"
  | "analytics"
  | "settings"
  | "search"
  | "logout"
  | "workspace"
  | "createWorkspace"
  | "signIn"
  | "signUp"
  | "welcome"
  | "assign"
  | "unassign"
  | "reply"
  | "internalNote"
  | "invite"
  | "pendingInvitations"
  | "remove"
  | "edit"
  | "delete"
  | "cancel"
  | "save"
  | "create"
  | "newContact"
  | "newReply"
  | "status"
  | "priority"
  | "assignedTo"
  | "backToInbox"
  | "backToContacts"
  | "widgetConfig"
  | "installSnippet"
  | "needsAttention"
  | "widgetName"
  | "welcomeMessage"
  | "brandColor"
  | "widgetPosition"
  | "collectName"
  | "collectEmail"
  | "greetingMessage"
  | "copySnippet"
  | "copied"
  | "saveWidgetConfig"
  | "talkToHuman"
  | "generateAiDraft"
  | "summarize"
  | "approve"
  | "discard"
  | "translate"
  | "saveAsNewDraft"
  | "aiNotConfigured"
  | "newArticle"
  | "newCategory"
  | "publish"
  | "unpublish"
  | "articleContent"
  | "articleCategory"
  | "aiDraft"
  | "translateTo"
  | "aiSummary"
  | "connectGmail"
  | "connectMicrosoft"
  | "disconnectAccount"
  | "syncNow"
  | "emailNotConfigured"
  | "emailEncryptionNotConfigured"
  | "emailSentVia"
  | "emailSavedNotSent";

export type Dictionary = Record<DictionaryKey, string>;

export const DICTIONARIES: Record<Locale, Dictionary> = {
  en: {
    overview: "Overview",
    inbox: "Unified Inbox",
    liveChat: "Website Live Chat",
    email: "Email",
    contacts: "Contacts",
    aiAssistant: "AI Assistant",
    knowledgeBase: "Knowledge Base",
    savedReplies: "Saved Replies",
    team: "Team Members",
    analytics: "Analytics",
    settings: "Settings",
    search: "Search conversations, contacts…",
    logout: "Sign out",
    workspace: "Workspace",
    createWorkspace: "Create workspace",
    signIn: "Sign in",
    signUp: "Sign up",
    welcome: "Welcome",
    assign: "Assign",
    unassign: "Unassign",
    reply: "Reply",
    internalNote: "Internal note",
    invite: "Invite",
    pendingInvitations: "Pending invitations",
    remove: "Remove",
    edit: "Edit",
    delete: "Delete",
    cancel: "Cancel",
    save: "Save",
    create: "Create",
    newContact: "New contact",
    newReply: "New saved reply",
    status: "Status",
    priority: "Priority",
    assignedTo: "Assigned to",
    backToInbox: "Back to inbox",
    backToContacts: "Back to contacts",
    widgetConfig: "Widget configuration",
    installSnippet: "Install snippet",
    needsAttention: "Needs attention",
    widgetName: "Widget name",
    welcomeMessage: "Welcome message",
    brandColor: "Brand colour",
    widgetPosition: "Position",
    collectName: "Collect visitor name",
    collectEmail: "Collect visitor email",
    greetingMessage: "Greeting message",
    copySnippet: "Copy snippet",
    copied: "Copied",
    saveWidgetConfig: "Save widget settings",
        talkToHuman: "Talk to a human",
    generateAiDraft: "Generate AI draft",
    summarize: "Summarize",
    approve: "Approve",
    discard: "Discard",
    translate: "Translate",
    saveAsNewDraft: "Save as new draft",
    aiNotConfigured: "AI is not configured — add your OpenAI API key",
    newArticle: "New article",
    newCategory: "New category",
    publish: "Publish",
    unpublish: "Unpublish",
    articleContent: "Content",
    articleCategory: "Category",
    aiDraft: "AI draft",
    translateTo: "Translate to",
    aiSummary: "AI summary",
    connectGmail: "Connect Gmail",
    connectMicrosoft: "Connect Microsoft",
    disconnectAccount: "Disconnect",
    syncNow: "Sync now",
    emailNotConfigured: "Email provider is not configured",
    emailEncryptionNotConfigured: "Token encryption is not configured",
    emailSentVia: "Sent via",
    emailSavedNotSent: "Saved to thread — not sent",
  },
  de: {
    overview: "Übersicht",
    inbox: "Posteingang",
    liveChat: "Website-Live-Chat",
    email: "E-Mail",
    contacts: "Kontakte",
    aiAssistant: "KI-Assistent",
    knowledgeBase: "Wissensdatenbank",
    savedReplies: "Gespeicherte Antworten",
    team: "Teammitglieder",
    analytics: "Analysen",
    settings: "Einstellungen",
    search: "Gespräche, Kontakte suchen…",
    logout: "Abmelden",
    workspace: "Arbeitsbereich",
    createWorkspace: "Arbeitsbereich erstellen",
    signIn: "Anmelden",
    signUp: "Registrieren",
    welcome: "Willkommen",
    assign: "Zuweisen",
    unassign: "Zuweisung aufheben",
    reply: "Antworten",
    internalNote: "Interne Notiz",
    invite: "Einladen",
    pendingInvitations: "Ausstehende Einladungen",
    remove: "Entfernen",
    edit: "Bearbeiten",
    delete: "Löschen",
    cancel: "Abbrechen",
    save: "Speichern",
    create: "Erstellen",
    newContact: "Neuer Kontakt",
    newReply: "Neue gespeicherte Antwort",
    status: "Status",
    priority: "Priorität",
    assignedTo: "Zugewiesen an",
    backToInbox: "Zurück zum Posteingang",
    backToContacts: "Zurück zu Kontakten",
    widgetConfig: "Widget-Konfiguration",
    installSnippet: "Installationscode",
    needsAttention: "Braucht Aufmerksamkeit",
    widgetName: "Widget-Name",
    welcomeMessage: "Willkommensnachricht",
    brandColor: "Markenfarbe",
    widgetPosition: "Position",
    collectName: "Name des Besuchers erfassen",
    collectEmail: "E-Mail des Besuchers erfassen",
    greetingMessage: "Begrüßungsnachricht",
    copySnippet: "Code kopieren",
    copied: "Kopiert",
    saveWidgetConfig: "Widget-Einstellungen speichern",
        talkToHuman: "Mit einem Menschen sprechen",
    generateAiDraft: "KI-Entwurf erstellen",
    summarize: "Zusammenfassen",
    approve: "Genehmigen",
    discard: "Verwerfen",
    translate: "Übersetzen",
    saveAsNewDraft: "Als neuen Entwurf speichern",
    aiNotConfigured: "KI ist nicht konfiguriert – OpenAI-API-Schlüssel hinzufügen",
    newArticle: "Neuer Artikel",
    newCategory: "Neue Kategorie",
    publish: "Veröffentlichen",
    unpublish: "Zurückziehen",
    articleContent: "Inhalt",
    articleCategory: "Kategorie",
    aiDraft: "KI-Entwurf",
    translateTo: "Übersetzen nach",
    aiSummary: "KI-Zusammenfassung",
    connectGmail: "Gmail verbinden",
    connectMicrosoft: "Microsoft verbinden",
    disconnectAccount: "Verbindung trennen",
    syncNow: "Jetzt synchronisieren",
    emailNotConfigured: "E-Mail-Anbieter ist nicht konfiguriert",
    emailEncryptionNotConfigured: "Token-Verschlüsselung ist nicht konfiguriert",
    emailSentVia: "Gesendet über",
    emailSavedNotSent: "Im Thread gespeichert — nicht gesendet",
  },
  fr: {
    overview: "Aperçu",
    inbox: "Boîte de réception unifiée",
    liveChat: "Chat en direct du site",
    email: "E-mail",
    contacts: "Contacts",
    aiAssistant: "Assistant IA",
    knowledgeBase: "Base de connaissances",
    savedReplies: "Réponses enregistrées",
    team: "Membres de l’équipe",
    analytics: "Statistiques",
    settings: "Paramètres",
    search: "Rechercher des conversations, des contacts…",
    logout: "Se déconnecter",
    workspace: "Espace de travail",
    createWorkspace: "Créer un espace de travail",
    signIn: "Se connecter",
    signUp: "S’inscrire",
    welcome: "Bienvenue",
    assign: "Attribuer",
    unassign: "Retirer l’attribution",
    reply: "Répondre",
    internalNote: "Note interne",
    invite: "Inviter",
    pendingInvitations: "Invitations en attente",
    remove: "Retirer",
    edit: "Modifier",
    delete: "Supprimer",
    cancel: "Annuler",
    save: "Enregistrer",
    create: "Créer",
    newContact: "Nouveau contact",
    newReply: "Nouvelle réponse enregistrée",
    status: "Statut",
    priority: "Priorité",
    assignedTo: "Attribué à",
    backToInbox: "Retour à la boîte de réception",
    backToContacts: "Retour aux contacts",
    widgetConfig: "Configuration du widget",
    installSnippet: "Code d’installation",
    needsAttention: "Nécessite votre attention",
    widgetName: "Nom du widget",
    welcomeMessage: "Message de bienvenue",
    brandColor: "Couleur de la marque",
    widgetPosition: "Position",
    collectName: "Demander le nom du visiteur",
    collectEmail: "Demander l’e-mail du visiteur",
    greetingMessage: "Message d’accueil",
    copySnippet: "Copier le code",
    copied: "Copié",
    saveWidgetConfig: "Enregistrer les réglages du widget",
        talkToHuman: "Parler à un humain",
    generateAiDraft: "Générer un brouillon IA",
    summarize: "Résumer",
    approve: "Approuver",
    discard: "Écarter",
    translate: "Traduire",
    saveAsNewDraft: "Enregistrer comme nouveau brouillon",
    aiNotConfigured: "L’IA n’est pas configurée — ajoutez votre clé API OpenAI",
    newArticle: "Nouvel article",
    newCategory: "Nouvelle catégorie",
    publish: "Publier",
    unpublish: "Dépublier",
    articleContent: "Contenu",
    articleCategory: "Catégorie",
    aiDraft: "Brouillon IA",
    translateTo: "Traduire vers",
    aiSummary: "Résumé IA",
    connectGmail: "Connecter Gmail",
    connectMicrosoft: "Connecter Microsoft",
    disconnectAccount: "Déconnecter",
    syncNow: "Synchroniser",
    emailNotConfigured: "Le fournisseur e-mail n’est pas configuré",
    emailEncryptionNotConfigured: "Le chiffrement des jetons n’est pas configuré",
    emailSentVia: "Envoyé via",
    emailSavedNotSent: "Enregistré dans le fil — non envoyé",
  },
  it: {
    overview: "Panoramica",
    inbox: "Posta in arrivo unificata",
    liveChat: "Chat live del sito",
    email: "Email",
    contacts: "Contatti",
    aiAssistant: "Assistente AI",
    knowledgeBase: "Base di conoscenza",
    savedReplies: "Risposte salvate",
    team: "Membri del team",
    analytics: "Analisi",
    settings: "Impostazioni",
    search: "Cerca conversazioni, contatti…",
    logout: "Esci",
    workspace: "Spazio di lavoro",
    createWorkspace: "Crea spazio di lavoro",
    signIn: "Accedi",
    signUp: "Registrati",
    welcome: "Benvenuto",
    assign: "Assegna",
    unassign: "Rimuovi assegnazione",
    reply: "Rispondi",
    internalNote: "Nota interna",
    invite: "Invita",
    pendingInvitations: "Inviti in sospeso",
    remove: "Rimuovi",
    edit: "Modifica",
    delete: "Elimina",
    cancel: "Annulla",
    save: "Salva",
    create: "Crea",
    newContact: "Nuovo contatto",
    newReply: "Nuova risposta salvata",
    status: "Stato",
    priority: "Priorità",
    assignedTo: "Assegnato a",
    backToInbox: "Torna alla posta in arrivo",
    backToContacts: "Torna ai contatti",
    widgetConfig: "Configurazione del widget",
    installSnippet: "Snippet di installazione",
    needsAttention: "Richiede attenzione",
    widgetName: "Nome del widget",
    welcomeMessage: "Messaggio di benvenuto",
    brandColor: "Colore del brand",
    widgetPosition: "Posizione",
    collectName: "Raccogli il nome del visitatore",
    collectEmail: "Raccogli l’email del visitatore",
    greetingMessage: "Messaggio di saluto",
    copySnippet: "Copia lo snippet",
    copied: "Copiato",
    saveWidgetConfig: "Salva le impostazioni del widget",
        talkToHuman: "Parla con un operatore",
    generateAiDraft: "Genera bozza AI",
    summarize: "Riassumi",
    approve: "Approva",
    discard: "Scarta",
    translate: "Traduci",
    saveAsNewDraft: "Salva come nuova bozza",
    aiNotConfigured: "L’IA non è configurata — aggiungi la chiave API OpenAI",
    newArticle: "Nuovo articolo",
    newCategory: "Nuova categoria",
    publish: "Pubblica",
    unpublish: "Ritira",
    articleContent: "Contenuto",
    articleCategory: "Categoria",
    aiDraft: "Bozza AI",
    translateTo: "Traduci in",
    aiSummary: "Riepilogo AI",
    connectGmail: "Collega Gmail",
    connectMicrosoft: "Collega Microsoft",
    disconnectAccount: "Disconnetti",
    syncNow: "Sincronizza ora",
    emailNotConfigured: "Il provider email non è configurato",
    emailEncryptionNotConfigured: "La crittografia dei token non è configurata",
    emailSentVia: "Inviato tramite",
    emailSavedNotSent: "Salvato nella conversazione — non inviato",
  },
};

/** Look up a dashboard UI label. Falls back to English, then to the key itself. */
export function t(locale: Locale, key: DictionaryKey): string {
  return DICTIONARIES[locale]?.[key] ?? DICTIONARIES.en[key] ?? key;
}
