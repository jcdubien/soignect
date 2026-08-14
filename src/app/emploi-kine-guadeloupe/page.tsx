import { Metadata } from "next";
import { KINESITHERAPEUTE, TERRITOIRES, PORTES, cheminPage } from "@/lib/pagesDiffusion";
import { PERIMETRE_GUADELOUPE } from "@/lib/annoncesTerritoire";
import PagePorte from "@/components/diffusion/PagePorte";

export const dynamic = "force-dynamic";

// Porte ÉTABLISSEMENT (section 212). Le contenu vit dans lib/pagesDiffusion (PORTES.ETABLISSEMENT) ;
// cette page ne fait que composer les trois axes et fournir son bas de page.
const PRO   = KINESITHERAPEUTE;
const TERR  = TERRITOIRES.GUADELOUPE;
const PORTE = PORTES.ETABLISSEMENT;

export const metadata: Metadata = {
  alternates: { canonical: cheminPage(PORTE, PRO, TERR) },
  title: PORTE.metaTitre(PRO, TERR),
  description: PORTE.metaDescription(PRO, TERR),
  openGraph: {
    url: cheminPage(PORTE, PRO, TERR),
    title: PORTE.metaTitre(PRO, TERR),
    description: PORTE.metaDescription(PRO, TERR),
    type: "website",
  },
};

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
          <h2 className="text-base font-semibold text-gray-600">Recruter un kinésithérapeute salarié en Guadeloupe</h2>
          <p>
            Hôpitaux, cliniques, EHPAD, SSR, CAMSP : Soignect référence vos offres de poste
            salarié en kinésithérapie et les présente aux professionnels ayant déclaré être
            ouverts au salariat. Le contrat de travail relève de votre établissement — Soignect
            ne le génère pas et ne s&apos;y substitue pas.
          </p>
        </>
      }
    />
  );
}
