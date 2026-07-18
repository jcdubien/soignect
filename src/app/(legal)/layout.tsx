import Link from "next/link";
import Image from "next/image";
import { LEGAL_LINKS } from "@/lib/legal-links";

// Layout public des pages légales (section 150) — hors authentification (groupe de routes
// distinct de (app)). En-tête minimal + pied de page avec renvois croisés.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-1.5 w-fit">
          <Image src="/GeminiLogo.png" alt="" width={26} height={26} className="rounded shrink-0" />
          <span className="text-lg font-black text-gray-800 tracking-tight">Soignect</span>
        </Link>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8">{children}</main>

      <footer className="border-t border-gray-100 bg-white px-4 py-5">
        <div className="max-w-2xl mx-auto flex flex-wrap gap-x-4 gap-y-1 justify-center text-xs text-gray-400">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-kine-600 transition">{l.label}</Link>
          ))}
          <Link href="/" className="hover:text-kine-600 transition">Accueil</Link>
        </div>
      </footer>
    </div>
  );
}
