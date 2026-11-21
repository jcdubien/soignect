/* eslint-disable react/no-unescaped-entities */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { blanc } from "./blanc";
import { type ContractDataRemplacementOrthophoniste } from "./types";
import { MentionSignature } from "./signature-mention";
import { DraftBanner, DraftWatermark } from "./watermark";
import { PartyIdentityRows } from "./party-identity";
import { fmtDateUTC } from "@/lib/contrats/date";

// ── REMPLACEMENT ENTRE ORTHOPHONISTES — CONTRAT-TYPE FNO (MAJ AVRIL 2026) ─────────────────────
//
// Ouverture des orthophonistes (21/11). La profession n'a PAS D'ORDRE : pas de modèle ordinal à
// transcrire, pas de communication du contrat à une instance, pas de conciliation ordinale. Le
// modèle de référence est celui de la Fédération nationale des orthophonistes, publié en ligne et
// gratuit. Il est transcrit ici article par article, dans son ordre et avec ses clauses
// particulières (FOH, réunions d'équipe éducative) ; seuls les blancs sont remplis.
//
// Ce que le modèle laisse en blanc et que la plateforme REMPLIT : les parties, la période, le
// motif d'absence, le taux de rétrocession, la case de facturation (CPS ou feuilles du remplacé),
// la durée FOH, le nombre de réunions, la zone de non-installation (exprimée en rayon routier,
// comme le recommande la notice FNO).
//
// Ce qui N'EST PAS repris : la date et le lieu de naissance et la nationalité des parties, que le
// produit ne collecte pas — l'identité imprimée est celle des autres contrats (RPPS, adresse,
// SIRET). Le modèle prévoit aussi deux taux distincts (retenu / reversé) : un seul est demandé,
// voir `ContractDataRemplacementOrthophoniste`.

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, paddingTop: 50, paddingBottom: 60, paddingHorizontal: 55, lineHeight: 1.5, color: "#1a1a1a" },
  header: { textAlign: "center", marginBottom: 18 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#555", marginBottom: 2 },
  version: { fontSize: 8, color: "#888" },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, textTransform: "uppercase", marginTop: 14, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: "#333", paddingBottom: 2 },
  article: { marginBottom: 8 },
  articleTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 3 },
  sousTitre: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginTop: 5, marginBottom: 2 },
  body: { fontSize: 9.5, lineHeight: 1.6 },
  para: { fontSize: 9.5, lineHeight: 1.6, marginTop: 3 },
  infoBox: { backgroundColor: "#f5f5f5", borderWidth: 0.5, borderColor: "#ccc", borderRadius: 3, padding: 8, marginBottom: 8, fontSize: 9 },
  infoRow: { flexDirection: "row", marginBottom: 2 },
  infoLabel: { fontFamily: "Helvetica-Bold", width: 140 },
  infoVal: { flex: 1 },
  sigBlock: { flexDirection: "row", justifyContent: "space-between", marginTop: 30 },
  sigCol: { width: "45%", borderTopWidth: 0.5, borderTopColor: "#555", paddingTop: 6 },
  sigLabel: { fontSize: 8.5, color: "#555" },
  sigImg: { height: 45, marginTop: 4, objectFit: "contain" },
  eidas: { marginTop: 18, fontSize: 7.5, color: "#777", fontFamily: "Helvetica-Oblique", lineHeight: 1.4 },
  annexe: { marginTop: 16, fontSize: 8.5, color: "#444", fontFamily: "Helvetica-Oblique", lineHeight: 1.5 },
  footer: { position: "absolute", bottom: 25, left: 55, right: 55, textAlign: "center", fontSize: 7.5, color: "#888", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 5 },
  pageNum: { position: "absolute", bottom: 12, right: 55, fontSize: 7.5, color: "#aaa" },
});

function fmtDate(iso: string | null): string {
  if (!iso) return blanc("[date à compléter]");
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/** « Si remplacement supérieur à trois mois » (art. 8 de la notice FNO) : la clause n'existe pas
 *  en deçà. Sans dates, on ne peut pas trancher — la clause s'imprime avec sa condition en titre,
 *  comme dans le modèle. */
export function nonInstallationApplicable(debut: string | null, fin: string | null): boolean | null {
  if (!debut || !fin) return null;
  const d = new Date(debut);
  const seuil = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, d.getUTCDate()));
  return new Date(fin).getTime() > seuil.getTime();
}

