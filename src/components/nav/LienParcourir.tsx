"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saisieEnCours, surSaisieEnCours } from "@/lib/saisieEnCours";

// Lien « Parcourir » du header desktop (section 263).
//
// ── LE TROU QU'IL COMBLE ─────────────────────────────────────────────────────────────────────
//
// `/annonces` figurait dans la barre du bas MOBILE depuis toujours, et nulle part sur desktop.
// Depuis l'écran « Modifier l'annonce », la seule façon d'aller voir le fil était le logo (qui
// mène au Planning) ou l'URL à la main. Signalé le 24/09, capture à l'appui.
//
// ── POURQUOI « PARCOURIR » ET PAS « ANNONCES » ───────────────────────────────────────────────
//
// Le layout porte déjà cette règle, écrite pour le candidat : « Le bouton de CONSULTATION ne se
// distinguait de celui de CRÉATION que par un "s" ». Côté cabinet, « Annonces » aurait fait
// exactement ça face à « + Annonce ». On nomme donc le GESTE, pas la destination — et le mot vaut
// pour les deux camps, qui n'y voient pourtant pas la même chose : un cabinet y parcourt des
// candidats, un candidat des annonces.
//
// ── LA GARDE DE SAISIE ───────────────────────────────────────────────────────────────────────
//
// C'est la PREMIÈRE garde de navigation du produit — `beforeunload` n'existe nulle part, et ne
// servirait d'ailleurs à rien : les navigations de `next/link` sont côté client et ne le
// déclenchent pas.
//
// Elle ne protège que ce qui n'est pas déjà protégé. Le formulaire candidat enregistre un
// brouillon à chaque frappe (section 252) : rien n'y est perdu, et il ne lève donc pas le drapeau.
// Le formulaire cabinet en ÉDITION, lui, n'a pas de brouillon — par une décision de la 252 : un
// brouillon écraserait les vraies valeurs chargées depuis le serveur. C'est ce cas-là, et lui
// seul, que la confirmation couvre.
export default function LienParcourir({ className }: { className?: string }) {
  const router = useRouter();
  const [aSaisie, setASaisie] = useState(false);
  const [confirme, setConfirme] = useState(false);

  useEffect(() => {
    setASaisie(saisieEnCours());
    return surSaisieEnCours(setASaisie);
  }, []);

  return (
    <>
      <Link
        href="/annonces"
        title="Parcourir les annonces"
        className={className}
        onClick={(e) => {
          if (!aSaisie) return;
          e.preventDefault();
          setConfirme(true);
        }}
      >
        🔍 Parcourir
      </Link>

      {/* Même forme que les autres confirmations du produit (« Annuler le match », « Annuler
          cette mise en relation ») : surface assombrie, deux boutons, l'action de retour à
          gauche. Le texte nomme ce qui serait perdu — « vos modifications » — plutôt qu'un
          « êtes-vous sûr ? » qui ne dit rien. */}
      {confirme && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center px-4 bg-black/50"
          onClick={() => setConfirme(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 text-base mb-2">Quitter sans enregistrer ?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Vos modifications de cette annonce n&apos;ont pas été enregistrées. Elles seront
              perdues si vous partez maintenant.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirme(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition"
              >
                Rester sur l&apos;annonce
              </button>
              <button
                type="button"
                onClick={() => { setConfirme(false); router.push("/annonces"); }}
                className="flex-1 py-2.5 bg-kine-600 text-white rounded-xl text-sm font-bold hover:bg-kine-700 transition"
              >
                Partir quand même
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
