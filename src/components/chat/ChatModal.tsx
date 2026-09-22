"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  sender: { id: string; type: string };
}

interface ChatPartner {
  type: string;
  theirMissionTitle?: string | null;
}

interface ChatModalProps {
  matchId: string;
  myProfileId: string;
  partner: ChatPartner;
  aiScore: number | null;
  onClose: () => void;
  /** Type du profil courant — le bouton contrat n'est visible que côté recruteur */
  myType?: string;
  /** Contrat signé des deux côtés ? Dérivé par `contratConfirme` chez l'appelant, qui charge
   *  déjà les deux missions. Décide du REFUS d'annuler — voir l'en-tête du bouton plus bas. */
  contratConfirmed?: boolean;
  /** Appelé après une annulation réussie, pour que l'écran appelant se rafraîchisse. La modale
   *  se ferme d'elle-même : un chat dont le match n'existe plus n'a plus rien à afficher. */
  onCancelled?: (matchId: string) => void;
}

const TYPE_EMOJI: Record<string, string> = {
  REMPLACANT: "🩺",
  ASSISTANT: "👩‍⚕️",
  TITULAIRE: "🏥",
};

const TYPE_LABEL: Record<string, string> = {
  REMPLACANT: "Remplaçant·e",
  ASSISTANT: "Assistant·e",
  TITULAIRE: "Cabinet / Titulaire",
};

