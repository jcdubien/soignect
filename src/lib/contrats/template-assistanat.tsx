/* eslint-disable react/no-unescaped-entities */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ContractDataAssisanat } from "./types";

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, paddingTop: 50, paddingBottom: 60, paddingHorizontal: 55, lineHeight: 1.5, color: "#1a1a1a" },
  header: { textAlign: "center", marginBottom: 18 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#555", marginBottom: 2 },
  version: { fontSize: 8, color: "#888" },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, textTransform: "uppercase", marginTop: 14, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: "#333", paddingBottom: 2 },
  article: { marginBottom: 8 },
  articleTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 3 },
  body: { fontSize: 9.5, lineHeight: 1.6 },
  infoBox: { backgroundColor: "#f5f5f5", borderWidth: 0.5, borderColor: "#ccc", borderRadius: 3, padding: 8, marginBottom: 8, fontSize: 9 },
  infoRow: { flexDirection: "row", marginBottom: 2 },
  infoLabel: { fontFamily: "Helvetica-Bold", width: 140 },
  infoVal: { flex: 1 },
  mandatory: { backgroundColor: "#fff7ed", borderLeftWidth: 2.5, borderLeftColor: "#ea580c", paddingLeft: 7, paddingVertical: 3, marginBottom: 4 },
  placeholder: { color: "#b45309", fontFamily: "Helvetica-Bold" },
  sigBlock: { flexDirection: "row", justifyContent: "space-between", marginTop: 30 },
  sigCol: { width: "45%", borderTopWidth: 0.5, borderTopColor: "#555", paddingTop: 6 },
  sigLabel: { fontSize: 8.5, color: "#555" },
  footer: { position: "absolute", bottom: 25, left: 55, right: 55, textAlign: "center", fontSize: 7.5, color: "#888", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 5 },
  pageNum: { position: "absolute", bottom: 12, right: 55, fontSize: 7.5, color: "#aaa" },
});

