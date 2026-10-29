import { prisma } from "@/lib/prisma";
import { territoireDe, type Territoire } from "@/lib/communes";

// Territoire du compte qui publie (section 376) : toute annonce ou brique du Planning porte celui
// de son auteur, lu ici à la création — jamais déduit du texte ni de la commune saisie.
export async function territoireDuProfil(profileId: string): Promise<Territoire> {
  const p = await prisma.profile.findUnique({ where: { id: profileId }, select: { territoire: true } });
  return territoireDe(p?.territoire);
}
