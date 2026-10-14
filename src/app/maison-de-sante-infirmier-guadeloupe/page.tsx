import { Metadata } from "next";
import { INFIRMIER, TERRITOIRES, PORTES, metadonneesPage } from "@/lib/pagesDiffusion";
import { PERIMETRE_GUADELOUPE } from "@/lib/annoncesTerritoire";
import PagePorte from "@/components/diffusion/PagePorte";

export const dynamic = "force-dynamic";

// Porte MAISON DE SANTÉ (section 299) — contenu dans lib/pagesDiffusion.
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
          <h2 className="text-base font-semibold text-gray-600">Recruter {PRO.unSingulier} en maison de santé en Guadeloupe</h2>
          <p>
            Maisons de santé pluriprofessionnelles : publiez vos postes comme un cabinet, et
            cochez « exercice coordonné » sur l&apos;annonce. Un candidat qui recherche ce mode
            d&apos;exercice le retrouve dans son score de compatibilité avec votre poste. Le
            contrat suit le modèle de l&apos;Ordre de la profession.
          </p>
        </>
      }
    />
  );
}
