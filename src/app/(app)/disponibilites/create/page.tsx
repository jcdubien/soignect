import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { exemplesPour } from "@/lib/exemplesPublication";
import { missionTypesPour } from "@/lib/contrats/gabarits";
import { aDesGabaritsSalarie } from "@/lib/contrats/gabaritsSalarie";
import CreateDisponibiliteClient from "./CreateDisponibiliteClient";

export const dynamic = "force-dynamic";

// Enveloppe SERVEUR (section 278) — même raison et même forme que `missions/create/page.tsx` :
// les exemples affichés dépendent de la PROFESSION, et la session n'expose que `profileType`,
// `isEmployeur` et `profileId`. Ajouter la profession au jeton l'aurait figée jusqu'à la
// prochaine reconnexion ; une route dédiée serait arrivée APRÈS le premier rendu, c'est-à-dire
// après que l'utilisateur a lu un exemple kiné.
export default async function CreateDisponibilitePage() {
  const session = await auth();
  const profileId = (session?.user as { profileId?: string })?.profileId;
  if (!profileId) redirect("/login");

  const profil = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { profession: true },
  });
  if (!profil) redirect("/login");

  // ── CE QUE VOIT UNE PROFESSION SANS AUCUN MODÈLE DE CONTRAT (section 278) ──────────────────
  //
  // Le côté CABINET suspend la publication : aucun type n'y est proposé, et l'écran le dit. Le
  // côté CANDIDAT n'avait aucun garde — ni blocage, ni énoncé. Il reste SANS BLOCAGE, et c'est
  // un choix : une recherche publiée n'est pas un contrat, et interdire le seul geste qu'une
  // profession nouvelle peut faire le jour de son ouverture reviendrait à ouvrir l'inscription
  // pour rien.
  //
  // Mais le silence, lui, n'est pas tenable. Puisque les cabinets de cette profession ne peuvent
  // pas encore publier, cette recherche n'a personne à rencontrer — un fait que l'utilisateur ne
  // peut déduire d'aucun écran, et qu'il vaut mieux lire avant de remplir quinze champs
  // qu'après trois semaines sans réponse.
  const sansModeleDeContrat =
    missionTypesPour(profil.profession).length === 0 && !aDesGabaritsSalarie(profil.profession);

  return (
    <CreateDisponibiliteClient
      exemples={exemplesPour(profil.profession)}
      sansModeleDeContrat={sansModeleDeContrat}
      profession={profil.profession}
    />
  );
}
