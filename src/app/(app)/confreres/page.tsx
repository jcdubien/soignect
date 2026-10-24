import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { COMMUNES_GUADELOUPE } from "@/lib/communes";
import { confreresAjoutes } from "@/lib/confrereHorsSoignect";
import ConfreresClient from "./ConfreresClient";
import { modesRedevanceAutorises } from "@/lib/retrocession";

export const dynamic = "force-dynamic";

// Confrère trouvé hors Soignect (24/10) — saisie, contrat, compte du confrère, partage du lien.
export default async function ConfreresPage() {
  const session = await auth();
  if (!session?.user?.profileId) redirect("/login");
  const profileId = session.user.profileId as string;
  const p = await prisma.profile.findUnique({ where: { id: profileId }, select: { type: true, titulaireKind: true, profession: true } });
  if (p?.type !== "TITULAIRE" || p.titulaireKind === "STRUCTURE") redirect("/annonces");
  const derniere = await prisma.mission.findFirst({ where: { profileId }, orderBy: { createdAt: "desc" }, select: { location: true } });
  return (
    <ConfreresClient
      communes={[...COMMUNES_GUADELOUPE]}
      communeParDefaut={derniere?.location && (COMMUNES_GUADELOUPE as readonly string[]).includes(derniere.location) ? derniere.location : ""}
      initiaux={await confreresAjoutes(profileId)}
      modesRedevance={modesRedevanceAutorises("ASSISTANAT", false, p.profession)}
    />
  );
}
