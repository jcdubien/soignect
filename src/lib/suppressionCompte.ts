import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Suppression d'un compte et de tout ce qui s'y rattache (section 230).
//
// CE QUI NE MARCHAIT PAS. Les deux chemins de suppression — self-service (`profiles/[id]`) et
// admin (`admin/users/[id]`) — faisaient un `prisma.user.delete()` nu. Or presque RIEN ne cascade
// depuis `Profile` : `Swipe`, `Match`, `Message`, les trois tables de notes et `CabinetPost` sont
// toutes en `Restrict`. Un seul swipe donné suffisait donc à rendre un compte indestructible.
// Mesuré le 04/09 : **28 comptes sur 32 (88 %) ne pouvaient pas être supprimés**, et 23 profils
// sur 32 ont au moins un swipe. Le défaut n'était pas rare, il était l'état normal.
//
// POURQUOI UNE SUPPRESSION EXPLICITE ET NON UNE CASCADE EN BASE. Une cascade déclarative serait
// plus courte, mais elle ferait la MÊME chose partout — or deux relations ne doivent surtout pas
// être suivies :
//   • `CabinetPost.linkedUserId` désigne un poste qui appartient à UN AUTRE cabinet. Le poste
//     « Marion » est celui de Jean-Charles ; effacer le compte de Marion doit le DÉTACHER, pas
//     démolir le planning de quelqu'un d'autre.
//   • `PrioriteTerritoriale.saisiParId` documente qui a saisi une déclaration institutionnelle.
//     La priorité appartient à la CPTS, pas à l'administrateur qui a tenu le stylo.
// Une cascade aveugle détruirait ces deux-là. L'ordre et les exceptions se voient ici.
//
// PRINCIPE, DIFFÉRENT DE CELUI DU 03/09. Pour les swipes qui survivaient à un changement de camp,
// la règle était « désactiver, ne rien supprimer » : il s'agissait de préserver un historique que
// d'AUTRES lisent. Ici c'est le PROPRIÉTAIRE qui demande l'effacement de SES données — un droit,
// pas un nettoyage. On supprime réellement.

/** Ce qui empêche encore une suppression, faute de pouvoir être ni supprimé ni détaché. */
export interface BlocageSuppression {
  motif: string;
  details: string[];
}

export interface ResultatSuppression {
  supprime: boolean;
  blocage?: BlocageSuppression;
  compte?: Record<string, number>;
}