function fmtDate(iso: string | null): string {
  if (!iso) return "[date à compléter]";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

const LEGAL_MENTION =
  "Document pré-rempli à titre indicatif — à faire valider par un avocat ou l'Ordre des masseurs-kinésithérapeutes avant signature.";

export function buildAssisanatPdf(data: ContractDataAssisanat) {
  const { titulaire, assistant, startDate, minMonths, redevancePct, rayonKm, dureeAns, periodeEssai, generatedAt } = data;
  const dureeStr = minMonths ? `${minMonths} mois` : "[durée à compléter]";

  return (
    <Document title="Contrat d'assistanat libéral" author="KineBoard">
      <Page size="A4" style={S.page}>

        {/* En-tête */}
        <View style={S.header}>
          <Text style={S.title}>Contrat d'assistanat libéral</Text>
          <Text style={S.subtitle}>Masseurs-kinésithérapeutes — modèle CNOMK (15/11/2024)</Text>
          <Text style={S.version}>Généré le {fmtDate(generatedAt)}</Text>
        </View>

        {/* Parties */}
        <View style={S.sectionTitle}><Text>Entre les soussignés</Text></View>

        <View style={S.infoBox}>
          <Text style={[S.articleTitle, { marginBottom: 4 }]}>Le titulaire :</Text>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{titulaire.name || "[Nom du titulaire]"}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>N° RPPS :</Text><Text style={[S.infoVal, S.placeholder]}>[N° RPPS à compléter]</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>N° Ordre :</Text><Text style={[S.infoVal, S.placeholder]}>[N° Ordre à compléter]</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Adresse professionnelle :</Text><Text style={[S.infoVal, S.placeholder]}>{titulaire.location} — [adresse complète à compléter]</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Profession :</Text><Text style={S.infoVal}>{titulaire.profession}</Text></View>
        </View>

        <View style={S.infoBox}>
          <Text style={[S.articleTitle, { marginBottom: 4 }]}>L'assistant :</Text>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{assistant.name || "[Nom de l'assistant]"}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>N° RPPS :</Text><Text style={[S.infoVal, S.placeholder]}>[N° RPPS à compléter]</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>N° Ordre :</Text><Text style={[S.infoVal, S.placeholder]}>[N° Ordre à compléter]</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Adresse :</Text><Text style={[S.infoVal, S.placeholder]}>{assistant.location} — [adresse complète à compléter]</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Profession :</Text><Text style={S.infoVal}>{assistant.profession}</Text></View>
        </View>

        <Text style={S.body}>Il a été convenu et arrêté ce qui suit :</Text>

        {/* Art. 1 — Objet */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 1 — Objet (clause réglementaire)</Text>
          <Text style={S.body}>
            Le présent contrat a pour objet de définir les conditions dans lesquelles {assistant.name || "l'assistant"} exercera sa profession en qualité d'assistant libéral de {titulaire.name || "le titulaire"}, à titre exclusif de toute clientèle personnelle. L'assistant ne peut constituer de clientèle propre pendant la durée du présent contrat.
          </Text>
        </View>

        {/* Art. 2 — Durée */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 2 — Durée</Text>
          <Text style={S.body}>
            Le présent contrat est conclu pour une durée de {dureeStr} à compter du {fmtDate(startDate)}.
          </Text>
          {periodeEssai && (
            <Text style={[S.body, { marginTop: 3, fontFamily: "Helvetica-Oblique" }]}>
              Une période d'essai de 3 mois est prévue. Durant cette période, chaque partie peut mettre fin au contrat avec un préavis de 2 semaines.
            </Text>
          )}
        </View>

        {/* Art. 3 — Conditions d'exercice */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 3 — Conditions d'exercice</Text>
          <Text style={S.body}>
            L'assistant exerce dans les locaux professionnels du titulaire, situés à {titulaire.location}. Il se conformera aux horaires et aux modalités d'organisation définies en accord avec le titulaire. L'assistant dispose d'une indépendance professionnelle complète dans la pratique de ses actes.
          </Text>
        </View>

        {/* Art. 4 — Redevance */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 4 — Redevance</Text>
          <Text style={S.body}>
            En contrepartie de la mise à disposition du cabinet et des équipements, l'assistant versera au titulaire une redevance mensuelle de {redevancePct}% de ses honoraires nets encaissés. Cette redevance sera versée par <Text style={S.placeholder}>[virement bancaire / autre]</Text> dans les <Text style={S.placeholder}>[délai]</Text> jours suivant la fin de chaque mois.
          </Text>
        </View>

        {/* Art. 5 — Renégociation à 4 ans (réglementaire) */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 5 — Renégociation (clause réglementaire)</Text>
          <Text style={S.body}>
            Conformément aux dispositions réglementaires en vigueur, le présent contrat fera l'objet d'une renégociation obligatoire au bout de 4 ans. Les parties s'engagent à engager cette renégociation au moins 6 mois avant l'échéance afin de permettre une transition dans les meilleures conditions.
          </Text>
        </View>

        {/* Art. 6 — Locaux et matériel */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 6 — Locaux et matériel</Text>
          <Text style={S.body}>
            Le titulaire met à la disposition de l'assistant ses locaux professionnels, son matériel et son équipement. L'assistant s'engage à les utiliser avec soin et à ne pas les détourner de leur usage professionnel. Les charges afférentes aux locaux (loyer, charges, entretien) sont réparties selon les modalités suivantes : <Text style={S.placeholder}>[modalités à préciser]</Text>.
          </Text>
        </View>

        {/* Art. 7 — Obligations professionnelles */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 7 — Obligations professionnelles</Text>
          <Text style={S.body}>
            L'assistant est tenu de respecter le code de déontologie des masseurs-kinésithérapeutes et toutes les dispositions légales et réglementaires applicables à sa profession. Il est tenu au secret professionnel et au respect de la vie privée des patients.
          </Text>
        </View>

        {/* Art. 8 — Obligations fiscales et sociales */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 8 — Obligations fiscales et sociales</Text>
          <Text style={S.body}>
            Chaque partie assume les charges fiscales et sociales afférentes à sa propre activité libérale. L'assistant est personnellement responsable de ses déclarations fiscales, de ses cotisations URSSAF et de toutes autres obligations légales découlant de son statut de professionnel libéral indépendant.
          </Text>
        </View>

        {/* Art. 9 — Assurance et responsabilité (réglementaire) */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 9 — Assurance et responsabilité (clause réglementaire)</Text>
          <Text style={S.body}>
            Chaque partie est tenue de souscrire et de maintenir une assurance en responsabilité civile professionnelle couvrant l'ensemble de ses actes professionnels. Chacune devra être en mesure de justifier de cette assurance à la demande de l'autre partie ou de l'Ordre.
          </Text>
        </View>

        {/* Art. 10 — Remplacement temporaire */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 10 — Remplacement temporaire</Text>
          <Text style={S.body}>
            En cas d'absence temporaire de l'assistant, celui-ci pourra se faire remplacer avec l'accord préalable du titulaire. Le remplaçant devra satisfaire aux conditions légales et réglementaires requises pour exercer la profession.
          </Text>
        </View>

        {/* Art. 11 — Congés et absences */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 11 — Congés et absences</Text>
          <Text style={S.body}>
            Les modalités de prise de congés seront définies d'un commun accord entre les parties, dans le respect des droits et obligations respectifs de chacun. L'assistant informera le titulaire de ses absences prévisibles avec un préavis raisonnable.
          </Text>
        </View>

        {/* Art. 12 — Confidentialité */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 12 — Confidentialité</Text>
          <Text style={S.body}>
            Les parties s'engagent à garder confidentielles toutes les informations relatives aux patients, à l'organisation du cabinet et à leurs relations contractuelles respectives, tant pendant la durée du contrat qu'après sa cessation.
          </Text>
        </View>

        {/* Art. 13 — Continuité des soins (réglementaire) */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 13 — Continuité des soins (clause réglementaire)</Text>
          <Text style={S.body}>
            Les parties s'engagent à assurer la continuité des soins des patients en toutes circonstances, conformément à leurs obligations déontologiques. En cas de cessation du contrat, des dispositions seront prises pour garantir la prise en charge des patients en cours de traitement.
          </Text>
        </View>

        {/* Art. 14 — Dossiers patients */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 14 — Dossiers patients</Text>
          <Text style={S.body}>
            Les dossiers des patients traités dans le cadre du présent contrat demeurent la propriété du titulaire. À la cessation du contrat, l'assistant remettra l'intégralité des dossiers au titulaire dans les meilleurs délais.
          </Text>
        </View>

        {/* Art. 15 — Cessation d'activité du titulaire */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 15 — Cessation d'activité du titulaire — priorité de succession</Text>
          <Text style={S.body}>
            En cas de cessation définitive d'activité du titulaire, l'assistant bénéficiera d'une priorité pour la reprise du cabinet. Les conditions financières et modalités pratiques de ce rachat seront négociées de bonne foi entre les parties.
          </Text>
        </View>

        {/* Art. 16 — Association du titulaire */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 16 — Association du titulaire</Text>
          <Text style={S.body}>
            En cas de projet d'association du titulaire avec un tiers, l'assistant se verra proposer en priorité d'intégrer cette association, dans des conditions à définir d'un commun accord.
          </Text>
        </View>

        {/* Art. 17 — Résiliation */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 17 — Résiliation et préavis</Text>
          <Text style={S.body}>
            Le présent contrat peut être résilié par l'une ou l'autre des parties sous réserve du respect d'un préavis de 2 semaines pendant les 3 premiers mois d'exécution, puis de 3 mois au-delà. En cas de manquement grave aux obligations contractuelles, la résiliation peut être prononcée sans préavis. La résiliation fera l'objet d'une notification écrite.
          </Text>
        </View>

        {/* Art. 18 — Conciliation (réglementaire) */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 18 — Conciliation (clause réglementaire)</Text>
          <Text style={S.body}>
            En cas de litige relatif à l'exécution du présent contrat, les parties s'engagent à saisir préalablement le conseil départemental de l'Ordre des masseurs-kinésithérapeutes compétent, conformément à l'article R.4321-99 al. 2 du code de la santé publique.
          </Text>
        </View>

        {/* Art. 19 — Non-concurrence */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 19 — Clause de non-concurrence</Text>
          <Text style={S.body}>
            À l'issue du contrat, l'assistant s'interdit de s'installer ou d'exercer à titre libéral dans un rayon de {rayonKm} km autour du cabinet du titulaire pendant une durée de {dureeAns} an{dureeAns > 1 ? "s" : ""} à compter de la cessation effective du contrat.
          </Text>
          <Text style={[S.body, { marginTop: 3, fontFamily: "Helvetica-Oblique" }]}>
            Par dérogation, l'assistant conserve le droit d'effectuer des remplacements temporaires dans cette zone pendant la période de non-concurrence, conformément à la réglementation en vigueur.
          </Text>
        </View>

        {/* Art. 20 — Absence de contre-lettre */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 20 — Absence de contre-lettre</Text>
          <Text style={S.body}>
            Les parties déclarent qu'il n'existe aucune convention secrète, contre-lettre ou avenant non communiqué à l'Ordre susceptible de modifier les dispositions du présent contrat.
          </Text>
        </View>

        {/* Art. 21 — Communication à l'Ordre (réglementaire) */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 21 — Communication à l'Ordre (clause réglementaire)</Text>
          <Text style={S.body}>
            Le présent contrat sera communiqué au conseil départemental de l'Ordre des masseurs-kinésithérapeutes dans un délai d'un mois suivant sa signature, conformément aux obligations réglementaires.
          </Text>
        </View>

        {/* Signatures */}
        <View style={S.sigBlock}>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>Le titulaire</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>{titulaire.name || "[Nom du titulaire]"}</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>Date et signature :</Text>
            <Text style={[S.sigLabel, { marginTop: 20 }]}> </Text>
          </View>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>L'assistant</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>{assistant.name || "[Nom de l'assistant]"}</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>Date et signature :</Text>
            <Text style={[S.sigLabel, { marginTop: 20 }]}> </Text>
          </View>
        </View>

        {/* Pied de page */}
        <Text style={S.footer}>{LEGAL_MENTION}</Text>
        <Text style={S.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
