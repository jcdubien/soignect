import { Metadata } from "next";
import { INFIRMIER, TERRITOIRES, PORTES, metadonneesPage } from "@/lib/pagesDiffusion";
import { PERIMETRE_GUADELOUPE } from "@/lib/annoncesTerritoire";
import PagePorte from "@/components/diffusion/PagePorte";

export const dynamic = "force-dynamic";

// Porte CHERCHEUR des infirmiers (section 299). Elle passe par PagePorte : les trois pages
// historiques des kinés gardent leur rendu propre, vérifié à l'écran, mais une nouvelle page n'a
// aucune raison de recopier ce rendu.
const PRO   = INFIRMIER;
const TERR  = TERRITOIRES.GUADELOUPE;
const PORTE = PORTES.CHERCHEUR;

export const metadata: Metadata = metadonneesPage(PORTE, PRO, TERR);

export default function Page() {
  return (
    <PagePorte
      porte={PORTE}
      profession={PRO}
      territoire={TERR}
      zones={PERIMETRE_GUADELOUPE.zones}
      communes={PERIMETRE_GUADELOUPE.communes}
      basDePage={
        <>
          <h2 className="text-base font-semibold text-gray-600">Remplacement et collaboration infirmiers en Guadeloupe</h2>
          <p>
            Soignect met en relation les infirmiers libéraux de Guadeloupe et les infirmiers qui
            cherchent un remplacement ou une collaboration. Le contrat suit les modèles du Conseil
            national de l&apos;Ordre des infirmiers et se pré-remplit avec les informations des deux
            parties. L&apos;inscription est gratuite pour qui cherche un poste.
          </p>
        </>
      }
    />
  );
}
