"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { VENTE_EN_LIGNE_OUVERTE, souscriptionEnLigneOuverte, TARIF_STRUCTURE } from "@/lib/tarifsPartenaire";
import { mentionGratuite, GRATUIT_POUR_PRATICIEN } from "@/lib/gratuite";

export const dynamic = "force-dynamic";

// Offre (27/10) — « gratuit praticiens, payant institutions » (lib/gratuite). Les plans Premium
// (9 €) et Boost (29 €) proposés aux cabinets ont disparu : un praticien n'a rien à souscrire.
// Seul l'abonnement Structure (établissements) subsiste, fermé tant que la vente l'est.
// L'URL /premium est gardée : liens et emails existants y pointent.
export default function PremiumPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [kind, setKind] = useState<string | null>(null);
  const [freeAccessMode, setFreeAccessMode] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    const pid = (session?.user as { profileId?: string })?.profileId;
    if (!pid) return;
    fetch(`/api/profiles/${pid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => setKind(p?.titulaireKind ?? "CABINET"))
      .catch(() => setKind("CABINET"));
  }, [session]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/platform")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setFreeAccessMode(Boolean(d?.freeAccessMode)))
      .catch(() => setFreeAccessMode(false));
  }, [status]);

  useEffect(() => {
    // Ne rediriger que lorsque le profileType est connu ET différent de TITULAIRE.
    const pt = session?.user?.profileType;
    if (status === "authenticated" && pt && pt !== "TITULAIRE") router.replace("/annonces");
  }, [status, session, router]);

  async function souscrireStructure() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "STRUCTURE" }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.url) { window.location.href = d.url; return; }
      setError(res.status === 503
        ? "Le paiement en ligne n'est pas encore activé. Écrivez-nous et nous activerons votre accès."
        : typeof d.error === "string" ? d.error : "Impossible de démarrer le paiement. Réessayez dans un instant.");
    } catch {
      setError("Problème de connexion. Vérifiez votre réseau et réessayez.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading" || kind === null || freeAccessMode === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-kine-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isStructure = kind === "STRUCTURE";

  if (!isStructure) {
    return (
      <div className="max-w-xl mx-auto w-full px-4 py-10">
        <h1 className="text-2xl font-black text-gray-900 text-center">Soignect est gratuit pour les praticiens</h1>
        <p className="text-gray-500 text-center mt-2">Aucun abonnement, rien à souscrire.</p>
        <ul className="mt-6 rounded-3xl border-2 border-kine-200 bg-white p-6 flex flex-col gap-2 list-none">
          {GRATUIT_POUR_PRATICIEN.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-emerald-500 shrink-0">✓</span>{f}
            </li>
          ))}
        </ul>
        <p className="text-sm text-gray-500 text-center mt-6">
          Vous représentez une CPTS, une maison de santé ou un établissement ?{" "}
          <Link href="/partenaire" className="font-semibold text-kine-700 underline">Voir l&apos;offre partenaire</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-10">
      <h1 className="text-3xl font-black text-gray-900 text-center mb-2">Offre établissement</h1>
      <p className="text-gray-500 text-center max-w-lg mx-auto mb-8">
        {VENTE_EN_LIGNE_OUVERTE
          ? "Recrutez des soignants pour votre EHPAD, clinique ou SSR — nettement moins cher qu'une agence d'intérim."
          : "Recrutez des soignants pour votre EHPAD, clinique ou SSR."}
      </p>
      {error && (
        <div role="alert" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
      )}
      {!souscriptionEnLigneOuverte(freeAccessMode) ? (
        <div className="rounded-3xl border-2 border-[#0B3D5C]/25 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-gray-900">{mentionGratuite(freeAccessMode)}</p>
          <p className="text-sm text-gray-500 mt-2">L’abonnement établissement n&apos;est pas ouvert à la souscription en ligne pour le moment.</p>
        </div>
      ) : (
        <div className="rounded-3xl border-2 border-[#0B3D5C]/25 bg-white p-6">
          <h2 className="text-lg font-bold text-gray-900">Structures privées (EHPAD, cliniques, SSR)</h2>
          <div className="flex items-baseline gap-1 mt-1 flex-wrap">
            <span className="text-3xl font-black text-gray-900">{TARIF_STRUCTURE.mensuelEuros}€</span>
            <span className="text-gray-400 text-sm">/mois</span>
            <span className="text-gray-500 text-sm ml-2">+ {TARIF_STRUCTURE.parContratEuros}€ / contrat signé</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Le montant à l&apos;usage ({TARIF_STRUCTURE.parContratEuros}€) est facturé automatiquement à chaque contrat signé.
          </p>
          <button
            type="button"
            onClick={souscrireStructure}
            disabled={loading}
            className="mt-5 w-full py-3 bg-[#0B3D5C] text-white rounded-2xl font-bold text-sm hover:opacity-90 transition disabled:opacity-40"
          >
            {loading ? "Redirection…" : "S'abonner →"}
          </button>
          <p className="text-center text-xs text-gray-400 mt-4">Paiement sécurisé par Stripe · Résiliation à tout moment · Sans engagement</p>
        </div>
      )}
    </div>
  );
}
