import Link from "next/link";
import { LEGAL_LINKS } from "@/lib/legal-links";

// Liens vers les documents légaux (section 150) — pour les écrans publics (auth).
// Ouverts dans un nouvel onglet pour ne pas interrompre une saisie en cours.
export default function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 justify-center text-[11px] ${className}`}>
      {LEGAL_LINKS.map((l) => (
        <Link key={l.href} href={l.href} target="_blank" className="underline hover:opacity-80 transition">
          {l.label}
        </Link>
      ))}
    </div>
  );
}
