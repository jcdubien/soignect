/* eslint-disable react/no-unescaped-entities */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { type ContractDataRemplacement, SIGNATURE_LEGAL_MENTION, paymentMethodPhrase, localModalities } from "./types";
import { DraftBanner, DraftWatermark } from "./watermark";
import { PartyIdentityRows } from "./party-identity";

// Utilise Helvetica intégrée à pdf-lib — pas de chargement de police externe nécessaire
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

export function buildRemplacementPdf(data: ContractDataRemplacement) {
  const { remplace, remplacant, startDate, endDate, retrocessionPct, rayonKm, periodeEssai, generatedAt,
    modePaiement, delaiPaiementJours, modalitesLocaux,
    signatureTitulaireImg, signatureRemplacantImg, draft } = data;

  return (
    <Document title="Contrat de remplacement" author="Soignect">
      <Page size="A4" style={S.page}>

        {/* En-tête */}
        <View style={S.header}>
          <Text style={S.title}>Contrat de remplacement libéral</Text>
          <Text style={S.subtitle}>Masseurs-kinésithérapeutes — modèle CNOMK (28/03/2023)</Text>
          <Text style={S.version}>Généré le {fmtDate(generatedAt)}</Text>
          <DraftBanner draft={draft} />
        </View>

        {/* Parties */}
        <View style={S.sectionTitle}><Text>Entre les soussignés</Text></View>

        <View style={S.infoBox}>
          <Text style={[S.articleTitle, { marginBottom: 4 }]}>Le remplacé :</Text>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{remplace.name || "[Nom du titulaire]"}</Text></View>
          <PartyIdentityRows party={remplace} />
          <View style={S.infoRow}><Text style={S.infoLabel}>Profession :</Text><Text style={S.infoVal}>{remplace.profession}</Text></View>
        </View>

        <View style={S.infoBox}>
          <Text style={[S.articleTitle, { marginBottom: 4 }]}>Le remplaçant :</Text>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{remplacant.name || "[Nom du remplaçant]"}</Text></View>
          <PartyIdentityRows party={remplacant} />
          <View style={S.infoRow}><Text style={S.infoLabel}>Profession :</Text><Text style={S.infoVal}>{remplacant.profession}</Text></View>
        </View>

        <Text style={S.body}>Il a été convenu et arrêté ce qui suit :</Text>

        {/* Art. 1 — Objet */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 1 — Objet</Text>
          <Text style={S.body}>
            {remplace.name || "Le remplacé"} confie à {remplacant.name || "le remplaçant"} le soin de le remplacer dans son cabinet de {remplace.location} pendant son absence. Le présent contrat a un caractère temporaire et ne peut en aucun cas être assimilé à un contrat de travail. Le remplaçant exercera en toute indépendance professionnelle.
          </Text>
        </View>

        {/* Art. 2 — Durée */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 2 — Durée</Text>
          <Text style={S.body}>
            Le remplacement débutera le {fmtDate(startDate)} et prendra fin le {fmtDate(endDate)}.
          </Text>
          {periodeEssai && (
            <Text style={[S.body, { marginTop: 3, fontFamily: "Helvetica-Oblique" }]}>
              Une période d'essai de 3 mois est prévue. Durant cette période, chaque partie peut mettre fin au contrat avec un préavis de 15 jours.
            </Text>
          )}
        </View>

        {/* Art. 3 — Règles professionnelles (réglementaire) */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 3 — Respect des règles professionnelles (clause réglementaire)</Text>
          <Text style={S.body}>
            Le remplaçant est tenu de respecter les dispositions du code de la santé publique et notamment celles du code de déontologie des masseurs-kinésithérapeutes (articles R.4321-1 et suivants), ainsi que les règles professionnelles et les décisions de l'Ordre des masseurs-kinésithérapeutes.
          </Text>
        </View>

        {/* Art. 4 — Mise à disposition */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 4 — Mise à disposition des locaux et installations</Text>
          <Text style={S.body}>
            Le remplacé met à la disposition du remplaçant ses locaux professionnels, son matériel et ses installations pour la durée du remplacement. Le remplaçant s'engage à utiliser ces équipements avec soin et à les restituer en bon état à la fin du contrat. Les charges liées à l'utilisation des locaux (loyer, charges, fournitures) sont prises en charge selon les modalités suivantes : {localModalities(modalitesLocaux)}.
          </Text>
        </View>

        {/* Art. 5 — Indépendance / responsabilité / assurance (réglementaire) */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 5 — Indépendance, responsabilité et assurance (clause réglementaire)</Text>
          <Text style={S.body}>
            Le remplaçant exerce en toute indépendance professionnelle. Il est personnellement responsable des actes professionnels qu'il accomplit. Il doit être titulaire d'une assurance en responsabilité civile professionnelle couvrant l'intégralité de son activité de remplacement. Il devra en justifier auprès du remplacé avant le début du remplacement.
          </Text>
        </View>

        {/* Art. 6 — Rétrocession */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 6 — Rétrocession</Text>
          <Text style={S.body}>
            En rémunération de ses services, le remplaçant percevra {retrocessionPct}% des honoraires qu'il aura encaissés pendant la durée du remplacement. Le versement s'effectuera par {paymentMethodPhrase(modePaiement)} dans un délai de {delaiPaiementJours} jour{delaiPaiementJours > 1 ? "s" : ""} suivant la fin de chaque période de remplacement.
          </Text>
        </View>

        {/* Art. 7 — Obligations fiscales et sociales */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 7 — Obligations fiscales et sociales</Text>
          <Text style={S.body}>
            Le remplaçant est personnellement responsable de ses obligations fiscales et sociales découlant de son activité libérale. Il s'engage à s'acquitter de ses cotisations URSSAF, de ses impôts sur le revenu et de toutes autres obligations légales afférentes à son statut de professionnel libéral indépendant.
          </Text>
        </View>

        {/* Art. 8 — Fin du contrat (réglementaire) */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 8 — Fin du contrat (clause réglementaire)</Text>
          <Text style={S.body}>
            À l'expiration du présent contrat, le remplaçant s'abstiendra d'entrer directement en relation avec la clientèle du remplacé sans l'accord de celui-ci, conformément aux dispositions du code de déontologie. Les dossiers des patients demeurent la propriété du remplacé.
          </Text>
        </View>

        {/* Art. 9 — Clause de non-installation (réglementaire) */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 9 — Clause de non-installation (clause réglementaire — art. R.4321-130)</Text>
          <Text style={S.body}>
            En application de l'article R.4321-130 du code de la santé publique, si le remplacement a duré au moins 3 mois consécutifs ou non, le remplaçant s'interdit de s'installer dans un rayon de {rayonKm} km autour du cabinet du remplacé pendant une durée de 2 ans à compter de la fin du dernier remplacement.
          </Text>
          <Text style={[S.body, { marginTop: 3, fontFamily: "Helvetica-Oblique" }]}>
            Cette durée de 2 ans est fixée par la loi et ne peut être modifiée par les parties. Le rayon de {rayonKm} km a été convenu entre les parties.
          </Text>
        </View>

        {/* Art. 10 — Conciliation (réglementaire) */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 10 — Conciliation (clause réglementaire — art. R.4321-99)</Text>
          <Text style={S.body}>
            En cas de litige entre les parties relatif à l'exécution du présent contrat, celles-ci s'engagent à soumettre leur différend au conseil départemental de l'Ordre des masseurs-kinésithérapeutes compétent, conformément à l'article R.4321-99 alinéa 2 du code de la santé publique.
          </Text>
        </View>

        {/* Art. 11 — Contentieux */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 11 — Contentieux</Text>
          <Text style={S.body}>
            À défaut de conciliation, tout litige relatif à l'interprétation ou à l'exécution du présent contrat sera soumis aux tribunaux compétents du lieu d'exercice du remplacé, sauf disposition légale contraire.
          </Text>
        </View>

        {/* Art. 12 — Absence de contre-lettre */}
        <View style={S.article}>
          <Text style={S.articleTitle}>Article 12 — Absence de contre-lettre</Text>
          <Text style={S.body}>
            Les parties déclarent qu'il n'existe aucune convention secrète, contre-lettre ou avenant non communiqué à l'Ordre susceptible de modifier ou d'annuler les dispositions du présent contrat.
          </Text>
        </View>

        {/* Art. 13 — Communication à l'Ordre (réglementaire) */}
        <View style={[S.article, S.mandatory]}>
          <Text style={S.articleTitle}>Article 13 — Communication à l'Ordre (clause réglementaire)</Text>
          <Text style={S.body}>
            Le présent contrat sera communiqué au conseil départemental de l'Ordre des masseurs-kinésithérapeutes du lieu d'exercice du remplacé dans un délai d'un mois suivant sa signature, conformément aux obligations réglementaires applicables aux professionnels de santé.
          </Text>
        </View>

        {/* Signatures */}
        <View style={S.sigBlock}>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>Le remplacé</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>{remplace.name || "[Nom du remplacé]"}</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>Date et signature :</Text>
            {signatureTitulaireImg ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- <Image> @react-pdf (PDF), pas une balise HTML img
              <Image style={S.sigImg} src={signatureTitulaireImg} />
            ) : (
              <Text style={[S.sigLabel, { marginTop: 20 }]}> </Text>
            )}
          </View>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>Le remplaçant</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>{remplacant.name || "[Nom du remplaçant]"}</Text>
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
