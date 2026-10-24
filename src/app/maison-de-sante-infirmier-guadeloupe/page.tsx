import { Metadata } from "next";
import { INFIRMIER, TERRITOIRES, PORTES, metadonneesPage, basDePageMsp } from "@/lib/pagesDiffusion";
import { PERIMETRE_GUADELOUPE } from "@/lib/annoncesTerritoire";
import PagePorte from "@/components/diffusion/PagePorte";

export const dynamic = "force-dynamic";

// Porte MAISON DE SANTÉ (section 299, revue le 24/10 : une MSP n'embauche pas) — contenu dans lib/pagesDiffusion.
const PRO   = INFIRMIER;
const TERR  = TERRITOIRES.GUADELOUPE;
const PORTE = PORTES.MAISON_DE_SANTE;

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
          <h2 className="text-base font-semibold text-gray-600">{basDePageMsp(PRO, TERR).titre}</h2>
          <p>{basDePageMsp(PRO, TERR).texte}</p>
        </>
      }
    />
  );
}
