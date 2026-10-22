import RegisterClient from "./RegisterClient";
import { tracerOuvertureInscription } from "@/lib/traceLanding";

export const dynamic = "force-dynamic";

// Page serveur mince (22/10, parcours établissement, point 6) : elle trace l'OUVERTURE de
// l'inscription avec sa provenance, puis rend l'écran client inchangé. On ne comptait que les
// inscriptions abouties : le clic sur « Publier une offre » d'une page d'entrée était invisible.
// Côté serveur plutôt qu'un appel depuis le navigateur : aucune adresse publique à écriture
// libre, et le même repérage des robots que les visites de pages.
export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  await tracerOuvertureInscription({
    src: un(sp.src), type: un(sp.profileType), etablissement: un(sp.structure) === "1", profession: un(sp.profession),
  });
  return <RegisterClient />;
}
