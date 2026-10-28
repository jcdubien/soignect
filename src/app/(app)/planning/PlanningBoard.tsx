"use client";

import { CONTRAT_DIRECT } from "@/lib/contratDirect";
import { useState, useRef, useEffect } from "react";
import { cheminPartageAnnonce } from "@/lib/partageAnnonce";
import { useRouter } from "next/navigation";
import ShareActions from "@/components/share/ShareActions";
import { TYPE_LABEL } from "../ActiveAnnoncesList";
import { libelleTypePoste } from "@/lib/libellesPoste";
import { MissionData, PostData, UnlinkedMission, Zoom, ZOOM_DAYS, ZOOM_LABELS, LABEL_WIDTH, assignLanes, RANGE_END, TOTAL_DAYS, BRIQUE_STATUS, SUIVI, estAnnoncePerimee, posteDejaTenu, computeOwnerSeatGaps, computeUncoveredGaps, daysUntil, uncoveredUrgency, mobileWindow, pctIn, MobileBrick, Panel, DropdownState, ConfirmState, toDate, dayOffset, fmtDate, monthLabels, buildCreateHref, monthSkipFor, getEffectiveStatus, UncoveredChoiceState } from "./modele";
import { EncartPeriodeEcoulee, EncartPosteDejaTenu } from "./encarts";
import { MobilePostCard, TimelineRow } from "./frise";
import { PostMenu } from "./PostMenu";
import { UncoveredChoiceModal, ConfirmModal } from "./modales";
import { SidePanel } from "./panneau";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  posts: PostData[];
  profileId: string;
  cabinetName: string;
  isEmployeur: boolean;
  unlinkedMissions: UnlinkedMission[];
}

// ── PlanningBoard principal ────────────────────────────────────────────────────