export async function supprimerCompte(userId: string): Promise<ResultatSuppression> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, profile: { select: { id: true } } },
  });
  if (!user) return { supprime: false, blocage: { motif: "Compte introuvable.", details: [] } };
  const profileId = user.profile?.id ?? null;

  // ── Blocage assumé : les déclarations territoriales ────────────────────────────────────────
  // `saisiParId` n'est PAS nullable. On ne peut donc ni détacher ni conserver la trace sans
  // garder un lien vers une personne effacée. Supprimer les priorités serait pire : elles
  // appartiennent à l'institution qui les a déclarées, pas à l'administrateur qui les a saisies.
  // On REFUSE en nommant précisément ce qu'il faut transférer, plutôt que de trancher à la place
  // de quelqu'un. Rendre la colonne nullable lèverait ce cas — migration, hors périmètre ici.
  const priorites = await prisma.prioriteTerritoriale.findMany({
    where: { saisiParId: userId },
    select: { codeInsee: true, profession: true },
  });
  if (priorites.length > 0) {
    return {
      supprime: false,
      blocage: {
        motif:
          "Ce compte a saisi des déclarations territoriales institutionnelles. Elles appartiennent " +
          "à l'institution, pas au compte : transférez-les à un autre administrateur avant la suppression.",
        details: priorites.map((p) => `${p.codeInsee} · ${p.profession}`),
      },
    };
  }

  const missionIds = profileId
    ? (await prisma.mission.findMany({ where: { profileId }, select: { id: true } })).map((m) => m.id)
    : [];

  // FORME EN TABLEAU, PAS INTERACTIVE. `$transaction(async tx => …)` échoue en P2028 contre ce
  // pooler Supabase : le port 6543 est en mode « transaction », qui ne tient pas une transaction
  // interactive ouverte entre deux requêtes. Constaté à l'exécution le 05/09. Les six autres
  // transactions du dépôt utilisent déjà la forme en tableau — c'est la convention, et elle
  // suffit ici : tous les filtres sont calculés AVANT, aucune opération n'a besoin du résultat
  // de la précédente.
  // Typé large : le tableau mêle des `deleteMany` (qui rendent un compteur) et le `delete` final
  // (qui rend l'enregistrement). Sans ce type, TypeScript fige le tableau sur le premier élément.
  const operations: Prisma.PrismaPromise<unknown>[] = [
    // 1. DÉTACHER — jamais supprimer : ce poste est celui d'un autre cabinet (section 214).
    prisma.cabinetPost.updateMany({ where: { linkedUserId: userId }, data: { linkedUserId: null } }),
  ];
  const etiquettes = ["postesDetaches"];

  if (profileId) {
    const surMoi = { OR: [{ raterId: profileId }, { ratedId: profileId }] };
    // 2. Notes données ET reçues : elles portent sur une personne qui disparaît.
    operations.push(prisma.rating.deleteMany({ where: surMoi }));            etiquettes.push("notes");
    operations.push(prisma.cabinetRating.deleteMany({ where: surMoi }));     etiquettes.push("notesCabinet");
    operations.push(prisma.remplacantRating.deleteMany({ where: surMoi }));  etiquettes.push("notesRemplacant");

    // 3. Messages ENVOYÉS. Ceux des conversations supprimées ci-dessous partent en cascade ;
    //    ceux-ci peuvent vivre dans une conversation qui, elle, reste.
    operations.push(prisma.message.deleteMany({ where: { senderId: profileId } })); etiquettes.push("messages");

    // 4. Mises en relation — AVANT les missions : `Match.missionA/B` les référence en `Restrict`.
    operations.push(prisma.match.deleteMany({
      where: { OR: [{ profileAId: profileId }, { profileBId: profileId }] },
    })); etiquettes.push("matchs");

    // 5. Swipes donnés, et swipes REÇUS sur ses annonces — ces derniers sont le geste de
    //    quelqu'un d'autre, mais leur cible disparaît.
    operations.push(prisma.swipe.deleteMany({ where: { swiperId: profileId } })); etiquettes.push("swipesDonnes");
    if (missionIds.length > 0) {
      operations.push(prisma.swipe.deleteMany({ where: { swipedMissionId: { in: missionIds } } }));
      etiquettes.push("swipesRecus");
    }

    // 6. Missions puis postes : `Mission.cabinetPost` est en `Restrict`, un poste ne peut pas
    //    partir tant qu'une de ses missions existe.
    operations.push(prisma.mission.deleteMany({ where: { profileId } }));          etiquettes.push("missions");
    operations.push(prisma.cabinetPost.deleteMany({ where: { cabinetId: profileId } })); etiquettes.push("postes");

    // 7. Traces d'usage : aucune clé étrangère ne les retient, elles survivraient en silence en
    //    gardant l'identifiant d'une personne effacée. C'est ce qu'un droit à l'effacement interdit.
    operations.push(prisma.traceEvent.deleteMany({ where: { profileId } }));       etiquettes.push("traces");
  }

  // 8. Le compte. `Profile` et `Notification` cascadent depuis `User`.
  operations.push(prisma.user.delete({ where: { id: userId } }));

  const resultats = await prisma.$transaction(operations);

  const compte: Record<string, number> = {};
  etiquettes.forEach((cle, i) => {
    const r = resultats[i] as { count?: number };
    compte[cle] = r?.count ?? 0;
  });

  return { supprime: true, compte };
}
