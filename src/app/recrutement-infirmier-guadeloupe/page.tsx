import { Metadata } from "next";
import { INFIRMIER, TERRITOIRES, PORTES, metadonneesPage } from "@/lib/pagesDiffusion";
import { PERIMETRE_GUADELOUPE } from "@/lib/annoncesTerritoire";
import PagePorte from "@/components/diffusion/PagePorte";

export const dynamic = "force-dynamic";

// Porte CABINET des infirmiers (section 299) — contenu dans lib/pagesDiffusion.
const PRO   = INFIRMIER;
const TERR  = TERRITOIRES.GUADELOUPE;
const PORTE = PORTES.CABINET;

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
          <h2 className="text-base font-semibold text-gray-600">Recruter un infirmier en Guadeloupe</h2>
          <p>
            Un remplacement pendant vos congés ou une collaboration libérale : publiez votre
            annonce, les infirmiers disponibles s&apos;y intéressent, vous choisissez avec qui
            échanger. Le contrat suit le modèle du Conseil national de l&apos;Ordre des infirmiers.
          </p>
        </>
      }
    />
  );
}