export default function PlanningBoard({ posts, cabinetName, isEmployeur, unlinkedMissions }: Props) {
  const router = useRouter();

  // Annonces à mettre à jour, POSTES ET NON RATTACHÉES CONFONDUS — une seule liste, un seul
  // prédicat par motif. Le poste est conservé pour que la ligne dise d'où vient l'annonce ;
  // l'utilisateur qui la corrige a besoin de savoir laquelle de ses lignes il touche.
  //
  // DEUX MOTIFS DANS LA MÊME BANDE (section 265). « Période écoulée » et « poste déjà tenu »
  // appellent le même geste — redater ou dépublier — et visent la même chose : une annonce que
  // les candidats voient encore alors qu'elle ne propose plus rien. Une seconde bande à côté
  // aurait partagé l'attention entre deux listes qui demandent la même action.
  const annoncesAMettreAJour = [
    ...posts.flatMap((po) =>
      po.missions.flatMap((m) => {
        const perimee = estAnnoncePerimee(m);
        const occupant = posteDejaTenu(m, po.missions);
        if (!perimee && !occupant) return [];
        return [{
          id: m.id, title: m.title, endDate: m.endDate,
          posteLabel: po.label as string | null, perimee, occupant,
        }];
      }),
    ),
    ...unlinkedMissions.filter(estAnnoncePerimee).map((m) => ({
      id: m.id, title: m.title, endDate: m.endDate, posteLabel: null as string | null,
      perimee: true, occupant: null as MissionData | null,
    })),
  ];
  const [zoom, setZoom]         = useState<Zoom>("quarter");
  const [panel, setPanel]       = useState<Panel>(null);
  const [dropdown, setDropdown] = useState<DropdownState | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmState | null>(null);
  const [uncoveredChoice, setUncoveredChoice] = useState<UncoveredChoiceState | null>(null);
  // Bande « Relances en attente » (section 203) — repliée par défaut : elle informe sans
  // repousser la timeline, qui reste l'objet principal de l'écran.
  const [relancesOuvertes, setRelancesOuvertes] = useState(false);
  // Overrides de statut locaux (lecture seule ici — le menu poste agit via l'API + refresh)
  const [localStatuses] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Largeur réactive (mobile-first) — se recalcule au resize / changement d'orientation
  const [winW, setWinW] = useState(800);
  useEffect(() => {
    const onResize = () => setWinW(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isMobile   = winW < 640;
  const labelWidth = isMobile ? 96 : LABEL_WIDTH; // colonne label plus étroite sur mobile
  // Piste = 90% de l'espace disponible après la colonne de labels (section 87)
  const containerWidth = Math.min((winW - labelWidth) * 0.9, 900);
  const dayWidth   = containerWidth / ZOOM_DAYS[zoom];
  const totalWidth = TOTAL_DAYS * dayWidth;
  const todayOff   = dayOffset(new Date()) * dayWidth;
  const mLabels    = monthLabels(dayWidth);
  const monthSkip  = monthSkipFor(zoom);
  const todayFull  = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const rowsScrollRef = useRef<HTMLDivElement>(null);

  // Scroll centré sur "aujourd'hui". requestAnimationFrame pour attendre le layout
  // final (clientWidth fiable), et dépendance sur winW car la largeur réelle n'arrive
  // qu'après le montage (winW démarre à 800 puis se recale) — sinon la timeline
  // restait bloquée au bord gauche (début de plage).
  useEffect(() => {
    const el = rowsScrollRef.current;
    if (!el || isMobile) return;
    const id = requestAnimationFrame(() => {
      // "Aujourd'hui" à ~10% de la piste visible APRÈS la colonne label sticky
      // (sections 87 + 90) : 90% pour le futur, sans passer sous le label figé.
      const target = Math.max(0, todayOff - (el.clientWidth - labelWidth) * 0.1);
      el.scrollLeft = target;
      if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, target - labelWidth);
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, labelWidth, isMobile, winW]);

  // Retirer définitivement un poste (section 55 [3]) — suppression du CabinetPost
  function requestRemovePost(post: PostData) {
    setDropdown(null);
    setConfirmModal({
      title: "Retirer ce poste",
      body: "Le poste et toute sa ligne seront définitivement supprimés du Planning Board. Cette action est irréversible.",
      onConfirm: async () => {
        setConfirmModal(null);
        await fetch(`/api/cabinet-posts/${post.id}`, { method: "DELETE" });
        router.refresh();
      },
    });
  }

  // Ouvrir le menu au clic sur une brique de poste (mission ciblée)
  function openDropdown(mission: MissionData, post: PostData, isSelf: boolean, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropdown({ mission, post, isSelf, x: rect.left, y: rect.bottom });
    setPanel(null);
  }

  // Ouvrir le menu au niveau du poste (clic sur le libellé ou une zone vide) — marche
  // même si le poste est vide (mission = null). suggested = dates de la zone cliquée.
  function openPostMenu(post: PostData, suggested?: { start: string; end: string }) {
    setDropdown({ mission: null, post, isSelf: false, x: 0, y: 0, suggestedStart: suggested?.start, suggestedEnd: suggested?.end });
    setPanel(null);
  }

  // Fermer un poste entier (cascade ANNULE)
  function requestClosePost(post: PostData) {
    setPanel(null);
    setConfirmModal({
      title: "Fermer ce poste",
      body: "Vous êtes sûr ? Cette action suspend le poste et annule toutes les missions liées.",
      onConfirm: async () => {
        setConfirmModal(null);
        await fetch(`/api/cabinet-posts/${post.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false }),
        });
        router.refresh();
      },
    });
  }

  const allRows: PostData[] = posts;

  // Item 1 — "Je serai finalement présent" : supprime l'absence isSelfPresence
  async function handleDeleteAbsence(missionId: string) {
    setUncoveredChoice(null);
    const res = await fetch(`/api/absences?id=${encodeURIComponent(missionId)}`, { method: "DELETE" });
    // La réponse n'était pas testée : un échec serveur passait inaperçu, l'absence restait
    // affichée et l'utilisateur croyait l'avoir supprimée.
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setConfirmModal({
        title: "Suppression impossible",
        body: typeof d?.error === "string" ? d.error : "Cette absence n'a pas pu être supprimée. Réessayez.",
        onConfirm: () => setConfirmModal(null),
      });
      return;
    }
    router.refresh();
  }

  // Modification des dates d'une absence existante. PATCH /api/missions/[id] : la mission
  // appartient au profil courant, la route l'autorise. router.refresh() derrière, comme pour
  // la création et la suppression — sinon la timeline garderait l'ancienne longueur.
  async function handleEditAbsenceDates(missionId: string, startDate: string, endDate: string) {
    setUncoveredChoice(null);
    const res = await fetch(`/api/missions/${missionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setConfirmModal({
        title: "Modification impossible",
        body: typeof d?.error === "string" ? d.error : "Les nouvelles dates n'ont pas pu être enregistrées.",
        onConfirm: () => setConfirmModal(null),
      });
      return;
    }
    router.refresh();
  }

  // Bandeau d'alerte — calcul client au chargement (section 47).
  // Postes actifs dont la 1ère zone non couverte tombe dans ≤ 90 jours.
  const alertList = allRows
    .filter(p => p.isActive)
    .map(p => {
      const gaps = p.isOwnerSeat ? computeOwnerSeatGaps(p.missions) : computeUncoveredGaps(p.missions);
      if (gaps.length === 0) return null;
      const soonest = gaps.reduce((min, g) => (g.start < min ? g.start : min), gaps[0].start);
      return { post: p, days: daysUntil(soonest) };
    })
    .filter((a): a is { post: PostData; days: number } => a !== null && a.days <= 90)
    .sort((a, b) => a.days - b.days);
  const topAlert = alertList[0] ?? null;
  const alertIsRed = topAlert !== null && topAlert.days < 30;

  // ── Relances en attente (section 203) ───────────────────────────────────────
  // AUCUNE REQUÊTE AJOUTÉE : planning/page.tsx charge déjà tous les postes du cabinet avec
  // leurs missions (`include`, pas `select`) — suiviStatut, statusNote et suiviNote arrivent
  // donc avec. La vue agrégée n'est qu'une lecture transverse de ce qui est déjà en mémoire,
  // là où la pastille de 6 px oblige à parcourir la timeline brique par brique.
  const relances = posts.flatMap((post) =>
    post.missions
      .filter((m) => m.suiviStatut)
      .map((mission) => ({ post, mission, statut: mission.suiviStatut as string })),
  );
  // A_RELANCER d'abord : c'est le seul état qui appelle une action, déjà distingué sur la
  // timeline par un accent propre — on tient la même hiérarchie ici.
  const aRelancer = relances.filter((r) => r.statut === "A_RELANCER");
  const autresSuivis = relances.filter((r) => r.statut !== "A_RELANCER");
  // Les notes de POSTE n'ont pas de statut (elles couvrent les zones non couvertes, qui ne
  // sont aucun objet en base) : elles forment un troisième groupe, sans hiérarchie d'action.
  const notesPoste = posts.filter((p) => p.suiviNote);
  const totalSuivi = relances.length + notesPoste.length;

  // Handler zone non couverte partagé desktop/mobile — ouvre le menu universel
  // (section 64) pré-rempli avec les dates de la zone cliquée.
  function handleUncoveredClick(p: PostData, clickedDate: Date) {
    setPanel(null);
    const start = clickedDate.toISOString().slice(0, 10);
    const endDate = new Date(clickedDate);
    endDate.setDate(endDate.getDate() + 30);
    openPostMenu(p, { start, end: endDate.toISOString().slice(0, 10) });
  }

  // ── Briques pour la vue verticale mobile (fenêtre ~6 mois) ──
  const mWin = mobileWindow(ZOOM_DAYS[zoom]);
  const mpct = (d: Date) => pctIn(d, mWin.start, mWin.end);
  const todayPct = mpct(new Date());
  function buildPostBricks(post: PostData): MobileBrick[] {
    const bricks: MobileBrick[] = [];
    const now = new Date();
    if (post.isActive && now.getTime() < RANGE_END.getTime()) {
      (post.isOwnerSeat ? computeOwnerSeatGaps(post.missions) : computeUncoveredGaps(post.missions)).forEach((gap, gi) => {
        const w = mpct(gap.end) - mpct(gap.start);
        if (w <= 0) return;
        const u = uncoveredUrgency(gap.start);
        bricks.push({
          key: `g${gi}`, leftPct: mpct(gap.start), widthPct: w, colorCls: u.cls, urgent: u.urgent,
          label: "", title: `Non couvert — commence dans ${daysUntil(gap.start)} j`,
          onClick: () => handleUncoveredClick(post, gap.start),
        });
      });
    }
    // Sous-lignes calculées sur les seules missions : un vrai croisement s'empile, une période
    // incluse dans une autre se loge dedans (section 264). Les zones non couvertes, elles, ne
    // concurrencent aucune brique et gardent la pleine hauteur.
    const debutDe = (m: MissionData) => toDate(m.startDate)!.getTime();
    // SANS TERME = RANGE_END, PAS LA FIN DE LA FENÊTRE. Borner une occupation ouverte à la fin
    // des ~3 mois affichés la tronquait artificiellement : sur la carte de Marion, l'occupation
    // s'arrêtait au 15/12 et l'annonce du 10/12 au 03/01 en dépassait — le mobile y lisait un
    // croisement partiel et ouvrait une sous-ligne, là où le desktop voyait une inclusion. Le
    // rendu, lui, ne change pas : `pctIn` plafonne déjà à 100 %.
    const finDe   = (m: MissionData) => (toDate(m.departureDate) ?? toDate(m.endDate) ?? RANGE_END).getTime();
    // Même bornage que le rendu ci-dessous : une mission hors fenêtre ne produit pas de brique
    // et ne doit donc pas consommer d'indice de sous-ligne, sinon la piste grandit pour rien et
    // la brique restante descend d'une bande vide.
    const missionsDatees = post.missions.filter((m) => {
      if (!toDate(m.startDate)) return false;
      return mpct(toDate(m.departureDate) ?? toDate(m.endDate) ?? RANGE_END) - mpct(toDate(m.startDate)!) > 0;
    });
    // Garde d'invisibilité en millisecondes : 6 px sur une piste mobile d'environ 330 px, soit
    // ~1,8 % de la fenêtre affichée. Approximation assumée — la largeur réelle n'est connue
    // qu'après rendu, et ce seuil ne sert qu'à refuser les inclusions qui masquent leur hôte.
    const margeVisible = (mWin.end.getTime() - mWin.start.getTime()) * 0.018;
    const { lanes } = assignLanes(missionsDatees, debutDe, finDe, margeVisible);

    // Contenant d'abord : dans une bande partagée, la brique la plus longue se pose dessous.
    const aPeindre = [...post.missions]
      .filter((m) => toDate(m.startDate))
      .sort((a, b) => (finDe(b) - debutDe(b)) - (finDe(a) - debutDe(a)));

    aPeindre.forEach(m => {
      const start = toDate(m.startDate);
      if (!start) return;
      // Fin effective : date de départ prévue (section 6) sinon endDate sinon bord fenêtre
      const end = toDate(m.departureDate) ?? toDate(m.endDate) ?? RANGE_END;
      const w = mpct(end) - mpct(start);
      if (w <= 0) return;
      const status = getEffectiveStatus(m, post, localStatuses);
      const st = BRIQUE_STATUS[status] ?? BRIQUE_STATUS["RECHERCHE"];
      const isHatch = status === "FERME";
      const brickLabel = m.matchedName || m.title;
      const suivi = m.suiviStatut ? SUIVI[m.suiviStatut] : null;
      bricks.push({
        key: m.id, lane: lanes.get(m) ?? 0, leftPct: mpct(start), widthPct: w,
        colorCls: isHatch ? "timeline-hatch text-white" : `${st.bg} ${st.text}`,
        suiviDot: suivi?.dot,
        label: brickLabel, title: `${brickLabel} · ${st.label}${suivi ? ` · ${suivi.label}` : ""}`,
        onClick: (e: React.MouseEvent) => openDropdown(m, post, false, e),
      });
    });
    return bricks;
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Bandeau d'alerte contextuel (section 47) */}
      {topAlert && (
        <div className={`flex-shrink-0 flex items-center gap-3 px-4 py-2 text-xs font-semibold ${
          alertIsRed ? "bg-red-50 text-red-700 border-b border-red-200" : "bg-orange-50 text-orange-800 border-b border-orange-200"
        }`}>
          <span className="truncate">
            {alertIsRed ? "⚠" : "📅"}{" "}
            {alertList.length > 1
              ? `${alertList.length} postes ${alertIsRed ? "non couverts" : "sans couverture confirmée"} dans moins de 3 mois`
              : alertIsRed
                ? (topAlert.days <= 0
                    ? `${topAlert.post.label} non couvert dès aujourd'hui`
                    : `${topAlert.post.label} non couvert dans ${topAlert.days} jour${topAlert.days > 1 ? "s" : ""}`)
                : `${topAlert.post.label} sans couverture dans ${Math.max(1, Math.round(topAlert.days / 7))} semaine${Math.round(topAlert.days / 7) > 1 ? "s" : ""}`}
          </span>
          <button
            onClick={() => { setDropdown(null); setPanel({ type: "uncovered", post: topAlert.post }); }}
            className={`ml-auto shrink-0 px-3 py-1 rounded-lg font-bold text-white transition ${
              alertIsRed ? "bg-red-600 hover:bg-red-700" : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            Voir le poste
          </button>
        </div>
      )}
      {/* ── Relances en attente (section 203) ──────────────────────────────────
          Placée sous le bandeau d'alerte, dans la même zone « ce qui appelle une action » :
          l'alerte dit ce que le CALENDRIER réclame, cette bande ce que le SUIVI réclame.
          Ne s'affiche que s'il y a quelque chose à montrer — un bandeau permanent à zéro
          apprendrait à l'ignorer. */}
      {totalSuivi > 0 && (
        <div className="flex-shrink-0 border-b border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setRelancesOuvertes((v) => !v)}
            aria-expanded={relancesOuvertes}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            <span className={`transition-transform ${relancesOuvertes ? "rotate-90" : ""}`}>▸</span>
            <span>Suivi</span>
            {aRelancer.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[var(--corail-signal)] text-[#3D1508] font-bold">
                {aRelancer.length} à relancer
              </span>
            )}
            <span className="text-gray-400 font-normal">
              {totalSuivi} élément{totalSuivi > 1 ? "s" : ""} suivi{totalSuivi > 1 ? "s" : ""}, tous postes confondus
            </span>
          </button>

          {relancesOuvertes && (
            <div className="px-4 pb-3 space-y-3">
              {[
                { titre: "À recontacter", items: aRelancer, accent: true },
                { titre: "Autres suivis", items: autresSuivis, accent: false },
              ].filter((g) => g.items.length > 0).map((g) => (
                <div key={g.titre}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">{g.titre}</p>
                  <div className="space-y-1.5">
                    {g.items.map(({ post, mission, statut }) => (
                      <button
                        key={mission.id}
                        type="button"
                        /* Retour à la brique : on rouvre EXACTEMENT le panneau du clic sur la
                           timeline, plutôt que de faire défiler jusqu'à elle. Plus direct, et
                           surtout : aucune duplication, c'est le même Panel. */
                        onClick={() => { setDropdown(null); setPanel({ type: "covered", mission, post }); }}
                        className={`w-full text-left rounded-xl border px-3 py-2 hover:bg-gray-50 transition ${
                          g.accent ? "border-[var(--corail-signal)]/40 bg-[var(--corail-signal)]/5" : "border-gray-150 bg-white"
                        }`}
                      >
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-xs font-bold text-gray-800">{post.label}</span>
                          <span className="text-[11px] font-semibold text-gray-500">{SUIVI[statut]?.label ?? statut}</span>
                          <span className="text-[11px] text-gray-400 truncate">
                            {mission.title}
                            {toDate(mission.startDate) ? ` · ${fmtDate(mission.startDate)}` : ""}
                            {toDate(mission.endDate) ? ` → ${fmtDate(mission.endDate)}` : ""}
                          </span>
                        </div>
                        {mission.statusNote && (
                          <p className="text-[11px] text-gray-600 italic mt-0.5 line-clamp-1">{mission.statusNote}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {notesPoste.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Notes de poste</p>
                  <div className="space-y-1.5">
                    {notesPoste.map((post) => (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => { setDropdown(null); setPanel({ type: "uncovered", post }); }}
                        className="w-full text-left rounded-xl border border-gray-150 bg-white px-3 py-2 hover:bg-gray-50 transition"
                      >
                        <span className="text-xs font-bold text-gray-800">{post.label}</span>
                        <p className="text-[11px] text-gray-600 italic mt-0.5 line-clamp-1">{post.suiviNote}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {confirmModal && (
        <ConfirmModal
          modal={confirmModal}
          onClose={() => setConfirmModal(null)}
        />
      )}

      {/* Modale choix zone non couverte */}
      {uncoveredChoice && (
        <UncoveredChoiceModal
          modal={uncoveredChoice}
          isEmployeur={isEmployeur}
          onCreateMission={() => {
            const { suggestedStart, suggestedEnd, post } = uncoveredChoice;
            setUncoveredChoice(null);
            router.push(buildCreateHref({ postType: post.postType, postId: post.id, postLabel: post.label, start: suggestedStart, end: suggestedEnd , isOwnerSeat: post.isOwnerSeat }));
          }}
          onDeleteAbsence={() => { if (uncoveredChoice.absenceMissionId) handleDeleteAbsence(uncoveredChoice.absenceMissionId); }}
          onEditAbsenceDates={(s, e) => { if (uncoveredChoice.absenceMissionId) handleEditAbsenceDates(uncoveredChoice.absenceMissionId, s, e); }}
          onClosePost={() => {
            const post = uncoveredChoice.post;
            setUncoveredChoice(null);
            if (post.id === "self") return;
            setConfirmModal({
              title: "Fermer cette période",
              body: "Cette période sera marquée non disponible à la réservation. Le poste sera suspendu.",
              onConfirm: async () => {
                setConfirmModal(null);
                await fetch(`/api/cabinet-posts/${post.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ isActive: false }),
                });
                router.refresh();
              },
            });
          }}
          onClose={() => setUncoveredChoice(null)}
        />
      )}

      {/* Menu à 3 choix au clic sur un poste (section 55) */}
      {dropdown && (
        <PostMenu
          dropdown={dropdown}
          onClose={() => setDropdown(null)}
          onPoserAnnonce={() => {
            const m = dropdown.mission;
            const post = dropdown.post;
            setDropdown(null);
            // FUSION (section 188) : sur le siège du détenteur, une absence déclarée EST la
            // période à pourvoir. Publier une annonce dessus la TRANSFORME (elle passe en
            // RECHERCHE) au lieu d'empiler une seconde brique sur les mêmes dates.
            if (post.isOwnerSeat && m && m.briqueStatus.startsWith("ABSENT")) {
              router.push(`/missions/create?editId=${encodeURIComponent(m.id)}`);
              return;
            }
            const s = m ? (toDate(m.startDate)?.toISOString().slice(0, 10) ?? "") : (dropdown.suggestedStart ?? "");
            const e = m ? (toDate(m.endDate)?.toISOString().slice(0, 10) ?? "") : (dropdown.suggestedEnd ?? "");
            router.push(buildCreateHref({ postType: post.postType, postId: post.id, postLabel: post.label, start: s, end: e , isOwnerSeat: post.isOwnerSeat }));
          }}
          onDetail={() => {
            const m = dropdown.mission;
            setDropdown(null);
            const hasMatch = !!m && (m.matchesA.length > 0 || m.matchesB.length > 0);
            if (hasMatch && m) setPanel({ type: "covered", mission: m, post: dropdown.post });
            else setPanel({ type: "uncovered", post: dropdown.post });
          }}
          onRetirer={() => requestRemovePost(dropdown.post)}
          onDone={() => { setDropdown(null); router.refresh(); }}
          onSeeRelations={() => {
            const m = dropdown.mission;
            setDropdown(null);
            // Cas 2 READ — tray filtré sur cette annonce (réutilise le filtre section 105)
            if (m) router.push(`/annonces?disponibiliteId=${encodeURIComponent(m.id)}`);
          }}
          onEditAnnonce={() => {
            const m = dropdown.mission;
            setDropdown(null);
            // Cas 2 UPDATE — formulaire de création en mode édition
            if (m) router.push(`/missions/create?editId=${encodeURIComponent(m.id)}`);
          }}
          onEditMission={(missionId) => {
            setDropdown(null);
            router.push(`/missions/create?editId=${encodeURIComponent(missionId)}`);
          }}
        />
      )}

      {/* ── En-tête ── */}
      <div className="bg-white border-b border-gray-100 px-3 sm:px-4 py-3 flex flex-wrap items-center gap-2 sm:gap-3 flex-shrink-0">
        <div className="w-full sm:w-auto sm:flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-gray-900">Mon Planning</h1>
          {/* +1 : le titulaire lui-même occupe un poste (sa ligne est affichée dans le planning),
              en plus des CabinetPost de l'équipe. */}
          <p className="text-xs text-gray-400 truncate">{posts.length} poste{posts.length !== 1 ? "s" : ""} · {cabinetName}</p>
          {/* Confrère trouvé hors Soignect (24/10) — cabinets libéraux seulement. */}
          {/* Section 372 : un vrai bouton, plus un lien souligné en petit sous le titre. */}
          {!isEmployeur && (
            <a
              href={CONTRAT_DIRECT.href}
              className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-kine-600 px-3 py-1.5 text-xs font-semibold text-kine-700 hover:bg-kine-50 transition"
            >
              📝 {CONTRAT_DIRECT.libelle} {CONTRAT_DIRECT.complement}
            </a>
          )}
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
          {(["month", "quarter", "year", "triennial"] as Zoom[]).map(z => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`md3-ripple px-3 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                zoom === z ? "bg-white text-kine-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {ZOOM_LABELS[z]}
            </button>
          ))}
        </div>

        {/* Les deux actions groupées avec un gap FIXE (section 154) — évite que le flex-1 du
            titre ne les écarte de façon déséquilibrée (effet « space-between »). */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              const inTwoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
              setPanel({ type: "declare_absence", suggestedStart: today, suggestedEnd: inTwoWeeks });
              setDropdown(null);
            }}
            className="md3-ripple px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition flex items-center gap-1"
          >
            + Déclarer une absence
          </button>

          <button
            onClick={() => { setPanel({ type: "add_post" }); setDropdown(null); }}
            className="md3-ripple px-3 py-2 bg-kine-600 text-white rounded-xl text-xs font-bold hover:bg-kine-700 transition flex items-center gap-1"
          >
            + Ajouter un poste
          </button>
        </div>
      </div>

      {/* ── Corps : timeline + panel ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Timeline */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* Vue VERTICALE — mobile portrait (< 640px) : postes empilés, barres compactes, pas de scroll horizontal */}
          {isMobile && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <p className="text-[11px] text-gray-400 text-center">
                Vue {ZOOM_LABELS[zoom]} · {fmtDate(mWin.start)} → {fmtDate(mWin.end)}
              </p>
              {allRows.map(post => (
                <MobilePostCard key={post.id} label={post.label} bricks={buildPostBricks(post)} todayPct={todayPct} onLabelClick={() => openPostMenu(post)} />
              ))}
              {allRows.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  <p className="mb-2">Aucun poste configuré</p>
                  <button onClick={() => setPanel({ type: "add_post" })} className="md3-ripple px-4 py-2 bg-kine-600 text-white rounded-xl text-xs font-bold">+ Ajouter un poste</button>
                </div>
              )}
            </div>
          )}

          {/* Vue HORIZONTALE — desktop / paysage (>= 640px) */}
          {!isMobile && (
          <>
          {/* En-tête mois */}
          <div className="flex flex-shrink-0 border-b border-gray-200 bg-white">
            <div style={{ width: labelWidth, flexShrink: 0 }} className="border-r border-gray-100 bg-gray-50" />
            <div className="overflow-hidden flex-1" ref={scrollRef}>
              <div className="relative h-7" style={{ width: totalWidth }}>
                {mLabels.map((m) => {
                  // Item 7 : en vue condensée, 1 mois sur 2/3 ; janvier toujours affiché (changement d'année)
                  if (m.index % monthSkip !== 0 && !m.isYearStart) return null;
                  return (
                    <div key={m.index} className="absolute top-0 bottom-0 flex items-center" style={{ left: m.offset }}>
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lagon-profond)]/80 pl-1 whitespace-nowrap">
                        {m.monthShort}{m.isYearStart ? ` ${m.year}` : ""}
                      </span>
                      <div className="absolute top-0 bottom-0 left-0 w-px bg-gray-200" />
                    </div>
                  );
                })}
                {/* Signature sections 46-47 — "aujourd'hui" comme flèche de progression :
                    trait lagon pulsant + triangle ▶ pointant vers le futur + label flottant. */}
                <div
                  className="planning-today-line absolute top-0 bottom-0 w-px bg-[var(--lagon-profond)] z-20 cursor-help"
                  style={{ left: todayOff }}
                  title={`Aujourd'hui — ${todayFull}`}
                >
                  {/* Label "auj." flottant au-dessus */}
                  <span className="absolute top-0.5 left-1.5 text-[9px] font-bold tracking-wide text-[var(--lagon-profond)] whitespace-nowrap">auj.</span>
                  {/* Triangle ▶ centré sur la ligne, pointant vers la droite (le futur) */}
                  <div className="planning-today-marker absolute top-1/2 -translate-y-1/2 left-[1px] w-0 h-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-[var(--lagon-profond)]" />
                </div>
              </div>
            </div>
          </div>

          {/* Lignes */}
          <div
            ref={rowsScrollRef}
            className="flex-1 overflow-y-auto overflow-x-auto pr-6"
            onScroll={(e) => {
              // Synchronise l'en-tête des mois avec le défilement horizontal des lignes
              if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, e.currentTarget.scrollLeft - labelWidth);
            }}
          >
            <div style={{ minWidth: totalWidth + labelWidth }}>
              {allRows.map(post => (
                <TimelineRow
                  key={post.id}
                  post={post}
                  dayWidth={dayWidth}
                  totalWidth={totalWidth}
                  todayOffset={todayOff}
                  labelWidth={labelWidth}
                  localStatuses={localStatuses}
                  onUncoveredClick={handleUncoveredClick}
                  onBrickClick={openDropdown}
                  onPanelClick={(p) => { setPanel(p); setDropdown(null); }}
                  onPostMenuClick={openPostMenu}
                />
              ))}

              {allRows.length === 0 && (
                <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                  <div className="text-center">
                    <p className="mb-2">Aucun poste configuré</p>
                    <button
                      onClick={() => setPanel({ type: "add_post" })}
                      className="px-4 py-2 bg-kine-600 text-white rounded-xl text-xs font-bold hover:bg-kine-700 transition"
                    >
                      + Ajouter un poste
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          </>
          )}

          {/* ── Annonces dont la période est écoulée (section 247, complété le 13/09) ──────
              POURQUOI UNE SECTION, ET PAS SEULEMENT LA BRIQUE. Vérifié à l'écran : sur les trois
              annonces périmées du cabinet, UNE SEULE portait un avertissement lisible. Les deux
              autres étaient hors d'atteinte — l'une rendue sur 33 px, sous le seuil de 40 px qui
              masque le libellé ; l'autre pas rendue du tout, sa période tombant hors de la fenêtre
              de la frise.
              Une alerte posée sur la timeline ne peut donc pas couvrir ce cas : plus une annonce
              est ancienne, moins sa brique est visible — alors que c'est exactement celle-là qui
              traîne dans le fil des candidats. Le récapitulatif, lui, ne dépend d'aucune date. */}
          {annoncesAMettreAJour.length > 0 && (
            <div className="flex-shrink-0 border-t border-amber-200 bg-amber-50/40 px-3 sm:px-4 py-3 max-h-56 overflow-y-auto">
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-2">
                {annoncesAMettreAJour.length} annonce{annoncesAMettreAJour.length > 1 ? "s" : ""} à mettre à jour
              </p>
              <div className="space-y-2">
                {annoncesAMettreAJour.map((m) => (
                  <div key={m.id} className="rounded-xl border border-amber-200 bg-white p-3">
                    <p className="text-sm font-semibold text-gray-800 truncate">{m.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {/* Une annonce sur un poste déjà tenu n'a pas forcément de date de fin :
                          annoncer « Terminée le — » y serait faux. On dit ce qui est vrai. */}
                      {m.perimee ? `Terminée le ${fmtDate(m.endDate)}` : "Période encore ouverte"}
                      {m.posteLabel ? ` · poste « ${m.posteLabel} »` : " · non rattachée à un poste"}
                    </p>
                    {m.perimee && <div className="mt-1.5"><EncartPeriodeEcoulee /></div>}
                    {m.occupant && <div className="mt-1.5"><EncartPosteDejaTenu occupant={m.occupant} /></div>}
                    <button
                      type="button"
                      onClick={() => router.push(`/missions/create?editId=${encodeURIComponent(m.id)}`)}
                      className="mt-2 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-kine-600 text-white hover:bg-kine-700 transition"
                    >
                      Modifier cette annonce →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Annonces non rattachées à un poste (section 187) — créées via « + Annonce »
              sans cible sur la timeline (cabinetPostId = null). Sans cette section, elles
              étaient chargées côté serveur (unlinkedMissions) mais JAMAIS rendues : invisibles
              sur le Planning et donc impossibles à partager (le partage vivait uniquement dans
              le menu « Gérer ce poste » d'une brique de la timeline). ── */}
          {unlinkedMissions.length > 0 && (
            <div className="flex-shrink-0 border-t border-gray-100 bg-white px-3 sm:px-4 py-3 max-h-56 overflow-y-auto">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">
                Annonces non rattachées à un poste
              </p>
              <div className="space-y-2">
                {unlinkedMissions.map((m) => {
                  const start = toDate(m.startDate), end = toDate(m.endDate);
                  // Période écoulée — même règle et même texte que dans « Gérer ce poste ».
                  const perimee = estAnnoncePerimee(m);
                  return (
                    <div key={m.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <p className="text-sm font-semibold text-gray-800 truncate">{m.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        <span className="inline-block px-1.5 py-0.5 rounded-full bg-[var(--ambre)]/20 text-[#8a5a00] text-[10px] font-bold mr-1.5">
                          {isEmployeur || m.natureSalariat
                            ? libelleTypePoste(m.missionType, { type: "TITULAIRE", titulaireKind: isEmployeur ? "STRUCTURE" : "CABINET" }, m.natureSalariat)
                            : TYPE_LABEL[m.missionType] ?? m.missionType}
                        </span>
                        {start && end ? `${fmtDate(start)} → ${fmtDate(end)}` : "Sans dates"}
                      </p>
                      {perimee && <div className="mt-1.5"><EncartPeriodeEcoulee /></div>}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => router.push(`/annonces?disponibiliteId=${encodeURIComponent(m.id)}`)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-kine-600 text-white hover:bg-kine-700 transition"
                        >
                          Voir les mises en relation →
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push(`/missions/create?editId=${encodeURIComponent(m.id)}`)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-700 hover:bg-white transition"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmModal({
                            title: "Annuler cette annonce",
                            body: `L'annonce « ${m.title} » sera définitivement supprimée. Cette action est irréversible.`,
                            onConfirm: async () => {
                              setConfirmModal(null);
                              await fetch(`/api/missions/${m.id}`, { method: "DELETE" });
                              router.refresh();
                            },
                          })}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-red-200 text-red-600 hover:bg-red-50 transition"
                        >
                          Annuler l&apos;annonce
                        </button>
                      </div>
                      <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Partager cette annonce</p>
                        <ShareActions path={cheminPartageAnnonce(m)} title={m.title} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Légende */}
          <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-2 flex items-center gap-4 overflow-x-auto">
            {/* Couleurs lues dans BRIQUE_STATUS — une seule source pour la brique, l'infobulle
                et la légende (section 297). */}
            {[
              // Un établissement n'a ni « titulaire » ni « remplaçant » : il a des salariés en poste.
              { color: BRIQUE_STATUS.PRESENT.bg,             label: isEmployeur ? "En poste" : "Titulaire" },
              { color: BRIQUE_STATUS.CONFIRME.bg,            label: BRIQUE_STATUS.CONFIRME.label },
              { color: BRIQUE_STATUS.REMPLACANT_EN_PLACE.bg, label: isEmployeur ? "Remplacement en cours" : BRIQUE_STATUS.REMPLACANT_EN_PLACE.label },
              { color: BRIQUE_STATUS.RECHERCHE.bg,           label: BRIQUE_STATUS.RECHERCHE.label },
              { color: BRIQUE_STATUS.FERME.bg,               label: BRIQUE_STATUS.FERME.label },
              { color: "bg-[#E8633D]/20 border border-[#E8633D]/40", label: "Non couvert" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`w-3 h-3 rounded-[3px] ${l.color}`} />
                <span className="text-[10px] text-gray-500 whitespace-nowrap">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Panel latéral droit */}
        {panel && (
          <>
            {/* Backdrop mobile — tap pour fermer */}
            <div className="fixed inset-0 bg-black/40 z-40 sm:hidden" onClick={() => setPanel(null)} />
            {/* Panneau : bottom sheet sur mobile, colonne latérale sur desktop */}
            <div className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl md3-sheet-in
                            sm:static sm:inset-auto sm:z-auto sm:max-h-none sm:w-72 sm:flex-shrink-0 sm:rounded-none sm:border-t-0 sm:border-l sm:shadow-none sm:animate-none">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-2 sm:hidden" />
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Détail</span>
                  <button onClick={() => setPanel(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
                </div>
                <SidePanel
                  panel={panel}
                  onClose={() => setPanel(null)}
                  onClosePost={requestClosePost}
                  isEmployeur={isEmployeur}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
