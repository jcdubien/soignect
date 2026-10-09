import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { missionTypesPour } from "@/lib/contrats/gabarits";
import { aDesGabaritsSalarie } from "@/lib/contrats/gabaritsSalarie";
import { exemplesPour } from "@/lib/exemplesPublication";
import CreateMissionClient from "./CreateMissionClient";

export const dynamic = "force-dynamic";

// Enveloppe SERVEUR du formulaire de création d'annonce (28/08).
//
// POURQUOI ELLE EXISTE : le formulaire doit savoir quels types de mission la profession du
// visiteur peut réellement contractualiser — l'ASSISTANAT n'existe pas chez les infirmiers. Or
// `useSession` n'expose que `profileType`, `isEmployeur` et `profileId` : pas `profession`.
//
// POURQUOI PAS LE JWT. L'y ajouter aurait été le geste le plus court, et le mauvais : le jeton
// est figé au sign-in et n'est jamais relu (voir lib/auth.ts). Il a déjà produit un défaut cette
// semaine, et une profession modifiée dans /compte n'aurait pris effet qu'à la reconnexion
// suivante — sans que personne ne comprenne pourquoi.
//
// POURQUOI PAS UNE ROUTE DÉDIÉE. La profession est nécessaire AU PREMIER RENDU : une route
// laisserait afficher « Assistanat » puis le retirerait, offrant à l'utilisateur une option qui
// disparaît sous ses yeux. Elle ajouterait aussi une surface d'authentification pour une donnée
// déjà chargée côté serveur ailleurs.
export default async function CreateMissionPage() {
  const session = await auth();
  if (!session?.user?.profileId) redirect("/login");

  const profil = await prisma.profile.findUnique({
    where: { id: session.user.profileId as string },
    select: { profession: true },
  });
  if (!profil) redirect("/login");

  // Les exemples suivent la profession (section 278) : la page la charge déjà, il n'y a rien
  // de plus à interroger.
  return (
    <CreateMissionClient
      typesContractualisables={missionTypesPour(profil.profession)}
      salariatContractualisable={aDesGabaritsSalarie(profil.profession)}
      exemples={exemplesPour(profil.profession)}
      // La phrase de l'exercice coordonné en dépend (section 294) : « jusqu'à 8 séances » est
      // l'Avenant 7 des kinés, pas une règle commune.
      profession={profil.profession}
    />
  );
}
