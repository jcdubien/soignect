"use client";

import { MissionData, PostData, LANE_PAD, MOBILE_TRACK_HEIGHT, assignLanes, LANE_PITCH, trackHeightFor, laneStyle, RANGE_END, TOTAL_DAYS, BRIQUE_STATUS, SUIVI, estAnnoncePerimee, computeOwnerSeatGaps, computeUncoveredGaps, daysUntil, uncoveredUrgency, MobileBrick, Panel, toDate, dayOffset, fmtDate, getEffectiveStatus } from "./modele";

// Carte d'un poste empilée verticalement : barre horizontale compacte des segments
export function MobilePostCard({ label, bricks, todayPct, onLabelClick }: {
  label: string; bricks: MobileBrick[]; todayPct: number; onLabelClick?: () => void;
}) {
  // Même règle que la vue desktop : la piste grandit d'une sous-ligne par bande supplémentaire
  // et les bandes se partagent l'espace à parts égales (section 264). À une sous-ligne, la
  // hauteur mobile historique (56) est conservée à l'identique.
  const laneCount = Math.max(1, ...bricks.map((b) => (b.lane ?? 0) + 1));
  const pisteH = MOBILE_TRACK_HEIGHT + (laneCount - 1) * LANE_PITCH;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
      {onLabelClick ? (
        <button type="button" onClick={onLabelClick} title="Gérer ce poste"
          className="text-sm font-semibold text-gray-800 truncate mb-2 block text-left w-full hover:text-kine-700 transition">
          {label}
        </button>
      ) : (
        <p className="text-sm font-semibold text-gray-800 truncate mb-2">{label}</p>
      )}
      {/* Toute la piste (y compris la zone vide) ouvre le menu du poste sur mobile (section 156) —
          avant, seules les briques répondaient. Un tap sur une brique garde son handler propre. */}
      <div
        className={`relative rounded-lg bg-[var(--sable-chaud)] overflow-hidden ${onLabelClick ? "cursor-pointer" : ""}`}
        style={{ height: pisteH }}
        onClick={onLabelClick ? (e) => { if (e.target === e.currentTarget) onLabelClick(); } : undefined}
      >
        {bricks.map(b => (
          <button
            key={b.key}
            onClick={b.onClick}
            title={b.title}
            className={`md3-ripple absolute rounded-[5px] flex items-center px-1 overflow-hidden ${b.lane !== undefined ? "ring-1 ring-white" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagon-profond)] ${b.colorCls} ${b.urgent ? "motion-safe:animate-pulse" : ""}`}
            style={{
              // position en STYLE INLINE, obligatoire : `.md3-ripple { position: relative }`
              // (globals.css) est déclarée après les utilitaires Tailwind et l'emportait sur
              // `absolute`. Les briques mobiles héritaient donc de `relative` : leurs left/top
              // étaient ignorés et elles s'empilaient dans l'ordre du flux, hors de la frise —
              // mesuré ici, une brique à `top: 4px` s'affichait 86 px plus bas, hors piste.
              // Le MissionBrick desktop forçait déjà ce style ; le mobile avait été oublié.
              position: "absolute",
              left: `${b.leftPct}%`,
              width: `${Math.max(b.widthPct, 2)}%`,
              // Fonds et zones non couvertes (lane undefined) gardent la pleine hauteur.
              ...(b.lane === undefined
                ? { top: LANE_PAD, height: pisteH - LANE_PAD * 2 }
                : laneStyle(b.lane, laneCount, pisteH)),
            }}
          >
            <span className="text-[9px] font-medium truncate leading-none">{b.label}</span>
            {/* Pastille de suivi (section 200) — superposée, jamais dans le flux : la piste
                mobile est déjà étroite et une brique poussée sortirait de sa sous-ligne. */}
            {b.suiviDot && (
              <span aria-hidden className={`absolute top-[2px] right-[2px] w-[5px] h-[5px] rounded-full ring-1 ring-black/20 ${b.suiviDot}`} />
            )}
          </button>
        ))}
        {/* Ligne "aujourd'hui" verticale à l'intérieur de la carte */}
        {todayPct >= 0 && todayPct <= 100 && (
          <div
            className="planning-today-line absolute top-0 bottom-0 w-px bg-[var(--lagon-profond)] z-10 pointer-events-none"
            style={{ left: `${todayPct}%` }}
          />
        )}
      </div>
    </div>
  );
}


// ── Composant MissionBrick ────────────────────────────────────────────────────

