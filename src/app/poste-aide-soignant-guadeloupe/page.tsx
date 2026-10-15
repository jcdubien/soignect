import { Metadata } from "next";
import { AIDE_SOIGNANT, TERRITOIRES, PORTES, metadonneesPage } from "@/lib/pagesDiffusion";
import { PERIMETRE_GUADELOUPE } from "@/lib/annoncesTerritoire";
import PagePorte from "@/components/diffusion/PagePorte";

export const dynamic = "force-dynamic";

// Porte CHERCHEUR DE POSTE SALARIÉ des aides-soignants (section 305) — le pendant candidat de
// /emploi-aide-soignant-guadeloupe.
const PRO   = AIDE_SOIGNANT;
const TERR  = TERRITOIRES.GUADELOUPE;
const PORTE = PORTES.CANDIDAT_SALARIE;

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
          <h2 className="text-base font-semibold text-gray-600">Trouver un poste d&apos;aide-soignant en Guadeloupe</h2>
          <p>
            Soignect réunit les offres d&apos;aide-soignant publiées par les EHPAD, SSIAD,
            cliniques, hôpitaux et SSR de Guadeloupe. Vous publiez votre disponibilité — CDI, CDD
            ou vacations, vos zones, vos dates — et les employeurs vous contactent. Le contrat de
            travail est celui de l&apos;employeur. L&apos;inscription est gratuite.
          </p>
        </>
      }
    />
  );
}
