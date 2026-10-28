"use client";

import { useState } from "react";
import { cheminPartageAnnonce } from "@/lib/partageAnnonce";
import Button from "@/components/ui/md3/Button";
import BottomSheet from "@/components/ui/md3/BottomSheet";
import ShareActions from "@/components/share/ShareActions";
import { MissionData, estAnnoncePerimee, posteDejaTenu, DropdownState, toDate, fmtDate } from "./modele";
import { EncartPeriodeEcoulee, EncartPosteDejaTenu } from "./encarts";
import { FormulairePeriode } from "./FormulairePeriode";
import { PostAssistantLink, SuiviMission, SuiviPoste } from "./panneau";

// ── Menu à 3 choix au clic sur un poste (section 55) ─────────────────────────────

export function PostMenu({
  dropdown,
  onClose,
  onPoserAnnonce,
  onDetail,
  onRetirer,
  onDone,
  onSeeRelations,
  onEditAnnonce,
  onEditMission,
}: {
  dropdown: DropdownState;
  onClose: () => void;
  onPoserAnnonce: () => void;
  onDetail: () => void;
  onRetirer: () => void;
  onDone: () => void; // fermer + rafraîchir après création
  onSeeRelations: () => void; // Cas 2 READ — tray filtré sur l'annonce
  onEditAnnonce: () => void;  // Cas 2 UPDATE — formulaire de création en mode édition
  // Édition complète d'une annonce DÉSIGNÉE — le menu ouvert depuis le libellé du poste
  // n'a pas de mission courante, mais peut viser l'une des annonces en ligne (section 266).
  onEditMission: (missionId: string) => void;
}) {
  const { mission, post } = dropdown;
  const [step, setStep] = useState<"menu" | "presence" | "preavis" | "modifier" | "renommer" | "annuler_annonce" | "retour">("menu");
  const [busy, setBusy] = useState(false);

  // Cas 2 (section CRUD annonce) — une annonce est active sur la période cliquée :
  // annonce publiée (briqueStatus stocké RECHERCHE), pas encore confirmée par contrat.
  // On se base sur le statut STOCKÉ (pas l'effectif) pour capturer aussi les annonces
  // ayant déjà des mises en relation en attente (rendues en vert par getEffectiveStatus).
  const isAnnonceActive = !!mission && mission.isActive && mission.briqueStatus === "RECHERCHE";

  // Quelle mission le formulaire de dates va-t-il modifier ? Celle du menu par défaut, mais on
  // peut viser une annonce choisie dans la liste des annonces en ligne du poste (section 266).
  const [cibleDates, setCibleDates] = useState<MissionData | null>(null);
  const ouvrirDates = (m: MissionData) => { setCibleDates(m); setStep("modifier"); };

  // ── ANNONCE DÉPUBLIÉE (section 266) ────────────────────────────────────────────────────
  // La frise peint une brique en « Recrutement » sur le seul `briqueStatus` : une annonce
  // dépubliée y est donc INDISTINGUABLE d'une annonce en ligne. Mesuré le 25/09 : 4 briques
  // sur 10 étaient dans ce cas. C'est ce qui a fait demander « repartager » une annonce qui
  // n'était plus publiée — et dont le lien aurait mené à un 404, `/annonce/[id]` exigeant
  // `isActive`. On le dit ici, là où l'utilisateur vient chercher l'action.
  const estDepubliee = !!mission && !mission.isActive && mission.briqueStatus === "RECHERCHE";

  // Annonces RÉELLEMENT en ligne portées par ce poste. Le menu ouvert depuis le LIBELLÉ du
  // poste n'a pas de mission : il proposait « Poser une annonce » à un poste qui en portait
  // déjà une, sans jamais offrir de la partager ni de la modifier.
  const annoncesEnLigne = post.missions.filter(
    (m) => m.isActive && m.briqueStatus === "RECHERCHE" && toDate(m.startDate),
  );
  const relationCount = (mission?.matchesA?.length ?? 0) + (mission?.matchesB?.length ?? 0);

  // DELETE — "Annuler l'annonce" : supprime l'annonce (pas le poste). Timeline resync.
  async function submitAnnulerAnnonce() {
    if (!mission || busy) return;
    setBusy(true);
    await fetch(`/api/missions/${mission.id}`, { method: "DELETE" });
    onDone();
  }

  // [✎] Renommer ce poste (item 6 / section 65) — PATCH CabinetPost.label
  const [newLabel, setNewLabel] = useState(post.label);
  async function submitRenommer() {
    const trimmed = newLabel.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    await fetch(`/api/cabinet-posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: trimmed }),
    });
    onDone();
  }

  // Une brique CONFIRME/OCCUPE sans date de fin = occupation en durée indéterminée
  // → on peut y poser un préavis (section 57).
  const isIndeterminate =
    !!mission && !toDate(mission.endDate) && ["CONFIRME", "OCCUPE"].includes(mission.briqueStatus);

  // ── Occupation externe / présence ──
  const [pName, setPName] = useState("");
  const [pStart, setPStart] = useState(toDate(mission?.startDate)?.toISOString().slice(0, 10) ?? dropdown.suggestedStart ?? "");
  const [pEnd, setPEnd] = useState(toDate(mission?.endDate)?.toISOString().slice(0, 10) ?? dropdown.suggestedEnd ?? "");

  // Republier une annonce dépubliée (section 266). C'est le PRÉALABLE au partage : tant que
  // `isActive` est faux, la page publique répond 404 et le lien partagé ne mène nulle part.
  async function submitRepublier() {
    if (!mission || busy) return;
    setBusy(true);
    await fetch(`/api/missions/${mission.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    onDone();
  }

  // Retour en arrière depuis une annonce en ligne : la période passe en FERME — « je ne
  // cherche plus personne ». Distinct de submitFermer, dont le toggle renvoie vers CONFIRME.
  async function submitFermerPeriode() {
    if (!mission || busy) return;
    setBusy(true);
    await fetch(`/api/missions/${mission.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ briqueStatus: "FERME" }),
    });
    onDone();
  }

  // [5] Fermer temporairement — marque la période FERME (grisé hachuré), pas de suppression
  const isFerme = mission?.briqueStatus === "FERME";
  async function submitFermer() {
    if (!mission || busy) return;
    setBusy(true);
    await fetch(`/api/missions/${mission.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ briqueStatus: isFerme ? "CONFIRME" : "FERME" }),
    });
    onDone();
  }

  async function submitPresence() {
    if (!pStart || busy) return;
    setBusy(true);
    await fetch(`/api/cabinet-posts/${post.id}/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        practitionerName: pName.trim() || undefined,
        startDate: new Date(pStart).toISOString(),
        endDate: pEnd ? new Date(pEnd).toISOString() : null,
      }),
    });
    onDone();
  }

  // ── METTRE FIN À UNE OCCUPATION (sections 6 et 276) ─────────────────────────────────────
  //
  // Un seul geste, un seul champ : `departureDate`. Il était déjà écrit par « Indiquer une date
  // de départ », mais ce bouton n'apparaissait QUE sur une occupation sans date de fin — mesuré
  // le 01/10, 8 occupations sur 11 en ont une, donc n'avaient aucune sortie. Il ne restait qu'à
  // raccourcir les dates en silence, ou supprimer la ligne entière.
  //
  // UN DÉPART EST UNE DATE. Le préavis n'est que la même chose annoncée à l'avance : une date
  // future laisse la couverture courir jusque-là, aujourd'hui y met fin tout de suite. Deux
  // boutons écrivant la même colonne auraient fini par diverger.
  //
  // `briqueStatus` reste INTACT, et c'est la contrainte qui commande tout : « le contrat est-il
  // signé ? » n'a pas de colonne, il se dérive de `briqueStatus === CONFIRME` (lib/matchEtat).
  // Toucher au statut pour dire « elle est partie » ferait mentir le contrat.
  //
  // Par défaut aujourd'hui : on met fin à ce qui a lieu, on ne planifie pas.
  const [departureDate, setDepartureDate] = useState(
    toDate(mission?.departureDate)?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  );
  const [finErreur, setFinErreur] = useState<string | null>(null);

  const estOccupation = !!mission && ["CONFIRME", "OCCUPE", "PREAVIS"].includes(mission.briqueStatus);
  const estEngagee = !!mission && ((mission.matchesA?.length ?? 0) + (mission.matchesB?.length ?? 0)) > 0;

  async function submitFinOccupation() {
    if (!mission || busy) return;
    setBusy(true);
    setFinErreur(null);
    const res = await fetch(`/api/missions/${mission.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departureDate: departureDate ? new Date(departureDate).toISOString() : null }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setFinErreur(typeof d?.error === "string" ? d.error : "La fin d'occupation n'a pas pu être enregistrée.");
      setBusy(false);
      return;
    }
    onDone();
  }

  return (
    <BottomSheet open onClose={onClose} zClass="z-[60]">
      {/* BottomSheet plafonne à max-h-[85vh] et délègue le défilement à son contenu (« passez
          un header/scroll/footer à l'intérieur ») — mais aucun appelant ne le faisait. Ce menu
          est le plus long de l'application : au-delà de 85vh, le bas était PUREMENT INATTEIGNABLE,
          ni visible ni atteignable au doigt. Constaté à l'écran le 12/08 en ajoutant le bloc de
          suivi, dont le bouton « Enregistrer » tombait hors cadre. Défaut préexistant, aggravé
          par cet ajout : le partage et les actions du poste étaient déjà dans cette zone morte
          sur un écran court. */}
      <div className="p-6 overflow-y-auto min-h-0">
        <div className="mb-4">
          <h3 className="font-bold text-gray-900 text-base leading-tight">{post.label}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {mission ? (
              <>
                {mission.title}
                {toDate(mission.startDate) ? ` · depuis le ${fmtDate(mission.startDate)}` : ""}
                {toDate(mission.endDate) ? ` → ${fmtDate(mission.endDate)}` : isIndeterminate ? " · durée indéterminée" : ""}
                {estDepubliee && <span className="text-[#8a5a00] font-semibold"> · dépubliée</span>}
              </>
            ) : annoncesEnLigne.length > 0 ? (
              // « Poste vide » était faux dès qu'une annonce y recrutait — et la liste juste
              // en dessous le contredisait à l'écran. Un poste sans occupant mais avec une
              // annonce en ligne n'est pas vide : il est en cours de recrutement.
              `Personne en poste · ${annoncesEnLigne.length} annonce${annoncesEnLigne.length > 1 ? "s" : ""} en ligne`
            ) : (
              "Poste vide — définissez son occupation"
            )}
          </p>
          {/* L'annonce de ce poste recrute-t-elle encore pour une période passée ? C'est ici que
              se trouvent les deux issues — « Modifier l'annonce » et « Annuler l'annonce ». */}
          {mission && estAnnoncePerimee(mission) && (
            <div className="mt-2"><EncartPeriodeEcoulee /></div>
          )}
          {/* Et recrute-t-elle sur une période que quelqu'un occupe déjà ? Même endroit, mêmes
              deux issues — c'est ici que vivent « Modifier l'annonce » et « Annuler l'annonce ». */}
          {mission && (() => {
            const occupant = posteDejaTenu(mission, post.missions);
            return occupant ? <div className="mt-2"><EncartPosteDejaTenu occupant={occupant} /></div> : null;
          })()}
        </div>

        {/* ── Cas 1 (section 64) — aucune annonce active : menu inchangé ── */}
        {step === "menu" && !isAnnonceActive && (
          <div className="flex flex-col gap-2.5">
            {/* Annonce dépubliée : la republier est la seule action qui rétablit tout le reste
                — partage compris, puisque le lien public reste mort tant qu'elle ne l'est pas. */}
            {estDepubliee && (
              <>
                <p className="text-[11px] leading-snug text-[#8a5a00] bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                  Cette annonce n&apos;est plus proposée aux candidats et son lien de partage ne
                  mène à rien. La frise la peint pourtant en « Recrutement ».
                </p>
                <Button onClick={submitRepublier} disabled={busy} className="w-full">
                  {busy ? "…" : "Republier cette annonce"}
                </Button>
                {mission && (
                  <Button variant="outlined" onClick={() => ouvrirDates(mission)} className="w-full !py-2.5">
                    Modifier les dates
                  </Button>
                )}
              </>
            )}
            {/* Annonces DÉJÀ en ligne sur ce poste (section 266). Le menu ouvert depuis le
                libellé ne les voyait pas : il proposait d'en poser une nouvelle sans jamais
                donner accès à celles qui existent. Une liste, parce qu'un poste peut en porter
                plusieurs — la ligne de Léa en a deux. */}
            {!mission && annoncesEnLigne.length > 0 && (
              <div className="rounded-xl border border-gray-200 p-3 flex flex-col gap-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                  {annoncesEnLigne.length} annonce{annoncesEnLigne.length > 1 ? "s" : ""} en ligne sur ce poste
                </p>
                {annoncesEnLigne.map((a) => (
                  <div key={a.id} className="flex flex-col gap-2 border-t border-gray-100 pt-2.5 first:border-0 first:pt-0">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 leading-snug">{a.title}</p>
                      <p className="text-[11px] text-gray-400">
                        {fmtDate(a.startDate)}
                        {toDate(a.endDate) ? ` → ${fmtDate(a.endDate)}` : " → sans date de fin"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outlined" onClick={() => onEditMission(a.id)} className="flex-1 !py-2 !text-xs">
                        Modifier l&apos;annonce
                      </Button>
                      <Button variant="outlined" onClick={() => ouvrirDates(a)} className="flex-1 !py-2 !text-xs">
                        Modifier les dates
                      </Button>
                    </div>
                    <ShareActions path={cheminPartageAnnonce(a)} title={a.title} />
                  </div>
                ))}
              </div>
            )}
            {/* [1] Poser une annonce */}
            <Button onClick={onPoserAnnonce} className="w-full">Poser une annonce →</Button>
            {/* [2] Modifier la période — TOUTE occupation reste éditable, y compris issue d'un match */}
            {mission && (
              <Button variant="outlined" onClick={() => setStep("modifier")} className="w-full !py-2.5">
                Modifier la période
              </Button>
            )}
            {/* [6] Occupation externe hors Soignect (nom + dates, CONFIRME sans matchId) */}
            <Button variant="outlined" onClick={() => setStep("presence")} className="w-full !py-2.5">
              {mission ? "Occupation externe (hors Soignect)" : "Définir l'occupation (hors Soignect)"}
            </Button>
            {/* Mettre fin à l'occupation (section 276) — offert sur TOUTE occupation, bornée ou
                non. Masqué quand la période est engagée : ce geste-là appartient alors à la mise
                en relation, qui annule le contrat et prévient l'autre partie. */}
            {estOccupation && !estEngagee && (
              <Button
                variant="outlined"
                onClick={() => setStep("preavis")}
                className="w-full !py-2.5 !border-[var(--ambre)] !text-[#8a5a00] hover:!bg-amber-50"
              >
                Mettre fin à cette occupation
              </Button>
            )}
            {estOccupation && estEngagee && (
              <p className="text-[11px] leading-snug text-gray-500 bg-gray-50 rounded-lg px-2.5 py-2">
                Cette période est engagée dans une mise en relation : pour y mettre fin, passez par
                « Annuler la mise en relation » — le contrat sera annulé et l&apos;autre partie prévenue.
              </p>
            )}
            {/* [5] Fermer temporairement — marque la période FERME (réversible). Retiré sur une
                période ENGAGÉE (section 276) : il écrivait FERME sur le statut, et le « contrat
                signé » se dérivant de ce même statut, fermer faisait basculer un contrat signé à
                faux. Le serveur refuse désormais ; l'écran ne le propose plus. */}
            {mission && !estEngagee && (
              <Button variant="outlined" onClick={submitFermer} disabled={busy} className="w-full !py-2.5">
                {isFerme ? "Rouvrir cette période" : "Fermer temporairement"}
              </Button>
            )}
            {/* [✎] Renommer ce poste (PATCH CabinetPost.label) */}
            <Button variant="text" onClick={() => setStep("renommer")} className="w-full !py-2 !text-gray-600 hover:!bg-gray-50">
              ✎ Renommer ce poste
            </Button>
            {mission && <SuiviMission mission={mission} onSaved={onDone} />}
            {/* Poste vide = la ZONE NON COUVERTE, qui n'est aucun objet en base : son suivi
                est porté par le poste (section 200). */}
            {!mission && <SuiviPoste post={post} onSaved={onDone} />}
            {/* Rattacher / inviter (section 204) — le bloc ne vivait QUE dans le panneau
                latéral, atteignable par le seul bouton « Voir le poste » du bandeau d'alerte,
                qui ne cible qu'un poste. Cliquer la ligne d'un autre poste n'y menait pas :
                on pouvait gérer son occupation, la renommer, la retirer — mais pas y rattacher
                quelqu'un. Le menu du poste est pourtant le chemin naturel pour ça. */}
            <PostAssistantLink post={post} onChanged={onDone} />
            {mission && (
              <Button variant="text" onClick={onDetail} className="w-full !py-2 !text-kine-600 hover:!bg-kine-50">
                Voir le détail
              </Button>
            )}
            {/* Suppression définitive du poste entier */}
            <Button
              variant="outlined"
              onClick={onRetirer}
              className="w-full !py-2.5 !border-red-200 !text-red-600 hover:!bg-red-50"
            >
              Retirer ce poste
            </Button>
            <Button variant="text" onClick={onClose} className="w-full !py-2 !text-gray-400 hover:!bg-gray-50">Annuler</Button>
          </div>
        )}

        {/* ── Cas 2 — annonce active (Recrutement) : CRUD dédié sur l'annonce ── */}
        {step === "menu" && isAnnonceActive && (
          <div className="flex flex-col gap-2.5">
            <span className="inline-block self-start px-2 py-0.5 bg-[var(--ambre)]/20 text-[#8a5a00] rounded-full text-[10px] font-bold mb-1">
              Annonce en recrutement
            </span>
            {/* READ — voir les mises en relation liées à cette annonce (section 105) */}
            <Button variant="filled" onClick={onSeeRelations} className="w-full">
              Voir les mises en relation →
            </Button>
            {/* UPDATE — édition complète de l'annonce (dates, texte, photo…) */}
            <Button variant="outlined" onClick={onEditAnnonce} className="w-full !py-2.5">
              Modifier l&apos;annonce
            </Button>
            {/* Décaler trois jours ne devrait pas demander de rouvrir l'édition complète. Ce
                raccourci existait déjà — mais SEULEMENT sur une brique sans annonce active,
                c'est-à-dire jamais sur celle qui en a le plus besoin (section 266). */}
            {mission && (
              <Button variant="outlined" onClick={() => ouvrirDates(mission)} className="w-full !py-2.5">
                Modifier les dates
                <span className="block text-[11px] font-normal opacity-70">sans rouvrir l&apos;édition complète</span>
              </Button>
            )}
            {/* Retour en arrière (section 188) — pendant manquant de la fusion : une fois la
                période publiée, rien ne permettait d'y renoncer sans passer par l'annulation
                de l'annonce, qui n'est pas la même intention. On pose la question au lieu de
                trancher : fermer la période, ou retravailler la proposition pour plus tard. */}
            <Button variant="text" onClick={() => setStep("retour")} className="w-full !py-2 !text-gray-600 hover:!bg-gray-50">
              ↩ Je ne cherche plus pour cette période
            </Button>
            {/* Suivi (section 200) — DANS le menu, pas deux niveaux plus bas. Vérification à
                l'écran du 12/08 : le bloc n'avait été branché que sur les panneaux « couvert »
                et « préavis », or un clic sur une brique EN RECRUTEMENT ouvre ce menu-ci et
                n'y mène pas. C'est pourtant le cas qui appelle le plus une note : c'est là
                qu'on rappelle un candidat et qu'on attend une réponse. */}
            {mission && <SuiviMission mission={mission} onSaved={onDone} />}
            {/* Partager l'annonce (section 159) — copier le lien + partage natif Android/iPhone
                + Facebook. Le lien mène à la page publique /annonce/[id] (garde auth/inscription). */}
            {mission && (
              <div className="pt-1">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Partager cette annonce</p>
                <ShareActions path={cheminPartageAnnonce(mission)} title={mission.title} />
              </div>
            )}
            {/* Actions du POSTE, séparées visuellement */}
            <div className="border-t border-gray-100 my-1" />
            <Button variant="outlined" onClick={() => setStep("presence")} className="w-full !py-2.5">
              Occupation externe (hors Soignect)
            </Button>
            <Button variant="outlined" onClick={submitFermer} disabled={busy} className="w-full !py-2.5">
              {isFerme ? "Rouvrir cette période" : "Fermer temporairement"}
            </Button>
            {/* DELETE — annuler l'annonce (jamais le poste) */}
            <Button
              variant="outlined"
              onClick={() => setStep("annuler_annonce")}
              className="w-full !py-2.5 !border-red-200 !text-red-600 hover:!bg-red-50"
            >
              Annuler l&apos;annonce
            </Button>
            {/* Suppression définitive du POSTE entier (section 156) — manquait ici : un poste
                occupé/en recrutement ne pouvait pas être supprimé, seulement son annonce. */}
            <Button
              variant="outlined"
              onClick={onRetirer}
              className="w-full !py-2.5 !border-red-300 !text-red-700 hover:!bg-red-50"
            >
              Retirer ce poste
            </Button>
            <Button variant="text" onClick={onClose} className="w-full !py-2 !text-gray-400 hover:!bg-gray-50">Fermer</Button>
          </div>
        )}

        {/* ── Étape confirmation d'annulation de l'annonce (DELETE) ── */}
        {step === "annuler_annonce" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-700 font-semibold">Annuler cette annonce ?</p>
            <p className="text-sm text-gray-500">
              {relationCount > 0
                ? `Cette annonce a ${relationCount} mise${relationCount > 1 ? "s" : ""} en relation en cours. `
                : ""}
              L&apos;annonce sera retirée ; le poste et sa période reviennent en « Confirmé ». Le poste n&apos;est pas supprimé.
            </p>
            <div className="flex gap-2 pt-1">
              <Button variant="outlined" onClick={() => setStep("menu")} className="flex-1 !py-2.5">Retour</Button>
              <Button
                onClick={submitAnnulerAnnonce}
                disabled={busy}
                className="flex-1 !py-2.5 !bg-red-600 hover:!bg-red-700"
              >
                {busy ? "…" : "Confirmer l'annulation"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Étape renommer (item 6 / section 65) ── */}
        {step === "renommer" && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nouveau libellé du poste</label>
              <input
                type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)} maxLength={100} autoFocus
                placeholder="Ex : Poste sport · Dr Marie L."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="text" onClick={() => setStep("menu")} className="flex-1 !py-2.5 !text-gray-500">Retour</Button>
              <Button onClick={submitRenommer} disabled={busy || !newLabel.trim()} className="flex-1 !py-2.5">Renommer</Button>
            </div>
          </div>
        )}

        {/* ── Étape retour en arrière (section 188) ── */}
        {step === "retour" && (
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="font-bold text-gray-900 text-base leading-tight">Vous ne cherchez plus pour cette période ?</h3>
              <p className="text-xs text-gray-400 mt-1">
                Votre annonce est en ligne. Que voulez-vous en faire ?
              </p>
            </div>
            <Button variant="outlined" onClick={submitFermerPeriode} disabled={busy} className="w-full !py-2.5">
              Fermer la période
              <span className="block text-[11px] font-normal opacity-70">plus de recherche, plus d&apos;alerte</span>
            </Button>
            <Button variant="outlined" onClick={onEditAnnonce} className="w-full !py-2.5">
              Modifier la proposition
              <span className="block text-[11px] font-normal opacity-70">elle reste en ligne pour un match plus tard</span>
            </Button>
            <Button variant="text" onClick={() => setStep("menu")} className="w-full !py-2 !text-gray-500">Retour</Button>
          </div>
        )}

        {/* ── Étape modifier les dates (section 266) — le formulaire est un COMPOSANT, et sa
            cible peut être une autre mission que celle du menu : depuis la liste des annonces
            en ligne d'un poste, on modifie les dates de CELLE qu'on a choisie. Monté avec une
            `key`, il repart des bonnes valeurs à chaque changement de cible — en état local du
            menu, il aurait gardé celles de la première annonce ouverte. ── */}
        {step === "modifier" && cibleDates && (
          <FormulairePeriode
            key={cibleDates.id}
            mission={cibleDates}
            onRetour={() => { setCibleDates(null); setStep("menu"); }}
            onDone={onDone}
          />
        )}

        {/* ── Étape occupation externe hors Soignect (section 64 [6]) — CONFIRME sans matchId ── */}
        {step === "presence" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-400 leading-snug -mt-1">
              Poste occupé par une personne recrutée hors Soignect. Enregistré comme confirmé,
              sans lien à un match. Laissez la date de fin vide si la durée est indéterminée.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Nom de la personne <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <input
                type="text" value={pName} onChange={e => setPName(e.target.value)} maxLength={100}
                placeholder='Ex : "Dr Marion L."'
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date de début</label>
              {/* Pas de min : la présence peut avoir commencé dans le passé */}
              <input
                type="date" value={pStart} onChange={e => setPStart(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Date de fin <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <input
                type="date" value={pEnd} min={pStart || undefined} onChange={e => setPEnd(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outlined" onClick={() => setStep("menu")} className="flex-1 !py-2.5">Retour</Button>
              <Button onClick={submitPresence} disabled={!pStart || busy} className="flex-1 !py-2.5">
                {busy ? "…" : "Confirmer"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Étape « mettre fin à cette occupation » (section 276) ── */}
        {step === "preavis" && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date de départ</label>
              <input
                type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
              />
            </div>

            {/* LA CONFIRMATION NOMME CE QUI SE PASSE, et notamment ce qui NE se passe pas : le
                poste reste ouvert. C'est tout l'objet de l'action — jusqu'ici, la seule sortie
                connue était de supprimer la ligne entière. */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
              <p className="text-[11px] leading-snug text-amber-900">
                {departureDate ? (
                  <>
                    <strong>{mission?.matchedName || mission?.title}</strong> ne tiendra plus ce poste
                    à partir du <strong>{fmtDate(departureDate)}</strong>. La période suivante
                    redeviendra non couverte, prête pour une annonce ou une autre occupation.
                    <span className="block mt-1">Le poste, lui, reste ouvert.</span>
                  </>
                ) : (
                  <>La date de départ sera retirée : l&apos;occupation redeviendra sans terme connu.</>
                )}
              </p>
            </div>

            {finErreur && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 leading-snug">{finErreur}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outlined" onClick={() => { setFinErreur(null); setStep("menu"); }} className="flex-1 !py-2.5">
                Retour
              </Button>
              <Button onClick={submitFinOccupation} disabled={busy} className="flex-1 !py-2.5">
                {busy ? "…" : departureDate ? "Confirmer le départ" : "Retirer la date"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
