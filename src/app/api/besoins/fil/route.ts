import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NATURES_BESOIN, auteurAffiche, consentementInteret, etiquetteBesoin, ETIQUETTE_PROPOSITION } from "@/lib/besoinTerritoire";
import { archiverBesoinsEchus } from "@/lib/besoinTerritoireServeur";
import { logTraceEvent } from "@/lib/trace";
import { COMMUNES_PAR_TERRITOIRE, inseeOfCommune, territoiresVus } from "@/lib/communes";

export const dynamic = "force-dynamic";

// Besoins du territoire montrés dans le fil (24/10) — à un soignant de la profession concernée
// (un établissement ne les voit pas : il recrute, il ne s'installe pas). Hors du classement des
// annonces : ils ne comptent pas dans la pagination et ne repoussent aucune annonce.
const AFFICHES_MAX = 3;

export async function GET() {
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const moi = await prisma.profile.findUnique({ where: { id: session.user.profileId }, select: { id: true, profession: true, titulaireKind: true, type: true, territoire: true, voirAutreTerritoire: true } });
  if (!moi || (moi.type === "TITULAIRE" && moi.titulaireKind === "STRUCTURE")) return NextResponse.json({ besoins: [] });
  await archiverBesoinsEchus();
  const codesVus = territoiresVus(moi).flatMap((t) => COMMUNES_PAR_TERRITOIRE[t].map((c) => inseeOfCommune(c)).filter((c): c is string => !!c));
  const besoins = await prisma.besoinTerritoire.findMany({
    // Chacun son île (sections 376, 378) : les besoins des communes de l'île du lecteur, plus
    // l'autre s'il a coché « voir aussi ».
    where: { statut: "PUBLIE", profession: moi.profession, expireLe: { gt: new Date() }, codeInsee: { in: codesVus } },
    orderBy: { publieLe: "desc" }, take: AFFICHES_MAX,
    include: {
      client: { select: { nom: true, type: true, page: { select: { accord: true, demo: true } } } },
      interets: { where: { profileId: moi.id }, select: { id: true } },
    },
  });
  // Mesure (24/10) : un affichage par besoin servi — sans identifiant de personne.
  for (const b of besoins) {
    logTraceEvent({ eventType: "BESOIN_VUE", profession: b.profession, commune: b.commune, metadata: { besoinId: b.id, clientId: b.clientId, lieu: "fil" } });
  }
  return NextResponse.json({
    besoins: besoins.map((b) => {
      const auteur = auteurAffiche(b.client, b.client.page?.accord === "OUI" && !b.client.page?.demo);
      return {
        id: b.id, commune: b.commune, specialite: b.specialite, nature: NATURES_BESOIN[b.nature],
        texte: b.texte, proposition: b.proposition, etiquetteProposition: ETIQUETTE_PROPOSITION,
        etiquette: etiquetteBesoin(auteur), consentement: consentementInteret(auteur),
        interesse: b.interets.length > 0,
      };
    }),
  });
}
