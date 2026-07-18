/* eslint-disable react/no-unescaped-entities */
import React from "react";
import { Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ContractParty } from "./types";

// Lignes d'identité d'une partie dans le PDF de contrat (section 150) — valeurs réelles
// injectées depuis le Profile (RPPS + N° Ordre pour praticiens, SIRET pour structures,
// adresse pour tous). Repli sur un placeholder « à compléter » si la donnée manque
// (utile en phase d'avertissement non bloquant). Styles alignés sur les templates.
const P = StyleSheet.create({
  row: { flexDirection: "row", marginBottom: 2 },
  label: { fontFamily: "Helvetica-Bold", width: 140 },
  val: { flex: 1 },
  placeholder: { color: "#b45309", fontFamily: "Helvetica-Bold" },
});

function Value({ v, fallback }: { v?: string | null; fallback: string }) {
  return v && v.trim().length > 0
    ? <Text style={P.val}>{v}</Text>
    : <Text style={[P.val, P.placeholder]}>{fallback}</Text>;
}

export function PartyIdentityRows({ party }: { party: ContractParty }) {
  return (
    <>
      {party.isStructure ? (
        <View style={P.row}>
          <Text style={P.label}>N° SIRET :</Text>
          <Value v={party.siret} fallback="[N° SIRET à compléter]" />
        </View>
      ) : (
        <>
          <View style={P.row}>
            <Text style={P.label}>N° RPPS :</Text>
            <Value v={party.rpps} fallback="[N° RPPS à compléter]" />
          </View>
          <View style={P.row}>
            <Text style={P.label}>N° Ordre :</Text>
            <Value v={party.numeroOrdre} fallback="[N° Ordre à compléter]" />
          </View>
        </>
      )}
      <View style={P.row}>
        <Text style={P.label}>Adresse professionnelle :</Text>
        {party.adresse && party.adresse.trim().length > 0
          ? <Text style={P.val}>{party.adresse}</Text>
          : <Text style={[P.val, P.placeholder]}>{party.location} — [adresse complète à compléter]</Text>}
      </View>
    </>
  );
}
