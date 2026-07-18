/* eslint-disable react/no-unescaped-entities */
import React from "react";
import { Text, StyleSheet } from "@react-pdf/renderer";

// Filigrane « brouillon » (section 137). Placé en dernier enfant de la <Page> avec
// `fixed` : dessiné par-dessus le contenu (opacité faible) et répété sur chaque page.
const W = StyleSheet.create({
  watermark: {
    position: "absolute",
    top: "44%",
    left: -60,
    right: -60,
    textAlign: "center",
    color: "#d11a1a",
    opacity: 0.13,
    fontSize: 30,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    transform: "rotate(-45deg)",
  },
  banner: {
    marginTop: 5,
    textAlign: "center",
    color: "#c0271e",
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    letterSpacing: 1,
  },
});

// Bandeau d'en-tête (sous le titre) — visible et non ambigu.
export function DraftBanner({ draft }: { draft?: boolean }) {
  if (!draft) return null;
  return <Text style={W.banner}>— BROUILLON — DOCUMENT NON OFFICIEL — NE PAS SIGNER EN L'ÉTAT —</Text>;
}

// Filigrane diagonal répété sur toutes les pages.
export function DraftWatermark({ draft }: { draft?: boolean }) {
  if (!draft) return null;
  return (
    <Text style={W.watermark} fixed>
      BROUILLON — DOCUMENT NON OFFICIEL
    </Text>
  );
}
