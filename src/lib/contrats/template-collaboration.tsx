/* eslint-disable react/no-unescaped-entities */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { type ContractDataCollaboration, SIGNATURE_LEGAL_MENTION } from "./types";
import { DraftBanner, DraftWatermark } from "./watermark";
import { PartyIdentityRows } from "./party-identity";

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
  sigImg: { height: 45, marginTop: 4, objectFit: "contain" },
  eidas: { marginTop: 18, fontSize: 7.5, color: "#777", fontFamily: "Helvetica-Oblique", lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 25, left: 55, right: 55, textAlign: "center", fontSize: 7.5, color: "#888", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 5 },
  pageNum: { position: "absolute", bottom: 12, right: 55, fontSize: 7.5, color: "#aaa" },
});

function fmtDate(iso: string | null): string {
  if (!iso) return "[date à compléter]";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

const LEGAL_MENTION =
  "Document pré-rempli à titre indicatif — à faire valider par un avocat ou l'Ordre des masseurs-kinésithérapeutes avant signature.";

export function buildCollaborationPdf(data: ContractDataCollaboration) {
  const { titulaire, collaborateur, startDate, minMonths, redevancePct, rayonKm, dureeAns, periodeEssai, generatedAt,
    signatureTitulaireImg, signatureRemplacantImg, draft } = data;
  const dureeStr = minMonths ? `${minMonths} mois` : "[durée à compléter]";

  return (
    <Document title="Contrat de collaboration libérale" author="Soignect">
      <Page size="A4" style={S.page}>

        {/* En-tête */}
        <View style={S.header}>
          <Text style={S.title}>Contrat de collaboration libérale</Text>
          <Text style={S.subtitle}>Masseurs-kinésithérapeutes — modèle CNOMK (15/11/2024)</Text>
          <Text style={S.version}>Généré le {fmtDate(generatedAt)}</Text>
          <DraftBanner draft={draft} />
        </View>

        {/* Parties */}
        <View style={S.sectionTitle}><Text>Entre les soussignés</Text></View>

        <View style={S.infoBox}>
          <Text style={[S.articleTitle, { marginBottom: 4 }]}>Le titulaire :</Text>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{titulaire.name || "[Nom du titulaire]"}</Text></View>
          <PartyIdentityRows party={titulaire} />
          <View style={S.infoRow}><Text style={S.infoLabel}>Profession :</Text><Text style={S.infoVal}>{titulaire.profession}</Text></View>
        </View>

        <View style={S.infoBox}>
          <Text style={[S.articleTitle, { marginBottom: 4 }]}>Le collaborateur :</Text>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{collaborateur.name || "[Nom du collaborateur]"}</Text></View>
          <PartyIdentityRows party={collaborateur} />
          <View style={S.infoRow}><Text style={S.infoLabel}>Profession :</Text><Text style={S.infoVal}>{collaborateur.profession}</Text></View>
        </View>

        <Text style={S.body}>Il a été convenu et arrêté ce qui suit :</Text>

        {/* Art. 1 — Objet */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 1 — Objet</Text>
          <Text style={S.body}>
            Le présent contrat a pour objet de définir les conditions dans lesquelles {collaborateur.name || "le collaborateur"} exercera sa profession en qualité de collaborateur libéral de {titulaire.name || "le titulaire"}. Le contrat de collaboration libérale est distinct du contrat d'assistanat : le collaborateur peut développer une clientèle personnelle.
          </Text>
        </View>

        {/* Art. 2 — Développement de clientèle (réglementaire) */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 2 — Développement de clientèle personnelle (clause réglementaire)</Text>
          <Text style={S.body}>
            Contrairement au contrat d'assistanat, le collaborateur est autorisé à développer une clientèle personnelle dans les conditions prévues par le présent contrat et par le code de déontologie des masseurs-kinésithérapeutes. Cette clientèle lui est propre et ne saurait être confondue avec celle du titulaire.
          </Text>
        </View>

        {/* Art. 3 — Durée */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 3 — Durée</Text>
          <Text style={S.body}>
            Le présent contrat est conclu pour une durée de {dureeStr} à compter du {fmtDate(startDate)}.
          </Text>
          {periodeEssai && (
            <Text style={[S.body, { marginTop: 3, fontFamily: "Helvetica-Oblique" }]}>
              Une période d'essai de 3 mois est prévue. Durant cette période, chaque partie peut mettre fin au contrat avec un préavis de 2 semaines.
            </Text>
          )}
        </View>

        {/* Art. 4 — Conditions d'exercice */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 4 — Conditions d'exercice</Text>
          <Text style={S.body}>
            Le collaborateur exerce dans les locaux professionnels du titulaire, situés à {titulaire.location}. Il dispose d'une totale indépendance professionnelle dans la pratique de ses actes, tant pour sa propre clientèle que pour les patients qui lui sont confiés par le titulaire.
          </Text>
        </View>

        {/* Art. 5 — Redevance */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 5 — Redevance</Text>
          <Text style={S.body}>
            En contrepartie de la mise à disposition des locaux, du matériel et des équipements, le collaborateur versera au titulaire une redevance mensuelle de {redevancePct}% de ses honoraires nets encaissés. Cette redevance sera versée par <Text style={S.placeholder}>[virement bancaire / autre]</Text> dans les <Text style={S.placeholder}>[délai]</Text> jours suivant la fin de chaque mois.
          </Text>
        </View>

        {/* Art. 6 — Locaux et matériel */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 6 — Locaux et matériel</Text>
          <Text style={S.body}>
            Le titulaire met à la disposition du collaborateur ses locaux professionnels, son matériel et ses équipements. Le collaborateur s'engage à les entretenir avec soin. La répartition des charges (loyer, fluides, fournitures) est fixée comme suit : <Text style={S.placeholder}>[modalités à préciser]</Text>.
          </Text>
        </View>

        {/* Art. 7 — Obligations professionnelles */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 7 — Obligations professionnelles</Text>
          <Text style={S.body}>
            Chaque partie s'engage à respecter le code de déontologie des masseurs-kinésithérapeutes et toutes les dispositions légales et réglementaires applicables à la profession. Le secret professionnel est une obligation absolue pour les deux parties à l'égard des informations relatives aux patients.
          </Text>
        </View>

        {/* Art. 8 — Renégociation à 4 ans (réglementaire) */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 8 — Renégociation (clause réglementaire)</Text>
          <Text style={S.body}>
            Conformément aux dispositions réglementaires en vigueur, le présent contrat fera l'objet d'une renégociation obligatoire au bout de 4 ans. Les parties s'engagent à initier cette renégociation au moins 6 mois avant l'échéance.
          </Text>
        </View>

        {/* Art. 9 — Obligations fiscales et sociales */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 9 — Obligations fiscales et sociales</Text>
          <Text style={S.body}>
            Chaque partie est personnellement responsable de ses obligations fiscales et sociales. Le collaborateur gère de façon autonome ses déclarations URSSAF, TVA le cas échéant, et impôts sur le revenu.
          </Text>
        </View>

        {/* Art. 10 — Assurance et responsabilité */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 10 — Assurance et responsabilité (clause réglementaire)</Text>
          <Text style={S.body}>
            Chaque partie est tenue de souscrire et de maintenir en vigueur une assurance en responsabilité civile professionnelle couvrant l'intégralité de son activité. Chacune peut être amenée à en justifier à la demande de l'autre ou de l'Ordre.
          </Text>
        </View>

        {/* Art. 11 — Congés et absences */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 11 — Congés et absences</Text>
          <Text style={S.body}>
            Chaque partie organise ses congés et absences selon ses propres modalités, en veillant à informer l'autre partie avec un préavis raisonnable pour permettre l'organisation de la prise en charge des patients communs.
          </Text>
        </View>

        {/* Art. 12 — Continuité des soins */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 12 — Continuité des soins (clause réglementaire)</Text>
          <Text style={S.body}>
            Les parties s'engagent mutuellement à assurer la continuité des soins pour l'ensemble de leurs patients respectifs, en toutes circonstances, conformément à leurs obligations déontologiques.
          </Text>
        </View>

        {/* Art. 13 — Résiliation */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 13 — Résiliation et préavis</Text>
          <Text style={S.body}>
            Le présent contrat peut être résilié par l'une ou l'autre des parties, moyennant un préavis de 3 mois notifié par lettre recommandée avec avis de réception. En cas de faute grave, la résiliation peut être immédiate et sans indemnité.
          </Text>
        </View>

        {/* Art. 14 — Dossiers patients */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 14 — Dossiers patients</Text>
          <Text style={S.body}>
            Les dossiers de la clientèle personnelle du collaborateur lui appartiennent. Les dossiers des patients communs ou confiés par le titulaire demeurent la propriété du titulaire. En cas de cessation du contrat, un bilan contradictoire sera établi entre les parties.
          </Text>
        </View>

        {/* Art. 15 — Conciliation */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 15 — Conciliation (clause réglementaire)</Text>
          <Text style={S.body}>
            En cas de litige relatif à l'exécution du présent contrat, les parties s'engagent à saisir préalablement le conseil départemental de l'Ordre des masseurs-kinésithérapeutes compétent, conformément à l'article R.4321-99 al. 2 du code de la santé publique.
          </Text>
        </View>

        {/* Art. 16 — Contentieux */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 16 — Contentieux</Text>
          <Text style={S.body}>
            À défaut de conciliation, tout litige sera soumis aux tribunaux compétents du lieu d'exercice du titulaire.
          </Text>
        </View>

        {/* Art. 17 — Confidentialité */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 17 — Confidentialité</Text>
          <Text style={S.body}>
            Toutes les informations échangées dans le cadre du présent contrat, notamment celles relatives aux patients, aux honoraires et à l'organisation du cabinet, sont strictement confidentielles. Cette obligation survit à la cessation du contrat.
          </Text>
        </View>

        {/* Art. 18 — Cessation d'activité du titulaire */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 18 — Cessation d'activité du titulaire — priorité de succession</Text>
          <Text style={S.body}>
            En cas de cessation définitive d'activité du titulaire, le collaborateur bénéficiera d'une priorité de reprise du cabinet dans des conditions négociées de bonne foi entre les parties.
          </Text>
        </View>

        {/* Art. 19 — Association du titulaire */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 19 — Association du titulaire</Text>
          <Text style={S.body}>
            En cas de projet d'association du titulaire avec un tiers, le collaborateur se verra proposer en priorité d'intégrer cette association.
          </Text>
        </View>

        {/* Art. 20 — Clause de liberté d'établissement */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 20 — Clause de liberté d'établissement et non-concurrence</Text>
          <Text style={S.body}>
            Le collaborateur est en principe libre de s'établir à l'issue du contrat. Toutefois, si le collaborateur a développé une clientèle personnelle et que le titulaire procède au rachat de celle-ci conformément aux conditions définies ci-dessous, le collaborateur s'interdit alors de s'installer ou d'exercer dans un rayon de {rayonKm} km autour du cabinet pendant une durée de {dureeAns} an{dureeAns > 1 ? "s" : ""}.
          </Text>
          <Text style={[S.body, { marginTop: 3, fontFamily: "Helvetica-Oblique" }]}>
            Cette clause de non-concurrence n'est opposable qu'en cas de rachat effectif de la clientèle personnelle du collaborateur par le titulaire, conformément à la réglementation en vigueur (nuance fondamentale avec le contrat d'assistanat). Par dérogation, le collaborateur conserve le droit d'effectuer des remplacements temporaires dans cette zone.
          </Text>
        </View>

        {/* Art. 21 — Conditions de rachat de la clientèle */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 21 — Conditions de rachat de la clientèle</Text>
          <Text style={S.body}>
            En cas de cessation du contrat, les parties peuvent convenir du rachat de la clientèle personnelle développée par le collaborateur. Les conditions financières de ce rachat seront négociées en bonne foi. À défaut d'accord, la clause de non-concurrence de l'article 20 ne sera pas applicable.
          </Text>
        </View>

        {/* Art. 22 — Absence de contre-lettre */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 22 — Absence de contre-lettre</Text>
          <Text style={S.body}>
            Les parties déclarent qu'il n'existe aucune convention secrète, contre-lettre ou avenant non communiqué à l'Ordre susceptible de modifier les dispositions du présent contrat.
          </Text>
        </View>

        {/* Art. 23 — Communication à l'Ordre (réglementaire) */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 23 — Communication à l'Ordre (clause réglementaire)</Text>
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
            {signatureTitulaireImg ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- <Image> @react-pdf (PDF), pas une balise HTML img
              <Image style={S.sigImg} src={signatureTitulaireImg} />
            ) : (
              <Text style={[S.sigLabel, { marginTop: 20 }]}> </Text>
            )}
          </View>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>Le collaborateur</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>{collaborateur.name || "[Nom du collaborateur]"}</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>Date et signature :</Text>
            {signatureRemplacantImg ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- <Image> @react-pdf (PDF), pas une balise HTML img
              <Image style={S.sigImg} src={signatureRemplacantImg} />
            ) : (
              <Text style={[S.sigLabel, { marginTop: 20 }]}> </Text>
            )}
          </View>
        </View>

        {(signatureTitulaireImg || signatureRemplacantImg) && (
          <Text style={S.eidas}>{SIGNATURE_LEGAL_MENTION}</Text>
        )}

        {/* Pied de page */}
        <Text style={S.footer}>{LEGAL_MENTION}</Text>
        <Text style={S.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        <DraftWatermark draft={draft} />
      </Page>
    </Document>
  );
}
