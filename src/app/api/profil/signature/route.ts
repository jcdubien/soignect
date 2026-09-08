import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { effacerSignatureProfil } from "@/lib/signatureEnregistree";

export const dynamic = "force-dynamic";

// DELETE /api/profil/signature — retire la signature conservée (section 242).
//
// POURQUOI UNE ROUTE À PART. La route de signature d'un match répond à « apposer ma signature sur
// CE contrat ». Y ajouter un DELETE aurait été ambigu : effacer la signature de ce contrat, ou la
// signature conservée ? Deux gestes de portée très différente ne partagent pas un verbe.
//
// CE QUE CE RETRAIT NE TOUCHE PAS : les contrats déjà signés. Chacun porte sa propre copie du
// fichier, apposée au moment de la signature (voir signatureEnregistree.ts). Retirer sa signature
// conservée prépare les contrats à venir ; elle ne réécrit pas ceux qui sont engagés — un contrat
// signé dont la signature s'effacerait après coup serait pire que le confort qu'on retire.
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.profileId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const profileId = session.user.profileId as string;

  // La colonne d'abord : c'est elle qui fait autorité. Un fichier orphelin dans un bucket privé
  // n'est plus atteignable par personne une fois le chemin oublié.
  await prisma.profile.update({ where: { id: profileId }, data: { signatureUrl: null } });
  await effacerSignatureProfil(profileId);

  return NextResponse.json({ signatureEnregistree: false });
}