export function MissionBrick({
  mission,
  post,
  dayWidth,
  effectiveStatus,
  isSelf,
  lane,
  laneCount,
  trackHeight,
  onBrickClick,
  onPanelClick,
}: {
  mission: MissionData;
  post: PostData;
  dayWidth: number;
  effectiveStatus: string;
  isSelf: boolean;
  lane: number;
  laneCount: number;
  trackHeight: number;
  onBrickClick: (mission: MissionData, post: PostData, isSelf: boolean, e: React.MouseEvent) => void;
  onPanelClick: (panel: Panel) => void;
}) {
  const start = toDate(mission.startDate);
  if (!start) return null;
  // Fin effective : date de départ prévue (section 6) sinon endDate ; null = durée
  // indéterminée → brique ouverte jusqu'au bord droit (section 57 mode C).
  const end = toDate(mission.departureDate) ?? toDate(mission.endDate) ?? RANGE_END;
  // Segment CONFIRMÉ/RECRUTEMENT : affiche le nom du successeur matché s'il existe (section 6)
  const brickLabel = mission.matchedName || mission.title;

  // ── DEUX FAITS QUE LA BRIQUE TAISAIT (section 247) ────────────────────────────────────────
  //
  // SANS DATE DE FIN. `departureDate ?? endDate ?? RANGE_END` étend la brique jusqu'au bord
  // droit — c'est voulu (durée indéterminée, section 57 mode C). Mais rien ne le DISAIT : le
  // poste de Marion n'affichait que son prénom, en vert, sur toute la frise. Signalé le 09/09
  // comme « la bande n'affiche aucun texte d'annonce », alors que le poste était simplement
  // occupé sans terme connu. Le comportement était juste, l'écran muet.
  const sansTerme = !mission.departureDate && !mission.endDate;

  // DATES DÉPASSÉES. Une annonce ACTIVE dont la période est écoulée continue d'être proposée
  // aux candidats — le feed ne filtre pas sur les dates. Mesuré le 12/09 : 5 des 38 annonces
  // actives étaient dans ce cas, dont un « Remplacement URGENT » terminé depuis trois semaines.
  const finPassee = estAnnoncePerimee(mission);

  const left  = Math.max(dayOffset(start), 0) * dayWidth;
  const right = Math.min(dayOffset(end), TOTAL_DAYS) * dayWidth;
  const width = right - left;
  if (width <= 0) return null;

  const suivi = mission.suiviStatut ? SUIVI[mission.suiviStatut] : null;
  const st = BRIQUE_STATUS[effectiveStatus] ?? BRIQUE_STATUS["RECHERCHE"];
  // Fermé volontairement → gris hachuré (section 47)
  const isHatch = effectiveStatus === "FERME";
  const brickColor = isHatch ? "timeline-hatch text-white" : `${st.bg} ${st.text}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelf) {
      // Self post : ouvre le panel directement
      onPanelClick({ type: "covered", mission, post });
    } else {
      // Autres briques : ouvre le menu contextuel
      onBrickClick(mission, post, false, e);
    }
  };

  // Activation clavier (Entrée / Espace) — accessibilité section 46
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (isSelf) {
      onPanelClick({ type: "covered", mission, post });
    } else {
      const r = e.currentTarget.getBoundingClientRect();
      onBrickClick(mission, post, false, {
        stopPropagation() {}, clientX: r.left, clientY: r.bottom,
      } as unknown as React.MouseEvent);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`absolute rounded-[6px] flex items-center px-2 cursor-pointer select-none overflow-hidden transition-[filter,box-shadow] duration-200 hover:brightness-95 hover:shadow-md ring-1 ring-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagon-profond)] focus-visible:ring-offset-1 ${brickColor}`}
      style={{ left, width: Math.max(width, 24), position: "absolute", ...laneStyle(lane, laneCount, trackHeight) }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title={`${mission.title} · ${fmtDate(mission.startDate)} → ${sansTerme ? "sans date de fin" : fmtDate(mission.endDate)} · ${st.label}${finPassee ? " · période écoulée" : ""}${suivi ? ` · ${suivi.label}` : ""}`}
    >
      {/* Libellé masqué si brique trop petite (< 40px) — vue condensée (section 47) */}
      {Math.max(width, 24) >= 40 && (
        <span className="text-[11px] font-medium truncate">
          {finPassee && <span aria-hidden className="mr-1">⚠️</span>}
          {brickLabel}
          {/* Le « sans date de fin » n'est écrit que s'il reste de la place : sur une brique
              étroite il ferait disparaître le nom, qui compte davantage. */}
          {sansTerme && Math.max(width, 24) >= 150 && (
            <span className="font-normal opacity-70"> · sans date de fin</span>
          )}
        </span>
      )}
      {/* Pastille de suivi (section 200) : superposée en coin, en position absolue, pour ne
          RIEN ajouter au flux. Une brique de 47 px avait déjà disparu sous une autre faute de
          place (défaut 3 du 03/08, un recrutement actif invisible en production) — ce repère
          ne doit jamais pousser la brique ni la faire grandir. */}
      {suivi && (
        <span
          aria-hidden
          className={`absolute top-[3px] right-[3px] w-[6px] h-[6px] rounded-full ring-1 ring-black/20 ${suivi.dot}`}
        />
      )}
    </div>
  );
}

// ── Timeline row ───────────────────────────────────────────────────────────────

export function TimelineRow({
  post, dayWidth, totalWidth, todayOffset, labelWidth,
  onUncoveredClick, onBrickClick, onPanelClick, onPostMenuClick,
  localStatuses,
}: {
  post: PostData;
  dayWidth: number;
  totalWidth: number;
  todayOffset: number;
  labelWidth: number;
  localStatuses: Record<string, string>;
  onUncoveredClick: (post: PostData, clickedDate: Date) => void;
  onBrickClick: (mission: MissionData, post: PostData, isSelf: boolean, e: React.MouseEvent) => void;
  onPanelClick: (panel: Panel) => void;
  onPostMenuClick: (post: PostData) => void;
}) {
  const now = new Date();
  const isSelf = post.id === "self";

  // Répartition des briques en sous-lignes. On borne chaque mission comme le fait MissionBrick
  // (départ prévu, sinon fin, sinon ouverte jusqu'au bord droit) pour que le calcul colle au rendu.
  const debutDe = (m: MissionData) => dayOffset(toDate(m.startDate)!);
  const finDe   = (m: MissionData) => dayOffset(toDate(m.departureDate) ?? toDate(m.endDate) ?? RANGE_END);

  // COMPTER CE QUI EST DESSINÉ, PAS CE QUI EXISTE (section 264). MissionBrick renvoie `null`
  // quand la période tombe entièrement hors de la plage affichée (`width <= 0`). Ces missions
  // consommaient malgré tout un indice de sous-ligne : la piste grandissait pour une bande vide,
  // et la brique restante se retrouvait décalée vers le bas d'une hauteur sans contenu. On
  // applique donc ici le MÊME bornage que le rendu.
  const missionsDatees = post.missions.filter((m) => {
    if (!toDate(m.startDate)) return false;
    return Math.min(finDe(m), TOTAL_DAYS) > Math.max(debutDe(m), 0);
  });

  // Garde d'invisibilité, convertie dans l'unité des bornes (des jours) : 6 px de l'hôte doivent
  // rester visibles d'un côté au moins pour qu'une brique ait le droit de se loger dedans.
  const margeVisible = dayWidth > 0 ? 6 / dayWidth : 0;
  const { lanes, count: laneCount } = assignLanes(missionsDatees, debutDe, finDe, margeVisible);
  const trackHeight = trackHeightFor(laneCount);

  // ORDRE DE PEINTURE : la plus longue d'abord. Dans une bande partagée par inclusion, le
  // contenant doit être posé AVANT la brique qui se loge dedans — sans ça, l'ordre de la base
  // décide au hasard laquelle des deux est visible.
  // Les missions sans date de début ne se peignent pas (MissionBrick renvoie `null`) et n'ont
  // pas de longueur à comparer : on les laisse à la fin plutôt que de les passer au tri.
  const sansDate = post.missions.filter((m) => !toDate(m.startDate));
  const missionsAPeindre = [
    ...post.missions
      .filter((m) => toDate(m.startDate))
      .sort((a, b) => (finDe(b) - debutDe(b)) - (finDe(a) - debutDe(a))),
    ...sansDate,
  ];

  return (
    <div className="flex border-b border-gray-100 last:border-0" style={{ height: trackHeight }}>
      {/* Label fixe — cliquable : ouvre le menu du poste (gérer / définir / modifier) */}
      <button
        type="button"
        onClick={() => onPostMenuClick(post)}
        title="Gérer ce poste"
        className="shrink-0 sticky left-0 z-20 flex items-center px-2 sm:px-3 border-r border-gray-100 bg-gray-50 text-left hover:bg-gray-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagon-profond)]"
        style={{ width: labelWidth }}
      >
        <div className="min-w-0">
          {/* Siège du détenteur : son nom, mention « titulaire » en dessous — à côté, elle
              était mangée par la troncature du nom dans une colonne étroite. */}
          <span className="min-w-0">
            <span className="text-xs font-semibold text-gray-700 truncate block">{post.label}</span>
            {post.isOwnerSeat && (
              <span className="block text-[10px] uppercase tracking-wide text-gray-400 leading-tight">titulaire</span>
            )}
          </span>
          {!post.isActive && !isSelf && (
            <span className="text-[9px] text-gray-400 font-medium">Fermé</span>
          )}
        </div>
      </button>

      {/* Piste — toute la zone (y compris le vide) ouvre le menu du poste (section 156) :
          avant, seuls le label/les briques/les gaps répondaient, la zone sable vide était
          inerte → les postes semblaient « non cliquables ». Un clic sur une brique/un gap garde
          son handler propre (target !== currentTarget). */}
      <div
        className={`relative flex-1 overflow-hidden bg-[var(--sable-chaud)] ${isSelf ? "" : "cursor-pointer"}`}
        onClick={isSelf ? undefined : (e) => { if (e.target === e.currentTarget) onPostMenuClick(post); }}
      >
        <div
          className="relative"
          style={{ width: totalWidth, height: "100%" }}
          onClick={isSelf ? undefined : (e) => { if (e.target === e.currentTarget) onPostMenuClick(post); }}
        >
          {/* Siège du détenteur : fond « Présence » sur toute la ligne. Sa présence est
              implicite — sans ce fond, une ligne sans absence apparaissait vide, ce qui se
              lit comme un poste vacant alors que c'est l'inverse. Les briques d'absence et
              les zones non couvertes se posent par-dessus. */}
          {post.isOwnerSeat && (
            <div
              className="absolute top-1 bottom-1 left-0 rounded-[6px] bg-[var(--bleu-marine)] text-white flex items-center px-2 pointer-events-none"
              style={{ width: totalWidth }}
            >
              <span className="text-[11px] font-medium sticky left-2">Présence</span>
            </div>
          )}

          {/* Segments NON_COUVERT calculés entre les missions */}
          {!isSelf && post.isActive && now.getTime() < RANGE_END.getTime() &&
            (post.isOwnerSeat ? computeOwnerSeatGaps(post.missions) : computeUncoveredGaps(post.missions)).map((gap, gi) => {
              const gLeft  = Math.max(dayOffset(gap.start), 0) * dayWidth;
              const gRight = Math.min(dayOffset(gap.end), TOTAL_DAYS) * dayWidth;
              const gWidth = gRight - gLeft;
              if (gWidth <= 0) return null;
              const u = uncoveredUrgency(gap.start);
              const gDays = daysUntil(gap.start);
              return (
                <div
                  key={`gap-${gi}`}
                  role="button"
                  tabIndex={0}
                  className={`absolute top-1 bottom-1 rounded-[6px] cursor-pointer transition-[filter,box-shadow] duration-200 hover:brightness-95 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lagon-profond)] focus-visible:ring-offset-1 ${u.cls} ${u.urgent ? "motion-safe:animate-pulse" : ""}`}
                  style={{ left: gLeft, width: Math.max(gWidth, 4) }}
                  onClick={() => onUncoveredClick(post, gap.start)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onUncoveredClick(post, gap.start); }
                  }}
                  title={`Non couvert — commence dans ${gDays} j · ${u.label}`}
                />
              );
            })
          }

          {/* Briques missions — ordre de peinture : contenant d'abord (section 264) */}
          {missionsAPeindre.map(m => (
            <MissionBrick
              key={m.id}
              mission={m}
              post={post}
              dayWidth={dayWidth}
              effectiveStatus={isSelf ? "PRESENT" : getEffectiveStatus(m, post, localStatuses)}
              isSelf={isSelf}
              lane={lanes.get(m) ?? 0}
              laneCount={laneCount}
              trackHeight={trackHeight}
              onBrickClick={onBrickClick}
              onPanelClick={onPanelClick}
            />
          ))}

          {/* Ligne aujourd'hui — lagon profond, pulsation douce (section 46) */}
          <div
            className="planning-today-line absolute top-0 bottom-0 w-px bg-[var(--lagon-profond)] z-10 pointer-events-none"
            style={{ left: todayOffset }}
          />
        </div>
      </div>
    </div>
  );
}
