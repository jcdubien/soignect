import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileType, TitulaireKind, Prisma, BriqueStatus } from "@prisma/client";
import { stripMissionProfiles } from "@/lib/publicProfile";
import { NO_ACTIVE_MATCH_FILTER } from "@/lib/feedFilters";
import { getDesirabilityPercent, bonusSaisonnier } from "@/lib/desirability";
import { chargerPrioritesTerritoriales, type PrioriteAppliquee } from "@/lib/territoire";
import { logTraceEvent } from "@/lib/trace";

export const dynamic = "force-dynamic";

// GET /api/feed — annonces du camp opposé, ordonnées par mise en avant commerciale
// (désirabilité effective), puis note et fraîcheur. Cet ordre est le SEUL endroit où
// l'abonnement joue : il n'entre plus dans le score de compatibilité affiché.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const myProfile = await prisma.profile.findUnique({
    where: { id: session.user.profileId as string },
  });
  if (!myProfile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const swipedIds = await prisma.swipe.findMany({
    where: { swiperId: myProfile.id },
    select: { swipedMissionId: true },
  });
  const excludeMissionIds = swipedIds.map((s) => s.swipedMissionId);

  const oppositeTypes =
    myProfile.type === ProfileType.TITULAIRE
      ? [ProfileType.REMPLACANT, ProfileType.ASSISTANT]
      : [ProfileType.TITULAIRE];

  const { searchParams } = new URL(req.url);
  const location        = searchParams.get("location");
  const limit           = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const targetMissionId = searchParams.get("targetMissionId");

  // When TITULAIRE selects a specific mission chip, filter candidats whose dates overlap
  let dateFilter: { startDate?: object; endDate?: object } = {};
  // Période visée par le cabinet — déjà chargée pour le filtre de dates, on la garde pour le
  // bonus saisonnier (section 197), qui ne s'applique que si le besoin recoupe mai-octobre.
  let besoinPeriode: { startDate: Date | null; endDate: Date | null } | null = null;
  if (myProfile.type === ProfileType.TITULAIRE && targetMissionId) {
    const targetMission = await prisma.mission.findUnique({
      where: { id: targetMissionId },
      select: { startDate: true, endDate: true },
    });
    // Conservée même sans date de fin : un poste long terme a un début et pas de fin, et son
    // besoin recoupe la fenêtre tout autant. Le FILTRE, lui, exige toujours les deux bornes.
    if (targetMission) besoinPeriode = { startDate: targetMission.startDate, endDate: targetMission.endDate };
    if (targetMission?.startDate && targetMission?.endDate) {
      dateFilter = {
        startDate: { lte: targetMission.endDate },
        endDate:   { gte: targetMission.startDate },
      };
    }
  }

  // Gating « ouverture au salariat » (section 154, opt-in) :
  //  - Candidat (REMPLACANT/ASSISTANT) NON opté → ne voit pas les missions des STRUCTURES
  //    (contrats salariés CDD/CDI/Stage/Vacation). Les cabinets libéraux restent visibles.
  //  - Viewer STRUCTURE → ne voit que les candidats ayant coché « ouvert au salariat ».
  //    (Un cabinet libéral titulaire, lui, voit tous les candidats — comportement inchangé.)
  // La PROFESSION du lecteur borne son feed (17/08). Elle ne le bornait pas du tout : l'enum
  // `Profession` compte 5 valeurs, l'utilisateur la change lui-même dans /compte, et aucune
  // requête du produit ne la lisait. Un infirmier passant sa profession se serait vu proposer
  // des annonces de cabinets de kiné, et serait apparu dans le leur.
  //
  // Sans occurrence à ce jour — les 15 profils en base sont tous KINESITHERAPEUTE, vérifié en
  // lecture avant d'écrire cette ligne. C'est précisément ce qui la rendait invisible : le
  // défaut de la colonne masquait l'absence de filtre. Le filtre est donc sans effet
  // aujourd'hui, et c'est voulu — il ferme la fuite avant le premier cas, pas après.
  //
  // NE PRÉPARE AUCUNE OUVERTURE au multi-profession (séquence fondatrice) : il compare le
  // lecteur aux annonceurs, il ne rend rien configurable.
  const profileWhere: Prisma.ProfileWhereInput = {
    type: { in: oppositeTypes },
    isActive: true,
    profession: myProfile.profession,
    id: { not: myProfile.id },
  };
  const isCandidateViewer = myProfile.type !== ProfileType.TITULAIRE;
  const isStructureViewer =
    myProfile.type === ProfileType.TITULAIRE && myProfile.titulaireKind === TitulaireKind.STRUCTURE;
  if (isCandidateViewer && !myProfile.ouvertSalariat) {
    profileWhere.titulaireKind = { not: TitulaireKind.STRUCTURE };
  }
  if (isStructureViewer) {
    profileWhere.ouvertSalariat = true;
  }

  const missions = await prisma.mission.findMany({
    where: {
      isActive: true,
      briqueStatus: { not: BriqueStatus.INDISPONIBLE }, // « Dates bloquées » = pas une offre
      // Les absences du titulaire (congés, présence) ne sont pas des offres non plus : elles
      // étaient pourtant swipables, un candidat s'est vu proposer une annonce « Congés ».
      // C'est aussi ce qui créait des Swipe sur une absence, bloquant ensuite sa suppression.
      isSelfPresence: false,
      id: { notIn: excludeMissionIds },
      ...NO_ACTIVE_MATCH_FILTER,
      profile: profileWhere,
      ...(location ? { location } : {}),
      ...dateFilter,
    },
    include: { profile: true },
    orderBy: [
      { profile: { ratingAvg: "desc" } },
      { createdAt: "desc" },
    ],
    take: limit,
  });

  // Mise en avant commerciale — ELLE VIT ICI, dans l'ordre d'affichage, et nulle part ailleurs.
  // Elle sortait auparavant du score de compatibilité, où elle affirmait une chose fausse : le
  // statut d'abonnement de l'annonceur n'est pas une propriété de l'accord entre deux personnes.
  // Le tri SQL se faisait sur la colonne desirabilityScore brute, qui ignore le plan, le statut
  // fondateur et les arbitrages admin ; on trie donc sur la désirabilité EFFECTIVE, après
  // récupération de la page (au plus `limit` lignes, 50 max).
  //
  // S'y ajoute le BONUS SAISONNIER (section 197) : une disponibilité qui couvre mai-octobre
  // remonte, mais UNIQUEMENT devant un cabinet dont le besoin recoupe lui aussi cette fenêtre.
  // Sans cette condition, un cabinet recrutant pour décembre aurait vu des candidats d'août en
  // tête — l'ordre l'aurait mis en avant avant que le score ne dise « dates éloignées ».
  // S'y ajoute enfin la PRIORITÉ TERRITORIALE DÉCLARÉE (section 214) : une commune qu'une
  // institution a déclarée prioritaire remonte ses annonces (`PrioriteTerritoriale`, niveau
  // 1..10 → 3..30 points), à condition que la relation client qui la porte soit active.
  //
  // « DÉCLARÉE PAR LA CPTS » avait été retiré le 18/08 — la colonne alors lue (`CommuneAPL.boost*`)
  // ne contenait aucune déclaration : 112 lignes, un seul `updatedAt` à la milliseconde, valeurs
  // dérivées de l'indicateur APL importé le 28/06. La formule est REVENUE le 20/08 (B2), cette
  // fois adossée à une vraie déclaration : CPTS Nord Basse-Terre, PoC ouvert le 20/08, Deshaies
  // niveau 2. L'auteur est désormais une ligne qu'on peut montrer, pas une supposition.
  //
  // ELLE NE S'APPLIQUE QUE DANS UN SENS, et ce n'est pas une économie de code. Une déclaration
  // « il manque des kinés à Deshaies » veut dire : montrer les POSTES de Deshaies aux candidats.
  // Elle ne veut PAS dire « mettre en avant les candidats qui habitent Deshaies auprès des
  // cabinets » — un cabinet de Deshaies cherche quelqu'un, pas quelqu'un du coin, et rien dans
  // la déclaration de la CPTS ne dit le contraire. Appliquer le bonus dans les deux sens aurait
  // été symétrique et faux.
  // Le produit a déjà un bonus directionnel : le bonus saisonnier ne joue que devant un cabinet.
  // Celui-ci ne joue que devant un candidat. Les deux ne se rencontrent donc jamais.
  const prioritesTerritoriales = isCandidateViewer
    ? await chargerPrioritesTerritoriales(missions.map((m) => m.location), myProfile.profession)
    : new Map<string, PrioriteAppliquee>();

  /** Annonces de CE feed réellement remontées par une priorité territoriale. Calculé une fois :
   *  la mention de transparence, la trace et l'en-tête doivent parler du MÊME ensemble, sinon la
   *  phrase affichée finirait par décrire autre chose que ce qui a été mesuré. */
  const misesEnAvantTerritoire = missions.filter(
    (m) => (prioritesTerritoriales.get(m.location ?? "")?.points ?? 0) > 0,
  );
  /** Institutions distinctes à créditer devant CE lecteur — c'est ce qui autorise B2 à écrire
   *  « déclarée prioritaire par X » plutôt qu'une formule sans auteur. */
  const institutionsTerritoire = Array.from(
    new Set(misesEnAvantTerritoire.map((m) => prioritesTerritoriales.get(m.location ?? "")!.institution)),
  );

  const desirabilite = new Map<string, number>();
  for (const m of missions) {
    desirabilite.set(
      m.id,
      getDesirabilityPercent(m.profile)
        + bonusSaisonnier({ startDate: m.startDate, endDate: m.endDate }, besoinPeriode)
        + (prioritesTerritoriales.get(m.location ?? "")?.points ?? 0),
    );
  }
  missions.sort((a, b) => (desirabilite.get(b.id) ?? 0) - (desirabilite.get(a.id) ?? 0));

  // Trace du bonus saisonnier (section 197). Une regle qui MODIFIE l'ordre vu par les cabinets
  // doit pouvoir se mesurer, sinon on ne saura jamais si elle sert a quelque chose — et la
  // premisse qui la justifie (creux mai-octobre) est une observation terrain, pas une mesure.
  //
  // Journalise UNIQUEMENT quand le bonus s'applique vraiment : sinon chaque affichage de feed
  // produirait une ligne, et le signal se noierait dans le bruit.
  const boostes = missions.filter((m) => bonusSaisonnier({ startDate: m.startDate, endDate: m.endDate }, besoinPeriode) > 0);
  if (boostes.length > 0) {
    logTraceEvent({
      eventType: "FEED_BOOST_SAISONNIER",
      profileId: myProfile.id,
      metadata: {
        boostes: boostes.length,
        surTotal: missions.length,
        // Combien le sont SANS date : c'est l'arbitrage n°2, celui qui evite de declasser les
        // recherches d'assistanat. Le mesurer permettra de le rediscuter sur des chiffres.
        sansDate: boostes.filter((m) => !m.startDate).length,
      },
    });
  }

  // Trace de la priorité territoriale — même raison que ci-dessus, et une de plus : c'est la
  // seule mesure qui pourra être rendue à la CPTS. « Vos communes prioritaires ont été mises en
  // avant N fois ce mois-ci » est un fait vérifiable ; sans cette ligne, le PoC n'aurait rien à
  // montrer qu'une intention. Les communes concernées sont nommées : l'intérêt de l'analyse est
  // de savoir LESQUELLES portent, pas seulement combien.
  //
  // Cette phrase ne sera rendue à une CPTS QU'APRÈS que ses communes soient vraiment déclarées
  // par elle (18/08). Aujourd'hui la trace mesure une mise en avant dérivée de l'APL : la rendre
  // telle quelle ferait passer notre import du 28/06 pour son propre jugement.
  //
  // `profession` est renseignée ici, ce qu'aucun appelant de logTraceEvent ne faisait jusqu'à
  // présent alors que la colonne existe — une priorité territoriale n'a de sens que rapportée à
  // une profession, agréger sans elle mélangerait des déclarations sans rapport.
  if (prioritesTerritoriales.size > 0) {
    const misesEnAvant = misesEnAvantTerritoire;
    if (misesEnAvant.length > 0) {
      logTraceEvent({
        eventType: "FEED_PRIORITE_TERRITORIALE",
        profileId: myProfile.id,
        profession: myProfile.profession,
        metadata: {
          misesEnAvant: misesEnAvant.length,
          surTotal: missions.length,
          communes: Array.from(new Set(misesEnAvant.map((m) => m.location).filter(Boolean))),
          // Les institutions créditées sont tracées avec les communes : c'est ce qui rendra le
          // rapport « vos communes ont été mises en avant N fois » attribuable à la bonne CPTS
          // le jour où plusieurs coexisteront.
          institutions: institutionsTerritoire,
        },
      });
    }
  }

  // Nombre de candidats/annonces DISPONIBLES que l'utilisateur a DÉJÀ VUS (swipés) — mêmes
  // filtres que le feed (type, match actif, gating, zone/dates), mais uniquement les déjà-swipés.
  // Permet à l'UI de distinguer « aucun candidat n'existe » de « vous les avez déjà tous vus »
  // (l'état vide contredisait la réalité, section 1). Compté seulement si l'utilisateur a swipé.
  const seenAvailable = excludeMissionIds.length
    ? await prisma.mission.count({
        where: {
          isActive: true,
          briqueStatus: { not: BriqueStatus.INDISPONIBLE },
          id: { in: excludeMissionIds },
          ...NO_ACTIVE_MATCH_FILTER,
          profile: profileWhere,
          ...(location ? { location } : {}),
          ...dateFilter,
        },
      })
    : 0;

  // Établissement (STRUCTURE) au feed vide : la cause n'est pas la même selon qu'AUCUN candidat
  // n'a coché « ouvert aux postes salariés » — auquel cas personne ne peut apparaître, jamais —
  // ou qu'il en existe mais qu'aucun ne corresponde. Le message d'attente convenait au second
  // cas et mentait dans le premier. On compte donc les candidats optés, hors filtres de dates
  // et de zone : c'est l'existence même d'un vivier qui est en question, pas sa pertinence.
  // -1 = sans objet (le lecteur n'est pas un établissement).
  const candidatsOptes = isStructureViewer
    ? await prisma.profile.count({
        // `profession` reprise ici aussi : ce compte sert à dire « aucun candidat n'a coché
        // l'option » plutôt que « aucun ne correspond ». Compter les candidats d'une autre
        // profession y ferait répondre « il en existe » à un établissement qui n'en verra
        // jamais un seul — le message d'attente redeviendrait faux, dans l'autre sens.
        where: { type: { in: oppositeTypes }, isActive: true, ouvertSalariat: true, profession: myProfile.profession, id: { not: myProfile.id } },
      })
    : -1;

  // Expurge les champs sensibles du profil de chaque annonce (audit permissions, section 165) :
  // le feed ne doit exposer que les champs d'affichage (nom/photo/bio/région/note…).
  return NextResponse.json(stripMissionProfiles(missions), {
    headers: {
      "x-feed-seen-available": String(seenAvailable),
      "x-feed-salariat-optin": String(candidatsOptes),
      // Combien d'annonces de CE feed sont réellement remontées par une priorité territoriale.
      // Sert uniquement à la mention de transparence : elle ne doit annoncer « zones
      // prioritaires » que lorsque c'est vrai POUR CE LECTEUR, et se taire sinon. C'est ce qui
      // manquait avant le 17/08 — la phrase était écrite en dur et affirmait toujours.
      "x-feed-priorite-territoriale": String(misesEnAvantTerritoire.length),
      // B2 (20/08) — les institutions à créditer, pour que la mention les NOMME. Deux versions
      // de cette phrase ont déjà été fausses faute de pouvoir désigner un auteur ; elle ne
      // revient qu'adossée à des lignes `PrioriteTerritoriale` réelles, portées par une relation
      // client active.
      //
      // JSON + encodeURIComponent, pas le nom brut : un en-tête HTTP est du latin-1, et un nom
      // d'institution accentué (« Communauté… ») le casserait ou le mutilerait en silence. Aucune
      // institution accentuée n'existe aujourd'hui — c'est exactement pour ça qu'il faut le faire
      // maintenant, pendant que l'absence de bug est vérifiable.
      "x-feed-priorite-institutions": encodeURIComponent(JSON.stringify(institutionsTerritoire)),
    },
  });
}
