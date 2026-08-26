import type { Metadata } from "next";
import { appBaseUrl } from "@/lib/appUrl";
import { KINESITHERAPEUTE } from "@/lib/pagesDiffusion";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

const inter = Inter({ subsets: ["latin"] });

// metadataBase : sans lui, Next ne peut pas transformer une URL relative en absolue, et
// og:url reste vide. Il vient de lib/appUrl, source unique de l'URL publique — pas d'une
// constante en dur qui deviendrait fausse le jour du passage a soignect.fr.
//
// og:url manquait sur TOUTES les pages, constate dans le debogueur Facebook. Sans lui,
// Facebook traite « /page », « /page?fbclid=… » et « /page?v=2 » comme trois pages
// distinctes : les compteurs de partage se dispersent entre elles.
export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl()),
  title: "Soignect — La mise en relation intelligente des professionnels de santé",
  // La profession vient du REGISTRE, plus d'une chaîne en dur (25/08). Le texte rendu est
  // identique — le produit ne sert qu'une profession et le dire ici est exact, pas une
  // approximation à corriger. Ce qui change : le jour où une seconde s'ouvre, cette
  // méta-description suit le registre au lieu d'être un oubli de plus à retrouver.
  description: `Trouvez votre remplaçant ou votre cabinet en Guadeloupe. Soignect — la plateforme de mise en relation des ${KINESITHERAPEUTE.pluriel}.`,
  openGraph: {
    type: "website",
    siteName: "Soignect",
    url: "/",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
