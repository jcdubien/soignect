import { Metadata } from "next";
import { KINESITHERAPEUTE, TERRITOIRES, PORTES, cheminPage } from "@/lib/pagesDiffusion";
import { PERIMETRE_GUADELOUPE } from "@/lib/annoncesTerritoire";
import PagePorte from "@/components/diffusion/PagePorte";

export const dynamic = "force-dynamic";

// Porte CABINET (section 212). Le contenu vit dans lib/pagesDiffusion (PORTES.CABINET) ;
// cette page ne fait que composer les trois axes et fournir son bas de page.
const PRO   = KINESITHERAPEUTE;
const TERR  = TERRITOIRES.GUADELOUPE;
const PORTE = PORTES.CABINET;

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
          <h2 className="text-base font-semibold text-gray-600">Recruter un kinésithérapeute en Guadeloupe</h2>
          <p>
            Soignect met en relation les cabinets de Guadeloupe et les kinésithérapeutes en
            recherche de poste. Vous publiez ce que vous proposez — remplacement, assistanat ou
            collaboration libérale — et vous voyez qui s&apos;y intéresse. Le contrat suit le
            modèle CNOMK, pré-rempli depuis votre annonce.
          </p>
          <p>
            Aucune commission n&apos;est prélevée sur les honoraires ni sur la rétrocession.
          </p>
        </>
      }
    />
  );
}