const LEGAL_MENTION =
  "Document pré-rempli d'après le contrat-type de la FNO — à faire valider par un avocat ou le service juridique de la FNO avant signature.";

export function buildRemplacementOrthophonistePdf(data: ContractDataRemplacementOrthophoniste) {
  const { remplace, remplacant, startDate, endDate, motifAbsence, modeFacturation, retrocessionPct,
    fohMoisMin, reunionsMax, rayonKm, generatedAt, signatureTitulaireImg, signatureRemplacantImg, draft } = data;

  const pct = Math.min(100, Math.max(0, retrocessionPct));
  const surplus = 100 - pct;
  const cps = modeFacturation === "CPS_REMPLACANT";
  const nonInstall = nonInstallationApplicable(startDate, endDate);
  const lieuCabinet = remplace.adresse?.trim() || remplace.location || blanc("[adresse du cabinet]");
  const motif = motifAbsence.trim() || blanc("[motif]");

  // Helvetica intégrée ne porte pas les glyphes de case (☒ ☐) : crochets, lisibles partout.
  const caseCochee = (oui: boolean) => (oui ? "[X]" : "[  ]");

  return (
    <Document title="Contrat de remplacement — orthophonistes" author="Soignect">
      <Page size="A4" style={S.page}>

        <View style={S.header}>
          <Text style={S.title}>Contrat de remplacement</Text>
          <Text style={S.subtitle}>Orthophonistes — contrat-type de la FNO (mise à jour d'avril 2026)</Text>
          <Text style={S.version}>Généré le {fmtDate(generatedAt)}</Text>
          <DraftBanner draft={draft} />
        </View>

        <View style={S.sectionTitle}><Text>Entre les soussigné(e)s</Text></View>

        <View style={S.infoBox}>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{remplace.name ? `${remplace.name}, EI` : blanc("[Nom du remplacé]")}</Text></View>
          <PartyIdentityRows party={remplace} />
          <View style={S.infoRow}><Text style={S.infoLabel}>Profession :</Text><Text style={S.infoVal}>orthophoniste</Text></View>
          <Text style={[S.body, { marginTop: 3 }]}>ci-après dénommé(e) le « Remplacé », de première part,</Text>
        </View>

        <Text style={S.body}>et</Text>

        <View style={[S.infoBox, { marginTop: 6 }]}>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{remplacant.name ? `${remplacant.name}, EI` : blanc("[Nom du remplaçant]")}</Text></View>
          <PartyIdentityRows party={remplacant} />
          <View style={S.infoRow}><Text style={S.infoLabel}>Profession :</Text><Text style={S.infoVal}>orthophoniste</Text></View>
          <Text style={[S.body, { marginTop: 3 }]}>ci-après dénommé(e) le « Remplaçant », de deuxième part,</Text>
        </View>

        <Text style={S.body}>il a été arrêté et convenu ce qui suit :</Text>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 1 — Objet</Text>
          <Text style={S.body}>
            Pendant l'arrêt de son activité professionnelle pour : {motif}, le Remplacé charge le Remplaçant qui accepte, de le remplacer auprès de sa clientèle.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 2 — Durée</Text>
          <Text style={S.body}>
            Le Remplaçant se tiendra à partir du {fmtDateUTC(startDate)} et jusqu'au {fmtDateUTC(endDate)} inclus au cabinet du Remplacé sis : {lieuCabinet}, afin d'y exercer en ses lieux et place.
          </Text>
          <Text style={S.para}>
            Ce contrat ne pourra être rompu avant le terme prévu que d'un commun accord ou en cas de manquement grave aux présentes ou à la législation professionnelle. Dans ce cas, un délai de prévenance raisonnable sera respecté, cf. article « Rupture anticipée » ci-dessous.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 3 — Exercice de la profession</Text>
          <Text style={S.body}>
            Le Remplaçant, exerçant son art en toute indépendance, sera seul responsable des conséquences de son activité professionnelle. Il s'engage donc à respecter les dispositions législatives et réglementaires relatives à l'exercice libéral de l'orthophonie conventionnée et à poursuivre et assurer des soins attentifs et consciencieux aux patients avec la double préoccupation de donner satisfaction à la clientèle et de la tenir attachée à la personne du Remplacé.
          </Text>
          <Text style={S.para}>
            Le Remplacé vérifie que le Remplaçant remplit bien toutes les conditions nécessaires à l'exercice du remplacement dans le cadre de la convention nationale. Il s'engage à porter à la connaissance du Remplaçant les dispositions de la convention et à l'informer des droits et obligations qui s'imposent à lui dans ce cadre.
          </Text>
          <Text style={S.para}>
            Le Remplaçant prend la situation conventionnelle du Remplacé. En conséquence, le Remplaçant ne peut remplacer, dans le cadre conventionnel, un orthophoniste déconventionné.
          </Text>
          <Text style={S.para}>Le Remplaçant doit être couvert par un contrat d'assurance responsabilité civile professionnelle.</Text>
          <Text style={S.para}>Le Remplaçant s'engage à effectuer les démarches nécessaires auprès des différents organismes sociaux afin de régulariser sa situation.</Text>
          <Text style={S.para}>
            Le Remplaçant s'engage à tenir à jour les dossiers des patients en précisant entre autres les actes effectués/réglés et les demandes d'accord préalable réalisées, ceci afin de permettre au Remplacé de retrouver son activité en toute sérénité.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 4 — Local professionnel</Text>
          <Text style={S.body}>
            Pendant la durée de ce remplacement, le Remplaçant aura l'usage des locaux professionnels du Remplacé et disposera du matériel professionnel de ce dernier.
          </Text>
          <Text style={S.para}>
            Le Remplaçant devra s'abstenir de toute dégradation comme de toute modification des lieux. Il s'engage à maintenir en état le matériel et le mobilier mis à sa disposition de façon à rendre locaux, matériels et mobiliers professionnels dans l'état même où il les aura trouvés, sauf usure normale.
          </Text>
          <Text style={S.para}>Les parties ont convenu de faire un état des lieux et d'établir un inventaire qui seront annexés aux présentes.</Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 5 — Frais</Text>
          <Text style={S.body}>
            Pendant la durée du remplacement, le Remplaçant acquittera ses frais personnels et les cotisations sociales qui lui incombent, ainsi que les frais d'achat de matériel nouveau – s'il souhaite acquérir du matériel nouveau – dont il restera propriétaire.
          </Text>
          <Text style={S.para}>
            Le Remplacé continuera de régler ses propres charges sociales ainsi que les frais de gestion du cabinet, il est précisé qu'en cas d'augmentation supérieure à 30 % des frais habituels de gestion du cabinet, le Remplacé pourra demander au Remplaçant de prendre en charge ce dépassement.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 6 — Rétrocessions</Text>
          <Text style={S.body}>
            {caseCochee(cps)} Le Remplaçant dispose d'une CPS et le logiciel du Remplacé permet l'utilisation de la CPS du remplaçant.
          </Text>
          <Text style={S.body}>
            {caseCochee(!cps)} Le logiciel du Remplacé ne permet pas l'utilisation de la CPS du remplaçant.
          </Text>
          {cps ? (
            <Text style={S.para}>
              Le Remplaçant percevra directement auprès de la clientèle les honoraires relatifs aux actes exécutés et télétransmettra avec sa CPS en utilisant le logiciel du Remplacé.
            </Text>
          ) : (
            <Text style={S.para}>
              Le Remplaçant percevra directement auprès de la clientèle les honoraires relatifs aux actes exécutés et en signera l'acquit sur les feuilles de soins préétablies au nom du Remplacé sur lesquelles il portera la mention « X, remplaçant de Y », cette mention sera également indiquée sur les courriers à entête.
            </Text>
          )}
          <Text style={S.para}>
            Le Remplaçant retiendra sur le montant global des actes facturés et réglés par chèque ou espèces par les patients au cours du mois N, non compris les indemnités de déplacement et le forfait post-hospitalisation (FPH) dont il conservera la totalité, une somme égale à {pct} POUR CENT ({pct} %) des honoraires et reversera le surplus, soit {surplus} POUR CENT ({surplus} %) au Remplacé au plus tard le 10 du mois N+1.
          </Text>
          <Text style={S.para}>
            Pour les patients dispensés de l'avance de frais ou qui règlent par virement ou carte bleue, l'ensemble des honoraires relatifs aux actes facturés par le Remplaçant continueront d'être virés sur le compte du Remplacé. Par conséquent, pour ce qui concerne les paiements des actes facturés et réglés, qui seront différés et virés au compte du Remplacé au cours du mois N (hors indemnités de déplacement et forfait post-hospitalisation – FPH, reversés en totalité au Remplaçant), celui-ci s'engage à reverser au Remplaçant {pct} POUR CENT ({pct} %) de leur montant au plus tard le 10 du mois N+1.
          </Text>
          <Text style={S.para}>
            Pour justifier de la rétribution versée mensuellement, le Remplaçant remettra au Remplacé une liste des actes facturés{cps ? " issue du logiciel de gestion" : ""} et Remplaçant et Remplacé pourront avoir sur demande une copie de leur journal de recettes.
          </Text>
          <Text style={S.para}>
            Le montant des honoraires concernant les actes effectués avant le début du remplacement mais réglés postérieurement à cette date par les patients, reviendra de plein droit au Remplacé. De même, le montant des honoraires effectués antérieurement à la fin du contrat mais réglés après, reviendra (minoré de la rétrocession) au Remplaçant.
          </Text>

          <Text style={S.sousTitre}>Clause particulière relative à la valorisation de la prise en charge du patient en situation de handicap (FOH)</Text>
          <Text style={S.body}>
            Si la prise en charge, par le Remplaçant, du patient en situation de handicap dure plus de {fohMoisMin} mois, le Remplaçant pourra facturer le forfait FOH relatif à ce patient ; si cette durée est inférieure, le Remplaçant ne facturera pas le forfait FOH relatif à ce patient.
          </Text>
          <Text style={S.para}>
            Le Remplaçant retiendra sur le montant global de ces forfaits facturés et réglés par chèque ou espèces par les patients au cours du mois N, une somme égale à {pct} POUR CENT ({pct} %) des honoraires et reversera le surplus, soit {surplus} POUR CENT ({surplus} %) au Remplacé au plus tard le 10 du mois N+1.
          </Text>
          <Text style={S.para}>
            Pour les patients dispensés de l'avance de frais ou qui règlent par virement ou carte bleue, le paiement de ces forfaits facturés et réglés, qui seront différés et virés au compte du Remplacé au cours du mois N, celui-ci s'engage à reverser au Remplaçant {pct} POUR CENT ({pct} %) de leur montant au plus tard le 10 du mois N+1.
          </Text>
          <Text style={S.para}>
            Il est rappelé que sauf aggravation du handicap, le forfait FOH ne peut être demandé qu'une seule fois par patient et par année civile. Par conséquent, un inventaire des demandes des forfaits FOH sera établi en début de remplacement par le Remplacé et remis au Remplaçant ; et inversement à la fin du contrat de remplacement.
          </Text>

          <Text style={S.sousTitre}>Clause particulière relative à l'implication des orthophonistes en dehors du cabinet au sein des équipes éducatives</Text>
          <Text style={S.body}>
            Si la prise en charge d'un patient par le Remplaçant excède trois (3) mois, ce dernier pourra se faire rémunérer son intervention lors des réunions scolaires dédiées. Si la durée du remplacement est inférieure à trois mois, le Remplaçant ne se fera pas rémunérer sa participation éventuelle à ces réunions.
          </Text>
          <Text style={S.para}>
            L'aide annuelle étant réglée dans le cadre du Forfait d'Aide à la Modernisation et à l'Informatisation (FAMI), le Remplaçant devra remettre au Remplacé un justificatif d'intervention avant la date de fin du remplacement (sur lequel sera précisé « remplaçant de … ») et, le cas échéant, avant le 31 décembre de l'année N si le remplacement se termine en N+1. Le Remplacé reversera alors 100 % de cette aide forfaitaire au Remplaçant lors du paiement de la dernière rétrocession clôturant le contrat de remplacement.
          </Text>
          <Text style={S.para}>
            Il est convenu que le Remplaçant pourra prétendre au paiement de l'aide forfaitaire pour un maximum de {reunionsMax > 0 ? reunionsMax : blanc("[n]")} réunion(s) pour la période du {fmtDateUTC(startDate)} au {fmtDateUTC(endDate)}.
          </Text>
          <Text style={S.para}>
            Pour rappel, conformément à l'article 29 de la convention nationale des orthophonistes, cette aide annuelle conventionnelle versée au Remplacé est limitée à 5 interventions par an et par orthophoniste.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 7 — Rupture anticipée</Text>
          <Text style={S.body}>
            En cas de non-respect de l'un des engagements évoqués dans ce contrat, la présente convention deviendrait automatiquement caduque, quinze jours francs après mise en demeure lui ayant été adressée par l'autre partie, sous forme recommandée avec accusé de réception, l'invitant à satisfaire à ses obligations, et demeurée sans effet (le délai partant à compter de la première présentation de cette lettre).
          </Text>
        </View>

        {nonInstall !== false && (
          <View style={S.article}>
            <Text style={S.articleTitle}>
              Article 8 — Clause de non-installation{nonInstall === null ? " (si remplacement supérieur à trois mois)" : ""}
            </Text>
            <Text style={S.body}>
              A l'expiration du présent contrat, le Remplaçant s'interdira, sauf autorisation écrite du Remplacé, d'exercer en libéral l'orthophonie en tant que titulaire ou en collaboration, pendant une durée de DOUZE (12) mois, dans un rayon de {rayonKm} km autour du cabinet du Remplacé, distance mesurée en trajet routier.
            </Text>
          </View>
        )}

        <View style={S.article}>
          <Text style={S.articleTitle}>Article {nonInstall === false ? 8 : 9} — Interdiction de détournement de patientèle</Text>
          <Text style={S.body}>
            Pendant la durée de la présente convention et lors de sa cessation, la clientèle mise en relation avec le Remplaçant pendant l'exécution du contrat, reste dans le patrimoine professionnel du titulaire, tout comme les dossiers des patients.
          </Text>
          <Text style={S.para}>Le Remplaçant s'interdit tout détournement de cette clientèle et/ou concurrence déloyale.</Text>
          <Text style={S.para}>Cet engagement est opposable au successeur éventuel du Remplacé.</Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article {nonInstall === false ? 9 : 10} — Différend</Text>
          <Text style={S.body}>
            En cas de difficultés entre les parties sur l'interprétation ou l'exécution du présent contrat, elles auront avant toute action en justice, en vue de se concilier amiablement, à soumettre leur différend à un conciliateur choisi d'un commun accord.
          </Text>
          <Text style={S.para}>
            Celui-ci s'efforcera de concilier les parties et d'amener à une solution amiable ce, dans un délai raisonnable à compter de la désignation. Passé ce délai, la conciliation sera réputée avoir échoué, et chacune des parties intéressées trouvera sa liberté pour agir comme elle l'entendra auprès de la juridiction compétente.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article {nonInstall === false ? 10 : 11} — Élection de domicile</Text>
          <Text style={S.body}>Pour l'exécution des présentes, les parties font élection de domicile en leur demeure respective.</Text>
        </View>

        <Text style={[S.body, { marginTop: 8 }]}>
          Fait à {remplace.location || blanc("[lieu]")}, en deux exemplaires originaux (un pour chaque partie).
        </Text>

        <View style={S.sigBlock}>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>Le Remplacé</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>{remplace.name || blanc("[Nom du remplacé]")}</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>Date et signature :</Text>
            {signatureTitulaireImg ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- <Image> @react-pdf (PDF), pas une balise HTML img
              <Image style={S.sigImg} src={signatureTitulaireImg} />
            ) : (
              <Text style={[S.sigLabel, { marginTop: 20 }]}> </Text>
            )}
          </View>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>Le Remplaçant</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>{remplacant.name || blanc("[Nom du remplaçant]")}</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>Date et signature :</Text>
            {signatureRemplacantImg ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- <Image> @react-pdf (PDF), pas une balise HTML img
              <Image style={S.sigImg} src={signatureRemplacantImg} />
            ) : (
              <Text style={[S.sigLabel, { marginTop: 20 }]}> </Text>
            )}
          </View>
        </View>

        <MentionSignature
          signatureTitulaireImg={signatureTitulaireImg}
          signatureRemplacantImg={signatureRemplacantImg}
          style={S.eidas}
        />

        <View style={S.annexe}>
          <Text>
            Annexe — Un contrat-type ne peut répondre pleinement à certaines situations particulières, pour lesquelles la FNO conseille de se rapprocher de son service juridique pour un contrat adapté. Un contrat de remplacement ne se signe pas avec une personne qui n'est pas diplômée.
          </Text>
        </View>

        <Text style={S.footer}>{LEGAL_MENTION}</Text>
        <Text style={S.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        <DraftWatermark draft={draft} />
      </Page>
    </Document>
  );
}
