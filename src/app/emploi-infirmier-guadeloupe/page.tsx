import { Metadata } from "next";
import { INFIRMIER, TERRITOIRES, PORTES, metadonneesPage } from "@/lib/pagesDiffusion";
import { PERIMETRE_GUADELOUPE } from "@/lib/annoncesTerritoire";
import PagePorte from "@/components/diffusion/PagePorte";

export const dynamic = "force-dynamic";

// Porte ÉTABLISSEMENT des infirmiers (section 299) — la porte centrale de cette profession,
// salariée aux deux tiers en Guadeloupe (stratégie, section 5).
const PRO   = INFIRMIER;
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
          <h2 className="text-base font-semibold text-gray-600">Recruter un infirmier salarié en Guadeloupe</h2>
          <p>
            Hôpitaux, cliniques, EHPAD, SSR, centres de santé : Soignect référence vos offres de
            poste salarié d&apos;infirmier et les présente aux professionnels ayant déclaré être
            ouverts au salariat. Le contrat de travail relève de votre établissement — Soignect
            ne le génère pas et ne s&apos;y substitue pas.
          </p>
        </>
      }
    />
  );
}
