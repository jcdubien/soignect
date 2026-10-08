import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileType, TitulaireKind, MissionType, Prisma } from "@prisma/client";
import { stripMissionProfiles } from "@/lib/publicProfile";
import { EST_UNE_OFFRE, NO_ACTIVE_MATCH_FILTER, offreOuverteLe } from "@/lib/feedFilters";
import { getDesirabilityPercent, bonusSaisonnier } from "@/lib/desirability";
import { chargerPrioritesTerritoriales, type PrioriteAppliquee } from "@/lib/territoire";
import { missionTypesPour } from "@/lib/contrats/gabarits";
import { aDesGabaritsSalarie } from "@/lib/contrats/gabaritsSalarie";
import { professionPluriel } from "@/lib/professions";
import { logTraceEvent } from "@/lib/trace";
import { TOLERANCE_DATES_MAX_JOURS } from "@/lib/compatibilite";

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

  // ── FILTRE DE TYPES — CÔTÉ SERVEUR, ET C'EST LE POINT (section 282) ───────────────────────
  //
  // La barre de pastilles filtrait CÔTÉ CLIENT, sur la page déjà chargée. Le préchargement, lui,
  // se déclenche sur la liste BRUTE (`missions.length < 4`). Un lecteur qui restreignait ses
  // types épuisait donc ses cartes visibles pendant que la liste brute restait pleine des autres :
  // écran vide, aucun rechargement, et de l'offre réelle à l'autre bout de la requête.
  //
  // Le défaut existait déjà pour les pastilles ASSISTANAT et COLLABORATION. Il devenait le chemin
  // PAR DÉFAUT de tout assistant avec la présélection — d'où le portage ici plutôt qu'un second
  // mécanisme à côté du premier.
  //
  // `POSTES` n'est pas une valeur de `MissionType` : c'est l'union de ce qui engage dans la
  // durée, salariat compris. Le salariat n'a pas de valeur d'enum propre (section 262) — un CDI
  // est stocké COLLABORATION, un CDD REMPLACEMENT — donc un CDD salarié doit être rattrapé par
  // `estSalariat`, sans quoi il tomberait du mauvais côté de la ligne.
  const types = searchParams.get("types");
  const filtreTypes: Prisma.MissionWhereInput =
    types === "POSTES"
      ? { OR: [{ missionType: { in: [MissionType.ASSISTANAT, MissionType.COLLABORATION] } }, { estSalariat: true }] }
      : types === "REMPLACEMENT"
        // Symétrique : le CDD salarié est un contrat de travail, pas un remplacement libéral.
        ? { missionType: MissionType.REMPLACEMENT, estSalariat: false }
        : types === "ASSISTANAT" || types === "COLLABORATION"
          ? { missionType: types as MissionType }
          : {};

  // ── FILTRE DE DATES QUAND LE CABINET CIBLE UNE DE SES ANNONCES (section 256) ───────────────
  //
  // CE QU'IL FAISAIT, ET CE QU'IL COÛTAIT. La condition était un chevauchement STRICT :
  //
  //     startDate: { lte: besoin.endDate }   ET   endDate: { gte: besoin.startDate }
  //
  // Un candidat décalé d'un seul jour disparaissait — pas classé plus bas : absent de la requête.
  // Et parce qu'en SQL une comparaison sur NULL est fausse, tout candidat SANS DATE DE FIN était
  // écarté d'office : c'est-à-dire précisément les disponibilités long terme, celles que cherchent
  // les 13 annonces d'assistanat et de collaboration du moment.
  //
  // Mesuré le 21/09 sur les 11 annonces cabinet à deux bornes : **3,7 candidats visibles sur 22**
  // en moyenne, 18,3 écartés, dont 6 dans TOUS les cas faute de date de fin. Une annonce n'en
  // voyait aucun.
  //
  // ── L'ERREUR DE CONCEPTION, NOMMÉE ────────────────────────────────────────────────────────
  //
  // Le produit sait déjà dégrader : `scoreDates` applique la souplesse déclarée des deux parties,
  // retombe sur `minMonths` quand les dates manquent, et rend un neutre quand on ne sait rien.
  // Ce filtre-ci, placé JUSTE DEVANT lui, était plus grossier que lui — il écartait des candidats
  // que le barème aurait volontiers notés. On ne filtre pas plus dur qu'on ne note.
  //
  // ── L'INVARIANT RETENU ────────────────────────────────────────────────────────────────────
  //
  // Le filtre ne doit retirer QUE des candidats auxquels `scoreDates` donnerait 0. Avec deux
  // périodes bornées, ce score est non nul si et seulement si :
  //
  //     candidat.fin   >= besoin.début - tolérance      ET      candidat.début <= besoin.fin + tolérance
  //
  // La tolérance retenue est la plus généreuse déclarable (30 j) : une requête SQL ne peut pas
  // lire la souplesse de chaque candidat, et prendre le maximum garantit qu'on n'écarte personne
  // de notable. Les dates absentes ne sont plus une exclusion mais un cas que le barème sait
  // traiter — on les laisse donc passer.
  let dateFilter: Prisma.MissionWhereInput = {};
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
      const tol = TOLERANCE_DATES_MAX_JOURS * 24 * 60 * 60 * 1000;
      const borneBasse = new Date(targetMission.startDate.getTime() - tol);
      const borneHaute = new Date(targetMission.endDate.getTime() + tol);
      dateFilter = {
        AND: [
          // Une disponibilité sans début connu reste candidate : c'est au barème de la situer,
          // pas à la requête de la supprimer.
          { OR: [{ startDate: null }, { startDate: { lte: borneHaute } }] },
          // Sans date de fin = disponibilité ouverte. Elle ne peut pas finir « trop tôt », et
          // c'est le cas des postes long terme — ceux qu'on écartait systématiquement.
          { OR: [{ endDate: null }, { endDate: { gte: borneBasse } }] },
        ],
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
      // Prédicat unique (section 265) : active, EN RECHERCHE, et pas une absence. Le feed
      // retenait ici sa propre définition, plus large que celle de la page publique.
      ...EST_UNE_OFFRE,
      id: { notIn: excludeMissionIds },
      ...NO_ACTIVE_MATCH_FILTER,
      profile: profileWhere,
      ...(location ? { location } : {}),
      ...dateFilter,
      ...filtreTypes,
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
          // MÊME prédicat que le feed lui-même : ce compte sert à dire « vous les avez tous
          // vus » plutôt que « il n'y en a aucun ». Calculé sur un périmètre plus large, il
          // aurait annoncé des déjà-vus que le feed ne propose plus.
          ...EST_UNE_OFFRE,
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

  // Le LECTEUR a-t-il publié quelque chose (section 227) ? Une propriété du lecteur, pas des
  // annonces : elle voyage donc en en-tête, comme les autres faits qui décrivent CE feed pour
  // CETTE personne, et non en la répétant sur chaque carte.
  //
  // Ce que ça permet de dire : la pile de cartes ignorait totalement ce fait, si bien qu'un
  // candidat sans recherche publiée voyait « Intéressé » sans savoir que son geste resterait
  // invisible. Mesuré le 03/09 — 14 candidats sur 19 n'ont jamais publié, et cette population
  // totalise zéro mise en relation.
  const aPublie = await prisma.mission.count({
    where: { profileId: myProfile.id, isActive: true },
    take: 1,
  });

  // ── COMBIEN DE CABINETS ATTENDENT SES DATES (section 288) ─────────────────────────────────
  //
  // Mesuré le 07/10 : **11 candidats totalisent 30 intérêts** sans avoir jamais rien publié —
  // Simoni en a 10 depuis le 11/09, Hippolyte JUE 7 depuis le 23/08. Leur geste est bien en
  // base, `lib/interetSignale` a différé le signal, et `/api/interets-recus` les compte sans
  // les servir : personne, d'aucun côté, ne peut rien en faire. Le bandeau de la section 227
  // leur disait déjà la vérité — et les 30 intérêts prouvent qu'un avertissement qui renvoie
  // AILLEURS (« Publier ma recherche → ») ne suffit pas. Il faut saisir sur place.
  //
  // CE COMPTE NE SE PAIE QUE PAR CEUX QUI EN ONT BESOIN. Il est sauté dès que le lecteur a
  // publié quoi que ce soit — c'est-à-dire pour la quasi-totalité du trafic. Dans ce cas
  // l'en-tête vaut 0, ce qui est exact : qui apparaît dans un fil n'a aucun intérêt en souffrance
  // de ce genre.
  //
  // Il compte des CABINETS DISTINCTS, pas des intérêts : dire « 7 cabinets attendent vos dates »
  // à quelqu'un qui a retenu trois annonces d'un même cabinet serait faux, et c'est le nombre de
  // personnes qui pourraient répondre qui mesure l'enjeu, pas le nombre de cartes swipées.
  let cabinetsEnAttente = 0;
  if (aPublie === 0) {
    const interets = await prisma.swipe.findMany({
      where: {
        swiperId: myProfile.id,
        direction: "RIGHT",
        // LE MÊME OBJET que celui du rattrapage (section 289), pas une recomposition : ce
        // nombre est annoncé à la personne (« 3 cabinets attendent vos dates »), et le
        // rattrapage décide ensuite qui reçoit un email. Deux prédicats écrits séparément
        // auraient fini par ne plus désigner les mêmes annonces — la promesse et l'envoi
        // auraient divergé sans que rien ne le signale.
        swipedMission: offreOuverteLe(new Date()),
      },
      select: { swipedMission: { select: { profileId: true } } },
    });
    cabinetsEnAttente = new Set(interets.map((s) => s.swipedMission.profileId)).size;
  }

  // ── CONVERGENCE DE DATES — UN ÉTIQUETAGE, PAS UN CLASSEMENT (section 282) ─────────────────
  //
  // Un remplaçant dont la disponibilité dépasse 30 jours se voit DÉJÀ proposer des postes long
  // terme : mesuré, 46 % de ses swipes portent dessus, avec un taux de « oui » de 12 % contre
  // 13 % sur les remplacements — il les traite exactement pareil. Ce qu'il ne voit pas, c'est
  // QUAND le poste démarre par rapport à sa propre disponibilité.
  //
  // CE QUE CETTE ÉTIQUETTE N'EST PAS. Elle ne touche pas à l'ordre. Le tri du fil est une somme
  // de points où vit le levier territorial — le seul adossé à une relation client payante — et
  // y ajouter la convergence de dates reviendrait à distribuer gratuitement ce que le produit
  // vend. La doctrine le dit : « jamais une option ambiante ».
  //
  // ET SURTOUT, RIEN NE DIT ENCORE QU'ELLE CONVERTIT. Sur les 31 paires convergentes réellement
  // vues à ce jour, le taux de « oui » est de 13 % — exactement le taux de base. 31 observations
  // ne peuvent ni montrer ni exclure un gain modeste. L'étiquette est donc posée D'ABORD comme
  // instrument de mesure : elle rend comparables les cartes étiquetées et les autres. Si l'écart
  // apparaît, la remontée dans l'ordre se discutera avec un chiffre ; sinon elle ne se fera pas.
  // Combien de remplacements la présélection écarte-t-elle ? Mesuré AVANT de livrer : retirer
  // les remplacements fait passer un assistant de 15 cartes à 7 — mais DEUX des huit tombent à
  // 1 et à 0. Un filtre par défaut qui vide un fil est pire que le défaut qu'il corrige.
  //
  // Le produit ne réintègre pas les remplacements en douce pour autant : il DIT ce qu'il a
  // masqué et laisse le geste à l'utilisateur. C'est la règle de l'état vide filtré (section 7),
  // et elle vaut d'autant plus ici que le masquage n'a pas été demandé — il est présélectionné.
  const remplacementsMasques = types === "POSTES"
    ? await prisma.mission.count({
        where: {
          ...EST_UNE_OFFRE,
          id: { notIn: excludeMissionIds },
          ...NO_ACTIVE_MATCH_FILTER,
          profile: profileWhere,
          ...(location ? { location } : {}),
          missionType: MissionType.REMPLACEMENT,
          estSalariat: false,
        },
      })
    : 0;

  // ── MARCHÉ PAS ENCORE OUVERT POUR CETTE PROFESSION (section 284) ──────────────────────────
  //
  // L'état vide du fil disait à TOUT candidat : « Revenez plus tard, ou publiez vos
  // disponibilités pour être visible des cabinets. » Pour un chirurgien-dentiste, les deux
  // moitiés sont fausses — il n'y aura pas d'annonces à son prochain passage (aucun cabinet de
  // sa profession ne peut publier, faute de modèle de contrat), et publier ne le rend visible
  // d'aucun cabinet. Un message rassurant qui ment est pire qu'un écran vide.
  //
  // MÊME PRÉDICAT QUE L'ÉCRAN DE PUBLICATION (section 278), et volontairement : les deux
  // phrases décrivent le même fait, et deux définitions de « profession sans gabarit »
  // finiraient par diverger. Le bandeau de `/disponibilites/create` et celui-ci diront donc
  // toujours la même chose.
  //
  // Côté TITULAIRE, on se tait : il ne peut même pas publier, et l'écran de publication le lui
  // a déjà dit. Lui répéter ici qu'aucun cabinet n'existe n'aurait aucun sens — c'est lui, le
  // cabinet.
  const marcheFerme =
    isCandidateViewer
    && missionTypesPour(myProfile.profession).length === 0
    && !aDesGabaritsSalarie(myProfile.profession);

  const DUREE_LONGUE_JOURS = 30;
  const ECART_CONVERGENCE_JOURS = 30;
  const estLecteurRemplacant = myProfile.type === ProfileType.REMPLACANT;
  const convergences = new Map<string, number>();
  if (estLecteurRemplacant) {
    // Mes disponibilités LONGUES. Le seuil ne discrimine presque pas (27 des 29 disponibilités
    // actives le franchissent) — il est conservé parce qu'il nomme l'intention, pas parce qu'il
    // trie : annoncer un poste de douze mois à quelqu'un qui se libère une semaine serait faux.
    const mesDispos = await prisma.mission.findMany({
      where: { ...EST_UNE_OFFRE, profileId: myProfile.id, missionType: MissionType.REMPLACEMENT },
      select: { startDate: true, endDate: true },
    });
    const debutsLongs = mesDispos
      .filter((d) => d.startDate && d.endDate
        && (d.endDate.getTime() - d.startDate.getTime()) / 86_400_000 > DUREE_LONGUE_JOURS)
      .map((d) => d.startDate!.getTime());

    if (debutsLongs.length > 0) {
      for (const m of missions) {
        const estPosteLongTerme =
          m.missionType === MissionType.ASSISTANAT
          || m.missionType === MissionType.COLLABORATION
          || m.estSalariat;
        if (!estPosteLongTerme || !m.startDate) continue;
        // L'écart le plus FAVORABLE parmi mes disponibilités : c'est celui que l'utilisateur
        // vérifierait lui-même, et en retenir un autre rendrait l'étiquette incompréhensible.
        const ecart = Math.min(
          ...debutsLongs.map((t) => Math.abs(m.startDate!.getTime() - t) / 86_400_000),
        );
        if (ecart <= ECART_CONVERGENCE_JOURS) convergences.set(m.id, Math.round(ecart));
      }
    }
  }

  // Expurge les champs sensibles du profil de chaque annonce (audit permissions, section 165) :
  // le feed ne doit exposer que les champs d'affichage (nom/photo/bio/région/note…).
  const charge = stripMissionProfiles(missions).map((m) => {
    const ecart = convergences.get((m as { id: string }).id);
    // Champ ABSENT plutôt que `null` quand il n'y a rien à dire : une carte non étiquetée ne
    // porte aucune trace de l'étiquetage, et la mesure ne peut pas confondre « pas de
    // convergence » avec « mécanisme inactif ».
    return ecart === undefined ? m : { ...m, convergenceJours: ecart };
  });

  return NextResponse.json(charge, {
    headers: {
      "x-feed-seen-available": String(seenAvailable),
      // 1 = le lecteur a une publication active, 0 = il n'apparaît dans aucun fil.
      "x-feed-a-publie": aPublie > 0 ? "1" : "0",
      // Nombre de CABINETS qui attendent ses dates (section 288). Toujours 0 pour qui a publié,
      // et c'est exact plutôt qu'économe : l'intérêt en souffrance est, par définition, le fait
      // de quelqu'un qui n'apparaît nulle part.
      "x-feed-cabinets-en-attente": String(cabinetsEnAttente),
      "x-feed-salariat-optin": String(candidatsOptes),
      // Ce que la présélection de types écarte. Zéro hors présélection — l'en-tête ne décrit
      // jamais un masquage qui n'a pas eu lieu.
      "x-feed-remplacements-masques": String(remplacementsMasques),
      // Vide = marché ouvert. Sinon, le PLURIEL de la profession, encodé : un en-tête HTTP est
      // du latin-1 et un libellé accentué le casserait. Même précaution que pour les
      // institutions ci-dessous, et même repli — une lecture qui échoue retombe sur le message
      // générique plutôt que sur une phrase tronquée.
      //
      // Le nom de l'ORDRE a été retiré après lecture de la phrase produite : il obligeait à une
      // branche pour les professions sans ordre (orthoptiste, orthophoniste), et cette branche
      // écrivait « Les modèles de contrat DE VOTRE PROFESSION […] les cabinets DE VOTRE
      // PROFESSION ». Nommer la profession une seule fois, par son pluriel, dit la même chose
      // sans la redite et sans cas particulier.
      "x-feed-marche-ferme": marcheFerme
        ? encodeURIComponent(professionPluriel(myProfile.profession))
        : "",
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
