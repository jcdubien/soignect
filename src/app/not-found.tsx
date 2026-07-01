import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-6xl">🌊</span>
      <h1 className="text-2xl font-black text-gray-900">Page introuvable</h1>
      <p className="text-gray-500 text-sm">Cette page n&apos;existe pas ou a été déplacée.</p>
      <Link
        href="/annonces"
        className="px-5 py-2.5 bg-kine-600 text-white text-sm font-semibold rounded-xl hover:bg-kine-700 transition"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