export default function ChatModal({ matchId, myProfileId, partner, aiScore, onClose, myType, contratConfirmed, onCancelled }: ChatModalProps) {
  const canSendContract = myType === "TITULAIRE" || myType === "ASSISTANT";
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── POURQUOI UN PORTAIL, ET PAS UN `sticky` SUR L'EN-TÊTE (section 245) ──────────────────
  //
  // Signalé le 08/09 : « l'en-tête et la barre Envoyer un contrat défilent avec le chat ». La
  // structure les plaçait pourtant DÉJÀ hors de la zone défilante — conteneur `fixed inset-0` en
  // colonne, seule la liste des messages en `overflow-y-auto`. Sur le papier, rien à corriger.
  //
  // La cause est ailleurs, et mesurée à l'écran : un ancêtre porte la classe `animate-fade-up`,
  // donc un `transform` non nul. Or un ancêtre transformé devient le BLOC CONTENEUR de tout
  // `position: fixed` descendant. La modale n'était donc pas fixée à la fenêtre : c'était une
  // boîte de 896 × 328 px posée dans la page, qui défilait avec elle — en-tête et barre compris.
  //
  // Ajouter `sticky` à l'en-tête aurait masqué le symptôme dans un conteneur trop petit, sans
  // rendre la conversation plein écran. On rétablit la cause : rendu dans `document.body`, hors
  // de portée de toute transformation d'ancêtre — présente ou future, ici ou ailleurs dans l'arbre.
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);

  // Le fond ne défile plus tant que la conversation est ouverte : une surface plein écran par
  // dessus une page qui bouge encore est ce qui donnait l'impression que « tout défile ».
  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = avant; };
  }, []);

  const fetchMessages = useCallback(async (initial = false) => {
    const url = initial
      ? `/api/matches/${matchId}/messages`
      : `/api/matches/${matchId}/messages${lastTimestampRef.current ? `?after=${encodeURIComponent(lastTimestampRef.current)}` : ""}`;

    const res = await fetch(url);
    if (!res.ok) return;
    const fresh: Message[] = await res.json();

    if (fresh.length > 0) {
      lastTimestampRef.current = fresh[fresh.length - 1].createdAt;
      if (initial) {
        setMessages(fresh);
      } else {
        setMessages((prev) => [...prev, ...fresh]);
      }
    }
  }, [matchId]);

  // Chargement initial
  useEffect(() => {
    fetchMessages(true);
    inputRef.current?.focus();
  }, [fetchMessages]);

  // Polling toutes les 3s
  useEffect(() => {
    const timer = setInterval(() => fetchMessages(false), 3000);
    return () => clearInterval(timer);
  }, [fetchMessages]);

  // Scroll to bottom quand nouveaux messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft("");

    // Optimiste
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      content,
      senderId: myProfileId,
      createdAt: new Date().toISOString(),
      sender: { id: myProfileId, type: "" },
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/matches/${matchId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const real: Message = await res.json();
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? real : m));
        lastTimestampRef.current = real.createdAt;
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  // ── ANNULER LA MISE EN RELATION (section 258) ────────────────────────────────────────────
  //
  // Demandé le 21/09 : le chat n'offrait que « Envoyer un contrat » et l'envoi de message. Quand
  // la discussion ne mène à rien, il fallait sortir de l'écran et retrouver la fiche dans « Vos
  // choix » pour se désengager — c'est-à-dire connaître un chemin que rien n'indique.
  //
  // LE CONTRAT SIGNÉ REFUSE, ICI. Deux autres surfaces (Planning, Disponibilités) passent
  // `?force=true` et annulent un match confirmé ; celle-ci non, sur arbitrage du 22/09. Annuler
  // un contrat signé depuis une fenêtre de discussion est trop facile, et le Planning reste la
  // porte pour ce geste-là. Le bouton reste VISIBLE et dit pourquoi il refuse : un levier qui
  // disparaît sans explication laisse chercher une option qui existe ailleurs.
  //
  // La route revérifie de toute façon — elle répond 403 sans `force`. L'écran ne fait qu'éviter
  // un aller-retour et une erreur sèche.
  async function annulerLaMiseEnRelation() {
    if (cancelling) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/match/${encodeURIComponent(matchId)}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setCancelError(typeof d?.error === "string" ? d.error : "L'annulation a échoué. Réessayez.");
        setCancelling(false);
        return;
      }
      onCancelled?.(matchId);
      onClose();
    } catch {
      setCancelError("Erreur réseau. Réessayez.");
      setCancelling(false);
    }
  }

  const score = aiScore !== null ? Math.round(aiScore) : null;

  if (!monte) return null; // pas de `document` au rendu serveur

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shadow-sm">
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-500"
          aria-label="Fermer"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>

        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-kine-200 to-kine-500 flex items-center justify-center text-xl flex-shrink-0">
          {TYPE_EMOJI[partner.type] ?? "👤"}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm">{TYPE_LABEL[partner.type] ?? partner.type}</p>
          {partner.theirMissionTitle && (
            <p className="text-xs text-gray-400 truncate">{partner.theirMissionTitle}</p>
          )}
        </div>

        {score !== null && (
          <div className={`text-center px-3 py-1.5 rounded-xl ${score >= 80 ? "bg-emerald-50 text-emerald-600" : score >= 50 ? "bg-kine-50 text-kine-600" : "bg-amber-50 text-amber-600"}`}>
            <span className="text-base font-black">{score}%</span>
            <p className="text-[9px] text-gray-400 leading-none">affinité IA</p>
          </div>
        )}

        {/* Dans l'en-tête, DISCRET, et loin de la zone de saisie : c'est une action
            irréversible, elle ne doit pas voisiner le bouton d'envoi de message. */}
        <button
          type="button"
          onClick={() => { setCancelError(null); setConfirmingCancel(true); }}
          disabled={contratConfirmed}
          title={contratConfirmed
            ? "Contrat signé des deux côtés — l'annulation se fait depuis le Planning"
            : "Annuler cette mise en relation"}
          className="shrink-0 p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:bg-transparent disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          aria-label="Annuler cette mise en relation"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" /><line x1="8.5" y1="8.5" x2="15.5" y2="15.5" /><line x1="15.5" y1="8.5" x2="8.5" y2="15.5" />
          </svg>
        </button>
      </div>

      {/* Le motif du refus, ÉCRIT plutôt que laissé au survol : une infobulle n'existe pas au
          doigt, et c'est sur mobile que se lisent la plupart des conversations. */}
      {contratConfirmed && (
        <p className="px-4 py-2 text-[11px] leading-snug text-gray-500 bg-gray-50 border-b border-gray-100">
          Le contrat est signé des deux côtés. L&apos;annulation reste possible depuis le Planning,
          où la conséquence sur le poste est visible.
        </p>
      )}

      {/* Bouton contrat permanent (section 61) — côté recruteur uniquement */}
      {canSendContract && (
        <a
          href={`/match/${matchId}/contrat`}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-kine-50 border-b border-kine-100 text-kine-700 text-sm font-semibold hover:bg-kine-100 transition"
        >
          📄 Envoyer un contrat
        </a>
      )}

      {/* Messages */}
      {/* `min-h-0` est indispensable : sans lui, un enfant flex ne peut pas descendre sous la
          taille de son contenu (`min-height: auto` par défaut), et la liste pousserait le
          conteneur au lieu de défiler à l'intérieur. C'est le motif déjà employé quatre fois
          dans `DisponibilitesBoard`, pour la même structure colonne + zone défilante. */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-gray-500 text-sm font-medium">Démarrez la conversation !</p>
            <p className="text-gray-400 text-xs mt-1">
              {TYPE_EMOJI[partner.type]} {TYPE_LABEL[partner.type]} attend votre message
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isMine = msg.senderId === myProfileId;
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isMine
                    ? "bg-kine-600 text-white rounded-br-sm"
                    : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
                }`}
              >
                {msg.content}
                <div className={`text-[10px] mt-0.5 ${isMine ? "text-kine-200" : "text-gray-400"}`}>
                  {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-white"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Votre message…"
          maxLength={1000}
          className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400 focus:bg-white transition"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="w-11 h-11 bg-kine-600 text-white rounded-2xl flex items-center justify-center hover:bg-kine-700 transition disabled:opacity-40 flex-shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>

      {/* Confirmation — MODALE, comme « Annuler le match » du fil « Vos choix », et non le
          bouton à deux temps du Planning. Le chat occupe tout l'écran : un second bouton qui
          remplace le premier s'y perdrait, là où une surface assombrie arrête le geste.
          Le texte nomme les trois conséquences réelles, mesurées dans la route : conversation
          supprimée, poste remis en recherche, et possibilité de se re-choisir plus tard. */}
      {confirmingCancel && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/50"
          onClick={() => { if (!cancelling) setConfirmingCancel(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 text-base mb-2">Annuler cette mise en relation ?</h3>
            <p className="text-sm text-gray-500 mb-3">
              La conversation et son historique seront supprimés, et le poste repassera en
              recherche des deux côtés.
            </p>
            <p className="text-sm text-gray-500 mb-5">
              Vous pourrez vous retrouver dans le fil plus tard : les deux choix sont effacés, rien
              n&apos;empêche une nouvelle mise en relation.
            </p>
            {cancelError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{cancelError}</p>
            )}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmingCancel(false)}
                disabled={cancelling}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-40"
              >
                Revenir au chat
              </button>
              <button
                type="button"
                onClick={annulerLaMiseEnRelation}
                disabled={cancelling}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition disabled:opacity-40"
              >
                {cancelling ? "Annulation…" : "Confirmer l'annulation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
