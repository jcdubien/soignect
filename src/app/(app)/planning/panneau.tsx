"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { nextDay } from "@/lib/dates";
import { MissionData, PostData, SUIVI, SUIVI_ORDRE, Panel, toDate, fmtDate, buildCreateHref } from "./modele";
import { DeclareAbsenceForm, AddPostForm } from "./formulaires";

// ── Ligne titulaire segmentée ──────────────────────────────────────────────────

// Annulation sécurisée d'un match confirmé (section 149/145) — symétrique au menu
// disponibilité. Deux temps : confirmation explicite + avertissement conséquences, puis
// DELETE /api/match/[id]?force=true (route réutilisée : notif autre partie + resync poste
// en Recrutement, section 102). Le déclenchement billing individuel n'est PAS annulé (acté).
export function CancelMatchButton({ matchId, otherName, onCancelled }: {
  matchId: string; otherName: string | null; onCancelled: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/match/${matchId}?force=true`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(typeof d?.error === "string" ? d.error : "L'annulation a échoué. Réessayez.");
        setBusy(false);
        return;
      }
      onCancelled();
    } catch {
      setError("Erreur réseau. Réessayez.");
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition"
      >
        Annuler la mise en relation
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
      <p className="text-xs text-red-700 leading-relaxed">
        Annuler cette mise en relation confirmée ? Le contrat signé sera annulé, la
        conversation supprimée, et le poste redeviendra à pourvoir (Recrutement).{" "}
        <strong>{otherName ?? "L'autre partie"} sera notifié·e de cette annulation.</strong>{" "}
        Cette action est irréversible.
      </p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-40"
        >
          Retour
        </button>
        <button
          onClick={cancel}
          disabled={busy}
          className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition disabled:opacity-40"
        >
          {busy ? "Annulation…" : "Oui, annuler"}
        </button>
      </div>
    </div>
  );
}

// Rattachement/détachement manuel d'un compte ASSISTANT à un poste (section 153, point 2/3).
export function PostAssistantLink({ post, onChanged }: { post: PostData; onChanged: () => void }) {
  const [open, setOpen]   = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Le rattachement (/link) exige un compte EXISTANT. Quand il n'y en a pas, le parcours
  // s'arrêtait sur « Aucun compte trouvé pour cet email » — cul-de-sac (section 204).
  // La route d'invitation (/invite) existait pourtant depuis longtemps, complète : token,
  // email, rattachement automatique à la finalisation de l'inscription. Elle n'avait
  // simplement AUCUN appelant côté interface. On enchaîne les deux ici.
  const [sansCompte, setSansCompte] = useState(false);
  const [invitee, setInvitee] = useState<string | null>(null);
  const linked = post.linkedUser;

  async function attach() {
    if (!email.trim() || busy) return;
    setBusy(true); setError(null); setSansCompte(false);
    try {
      const res = await fetch(`/api/cabinet-posts/${post.id}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        // 404 = aucun compte pour cet email. Ce n'est pas une impasse, c'est exactement le
        // cas que l'invitation couvre : on propose la suite au lieu d'afficher une erreur.
        if (res.status === 404) { setSansCompte(true); setBusy(false); return; }
        setError(typeof d?.error === "string" ? d.error : "Rattachement impossible."); setBusy(false); return;
      }
      onChanged();
    } catch { setError("Erreur réseau."); setBusy(false); }
  }

  async function inviter() {
    if (!email.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/cabinet-posts/${post.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        // 409 = un compte existe finalement (créé entre-temps) : on repasse au rattachement.
        if (res.status === 409) { setSansCompte(false); setError(typeof d?.error === "string" ? d.error : null); setBusy(false); return; }
        setError(typeof d?.error === "string" ? d.error : "L'invitation n'a pas pu être envoyée."); setBusy(false); return;
      }
      setInvitee(email.trim()); setSansCompte(false); setBusy(false);
    } catch { setError("Erreur réseau."); setBusy(false); }
  }

  async function detach() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/cabinet-posts/${post.id}/link`, { method: "DELETE" });
      if (!res.ok) { setError("Détachement impossible."); setBusy(false); return; }
      onChanged();
    } catch { setError("Erreur réseau."); setBusy(false); }
  }

  if (linked) {
    return (
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
        <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wide mb-0.5">👩‍⚕️ Compte assistant rattaché</p>
        <p className="text-sm font-semibold text-gray-900">{linked.profile?.name ?? linked.email}</p>
        <p className="text-xs text-gray-500">{linked.email}</p>
        <button onClick={detach} disabled={busy}
          className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-40">
          {busy ? "…" : "Détacher ce compte"}
        </button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="w-full py-2.5 border border-violet-200 text-violet-700 rounded-xl text-sm font-semibold hover:bg-violet-50 transition">
          + Rattacher un compte assistant
        </button>
      ) : (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
          {invitee ? (
            /* L'invitation est partie : on le dit franchement, avec ce qui va se passer
               ensuite. Le rattachement n'est PAS encore fait — il se produira quand la
               personne aura créé son compte. Ne pas laisser croire que c'est réglé. */
            <>
              <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wide mb-0.5">✉️ Invitation envoyée</p>
              <p className="text-sm text-gray-700">
                <strong>{invitee}</strong> va recevoir un lien pour créer son compte.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Le rattachement à « {post.label} » se fera automatiquement quand elle ou il
                aura terminé son inscription — rien à refaire de votre côté.
              </p>
              <button onClick={() => { setInvitee(null); setOpen(false); setEmail(""); }}
                className="mt-2 text-xs font-semibold text-violet-700 hover:text-violet-800">Fermer</button>
            </>
          ) : (
            <>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email du compte assistant</label>
              <input type="email" value={email}
                onChange={e => { setEmail(e.target.value); setSansCompte(false); setError(null); }}
                placeholder="assistant@email.fr"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
              {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

              {sansCompte ? (
                <div className="mt-2">
                  <p className="text-xs text-gray-600">
                    Aucun compte Soignect pour cet email. Vous pouvez l&apos;inviter à en créer
                    un et à reprendre la gestion de « {post.label} ».
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => { setSansCompte(false); }} disabled={busy}
                      className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-40">Corriger l&apos;email</button>
                    <button onClick={inviter} disabled={busy}
                      className="flex-1 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 disabled:opacity-40">
                      {busy ? "…" : "Inviter par email"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { setOpen(false); setError(null); }} disabled={busy}
                    className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-40">Annuler</button>
                  <button onClick={attach} disabled={busy || !email.trim()}
                    className="flex-1 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 disabled:opacity-40">
                    {busy ? "…" : "Rattacher"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Bloc-note de suivi (section 200) ──────────────────────────────────────────
//
// Deux points d'ancrage, parce que la timeline montre deux natures d'objets :
//   • une BRIQUE est une Mission → statut + note portés par elle ;
//   • une ZONE NON COUVERTE n'est AUCUN objet en base — c'est un intervalle calculé entre
//     deux briques. Son suivi est donc porté par le POSTE, seul support stable : accroché à
//     un triplet (poste + début + fin), il deviendrait orphelin au premier décalage de dates,
//     ce qui arrive réellement (bug B9, dates d'absence modifiées).

export function SuiviMission({ mission, onSaved }: { mission: MissionData; onSaved: () => void }) {
  const [statut, setStatut] = useState<string | null>(mission.suiviStatut ?? null);
  const [note, setNote]     = useState(mission.statusNote ?? "");
  const [busy, setBusy]     = useState(false);
  const [ok, setOk]         = useState(false);

  const modifie = (statut ?? null) !== (mission.suiviStatut ?? null) || note !== (mission.statusNote ?? "");

  async function save() {
    setBusy(true); setOk(false);
    try {
      const res = await fetch(`/api/missions/${mission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // statusNote voyage SEULE, sans briqueStatus : elle était auparavant imbriquée dans
        // la mise à jour du statut de créneau côté serveur, si bien qu'on ne pouvait pas
        // écrire la note sans changer le créneau. C'est pour ça que ce champ, présent en base
        // et déjà affiché, n'avait jamais reçu une valeur (section 200).
        body: JSON.stringify({ suiviStatut: statut, statusNote: note.trim() || null }),
      });
      if (res.ok) { setOk(true); onSaved(); }
    } finally { setBusy(false); }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-3">
      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Suivi</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {SUIVI_ORDRE.map((k) => {
          const actif = statut === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => { setStatut(actif ? null : k); setOk(false); }}
              aria-pressed={actif}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                actif
                  ? "bg-kine-600 text-white border-kine-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-kine-300"
              }`}
            >
              {SUIVI[k].label}
            </button>
          );
        })}
      </div>
      <textarea
        value={note}
        onChange={(e) => { setNote(e.target.value.slice(0, 200)); setOk(false); }}
        rows={2}
        maxLength={200}
        placeholder="Note libre — « rappelé le 30/10, dispo en novembre »"
        className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-kine-200 resize-none"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-gray-400">{note.length}/200</span>
        <button
          type="button"
          onClick={save}
          disabled={busy || !modifie}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-kine-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-kine-700 transition"
        >
          {busy ? "…" : ok && !modifie ? "Enregistré ✓" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

export function SuiviPoste({ post, onSaved }: { post: PostData; onSaved: () => void }) {
  const [note, setNote] = useState(post.suiviNote ?? "");
  const [busy, setBusy] = useState(false);
  const [ok, setOk]     = useState(false);
  const modifie = note !== (post.suiviNote ?? "");

  async function save() {
    setBusy(true); setOk(false);
    try {
      const res = await fetch(`/api/cabinet-posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suiviNote: note.trim() || null }),
      });
      if (res.ok) { setOk(true); onSaved(); }
    } finally { setBusy(false); }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-3">
      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Note de suivi du poste</p>
      <p className="text-[11px] text-gray-400 mb-2">
        Attachée au poste, pas à une période : elle survit à un changement de dates.
      </p>
      <textarea
        value={note}
        onChange={(e) => { setNote(e.target.value.slice(0, 500)); setOk(false); }}
        rows={3}
        maxLength={500}
        placeholder="« Annonce postée sur le groupe Facebook le 12/08, deux réponses à rappeler »"
        className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-kine-200 resize-none"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-gray-400">{note.length}/500</span>
        <button
          type="button"
          onClick={save}
          disabled={busy || !modifie}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-kine-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-kine-700 transition"
        >
          {busy ? "…" : ok && !modifie ? "Enregistré ✓" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

// ── Panel latéral droit ────────────────────────────────────────────────────────

export function SidePanel({
  panel, onClose, onClosePost, isEmployeur,
}: {
  panel: NonNullable<Panel>;
  onClose: () => void;
  onClosePost: (post: PostData) => void;
  isEmployeur: boolean;
}) {
  const router = useRouter();

  if (panel.type === "declare_absence") {
    return (
      <DeclareAbsenceForm
        suggestedStart={panel.suggestedStart}
        suggestedEnd={panel.suggestedEnd}
        onClose={onClose}
        onCreated={() => { onClose(); router.refresh(); }}
      />
    );
  }

  if (panel.type === "add_post") {
    return <AddPostForm onClose={onClose} isEmployeur={isEmployeur} onCreated={() => { onClose(); router.refresh(); }} />;
  }

  if (panel.type === "uncovered") {
    const post = panel.post;
    const latestMission = post.missions.sort(
      (a, b) => new Date(b.startDate ?? 0).getTime() - new Date(a.startDate ?? 0).getTime()
    )[0];

    return (
      <div className="flex flex-col gap-4">
        <div>
          <span className="inline-block px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px] font-bold mb-2">NON COUVERT</span>
          <h3 className="font-bold text-gray-900">{post.label}</h3>
        </div>
        {latestMission ? (
          <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
            <p className="font-semibold text-gray-800 mb-1">{latestMission.title}</p>
            <p className="text-xs">{fmtDate(latestMission.startDate)} → {fmtDate(latestMission.endDate)}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Aucune annonce publiée pour ce poste.</p>
        )}
        {latestMission && (
          <Link
            href={`/annonces?missionId=${latestMission.id}`}
            className="w-full py-3 bg-kine-600 text-white rounded-xl text-sm font-bold text-center hover:bg-kine-700 transition"
          >
            Swiper les candidats →
          </Link>
        )}
        <Link
          href={buildCreateHref({
            postType: post.postType,
            postId: post.id,
            postLabel: post.label,
            // Successeur : démarre le LENDEMAIN de la fin du poste précédent (pas de
            // chevauchement d'1 jour), sans jamais proposer une date passée (section 92)
            start: nextDay(toDate(latestMission?.endDate)?.toISOString().slice(0, 10)),
            end: "",
          })}
          className="w-full py-3 border border-kine-200 text-kine-700 rounded-xl text-sm font-semibold text-center hover:bg-kine-50 transition"
        >
          + Publier une annonce
        </Link>
        <Link
          href="/matches"
          className="w-full py-3 border border-kine-200 text-kine-700 rounded-xl text-sm font-semibold text-center hover:bg-kine-50 transition"
        >
          Voir tous les matchs
        </Link>
        <SuiviPoste post={post} onSaved={() => router.refresh()} />
        {/* Rattachement d'un compte assistant à ce poste (section 153) */}
        <PostAssistantLink post={post} onChanged={() => { onClose(); router.refresh(); }} />
        {post.isActive && (
          <button
            onClick={() => onClosePost(post)}
            className="w-full py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition mt-2"
          >
            Fermer ce poste
          </button>
        )}
      </div>
    );
  }

  if (panel.type === "notice") {
    const { mission, post } = panel;
    const endDate = toDate(mission.endDate);
    return (
      <div className="flex flex-col gap-4">
        <div>
          <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold mb-2">PRÉAVIS</span>
          <h3 className="font-bold text-gray-900">{post.label}</h3>
        </div>
        <SuiviMission mission={mission} onSaved={() => router.refresh()} />
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm">
          <p className="font-semibold text-yellow-800">Préavis de {post.noticeMonths} mois</p>
          {endDate && <p className="text-yellow-700 text-xs mt-1">Fin de contrat : {fmtDate(endDate)}</p>}
          <p className="text-yellow-600 text-xs mt-1">Pensez à recruter un remplaçant.</p>
        </div>
        <Link
          href="/missions/create"
          className="w-full py-3 bg-kine-600 text-white rounded-xl text-sm font-bold text-center hover:bg-kine-700 transition"
        >
          Publier une annonce pré-remplie
        </Link>
        {post.isActive && (
          <button
            onClick={() => onClosePost(post)}
            className="w-full py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition"
          >
            Fermer ce poste
          </button>
        )}
      </div>
    );
  }

  if (panel.type === "covered") {
    const { mission, post } = panel;
    const match = mission.matchesA[0] || mission.matchesB[0];
    const them = match
      ? (mission.matchesA[0] ? match.profileB : match.profileA)
      : null;
    const isFinished = toDate(mission.endDate) ? new Date() > toDate(mission.endDate)! : false;

    return (
      <div className="flex flex-col gap-4">
        <div>
          <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold mb-2">COUVERT</span>
          <h3 className="font-bold text-gray-900">{post.label}</h3>
        </div>
        {them && (
          <div className="bg-emerald-50 rounded-xl p-3">
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide mb-0.5">Remplaçant</p>
            <p className="font-bold text-gray-900">{them.name ?? "Sans nom"}</p>
          </div>
        )}
        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
          <p>{fmtDate(mission.startDate)} → {fmtDate(mission.endDate)}</p>
        </div>
        <SuiviMission mission={mission} onSaved={() => router.refresh()} />
        {match && (
          <Link
            href={`/match/${match.id}`}
            className="w-full py-3 bg-kine-600 text-white rounded-xl text-sm font-bold text-center hover:bg-kine-700 transition"
          >
            Voir la mise en relation →
          </Link>
        )}
        {isFinished && match && (
          <Link
            href={`/match/${match.id}?rate=1`}
            className="w-full py-3 border border-yellow-300 text-yellow-700 rounded-xl text-sm font-semibold text-center hover:bg-yellow-50 transition"
          >
            Recommander
          </Link>
        )}
        {/* Annulation sécurisée du match (Cas 2, symétrique disponibilité) */}
        {match && (
          <CancelMatchButton
            matchId={match.id}
            otherName={them?.name ?? null}
            onCancelled={() => { onClose(); router.refresh(); }}
          />
        )}
        {/* Rattachement d'un compte assistant à ce poste (section 153) */}
        <PostAssistantLink post={post} onChanged={() => { onClose(); router.refresh(); }} />
        {post.isActive && (
          <button
            onClick={() => onClosePost(post)}
            className="w-full py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition mt-2"
          >
            Fermer ce poste
          </button>
        )}
        {!post.isActive && (
          <p className="text-xs text-gray-400 text-center">Ce poste est fermé.</p>
        )}
      </div>
    );
  }

  return null;
}
