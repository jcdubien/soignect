import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { COMMUNES_PAR_TERRITOIRE } from "@/lib/communes";
import { confreresAjoutes, assistantsRattaches } from "@/lib/confrereHorsSoignect";
import ConfreresClient from "./ConfreresClient";
import { modesRedevanceAutorises } from "@/lib/retrocession";

export const dynamic = "force-dynamic";

// Confrère trouvé hors Soignect (24/10) — saisie, contrat, compte du confrère, partage du lien.
export default async function ConfreresPage() {
  const session = await auth();
  if (!session?.user?.profileId) redirect("/login");
  const profileId = session.user.profileId as string;
  const p = await prisma.profile.findUnique({ where: { id: profileId }, select: { type: true, titulaireKind: true, profession: true, territoire: true } });
  if (p?.type !== "TITULAIRE" || p.titulaireKind === "STRUCTURE") redirect("/annonces");
  const derniere = await prisma.mission.findFirst({ where: { profileId }, orderBy: { createdAt: "desc" }, select: { location: true } });
  // Communes du territoire du cabinet (section 376).
  const communes = COMMUNES_PAR_TERRITOIRE[p.territoire];
  return (
    <ConfreresClient
      communes={[...communes]}
      communeParDefaut={derniere?.location && communes.includes(derniere.location) ? derniere.location : ""}
      initiaux={await confreresAjoutes(profileId)}
      modesRedevance={modesRedevanceAutorises("ASSISTANAT", false, p.profession)}
      assistants={(await assistantsRattaches(profileId)).map(({ postId, nom }) => ({ postId, nom }))}
    />
  );
}
