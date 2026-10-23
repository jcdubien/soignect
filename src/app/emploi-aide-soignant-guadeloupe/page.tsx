import { Metadata } from "next";
import { AIDE_SOIGNANT, TERRITOIRES, PORTES, metadonneesPage } from "@/lib/pagesDiffusion";
import { PERIMETRE_GUADELOUPE } from "@/lib/annoncesTerritoire";
import PagePorte from "@/components/diffusion/PagePorte";
import { CONTRAT_RESTE_LE_VOTRE } from "@/lib/contrats/gabaritsSalarie";

export const dynamic = "force-dynamic";

// Porte ÉTABLISSEMENT des aides-soignants (section 304) — leur seule porte : le métier ne
// s'exerce qu'en salariat, premier besoin des EHPAD, SSR et cliniques.
const PRO   = AIDE_SOIGNANT;
const TERR  = TERRITOIRES.GUADELOUPE;
const PORTE = PORTES.ETABLISSEMENT;

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
          <h2 className="text-base font-semibold text-gray-600">Recruter un aide-soignant en Guadeloupe</h2>
          <p>
            EHPAD, SSIAD, cliniques, hôpitaux, SSR : Soignect référence vos
            offres de poste d&apos;aide-soignant et les présente aux aides-soignants inscrits. {CONTRAT_RESTE_LE_VOTRE}
          </p>
        </>
      }
    />
  );
}
