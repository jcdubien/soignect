"use client";

import BottomSheet from "@/components/ui/md3/BottomSheet";
import ShareActions from "@/components/share/ShareActions";

// Modale de partage à la publication (section 231).
//
// POURQUOI CE MOMENT. C'est celui où l'on est le plus disposé à diffuser ce qu'on vient d'écrire.
// Le partage existait déjà ici, mais replié dans le bandeau de confirmation, sous une ligne de
// texte — il fallait le remarquer. La modale le met devant, une fois, puis s'efface.
//
// PAS DE SECOND COMPOSANT DE PARTAGE. Le corps est `ShareActions`, celui de la page publique, avec
// `plateformes` activé. Une seconde implémentation aurait divergé de la première au premier
// changement — c'est exactement ce qui est arrivé cette semaine à `fmtDateUTC`, dupliqué sept fois.
//
// ELLE NE BLOQUE RIEN. On peut la fermer, et le bandeau de confirmation reste dessous avec le lien
// d'édition : ce qui a été publié ne dépend pas du fait de l'avoir partagé.
export default function PartageApresPublication({
  ouvert,
  onClose,
  missionId,
  titre,
  motPublie,
}: {
  ouvert: boolean;
  onClose: () => void;
  missionId: string;
  titre: string;
  /** « annonce » pour un cabinet, « recherche » pour un candidat — le vocabulaire suit l'auteur. */
  motPublie: string;
}) {
  if (!ouvert) return null;

  return (
    <BottomSheet open onClose={onClose} zClass="z-[80]">
      <div className="px-5 py-4">
        <p className="text-base font-black text-gray-900 leading-tight">
          Votre {motPublie} est en ligne
        </p>
        <p className="text-xs text-gray-500 mt-1 leading-snug">
          Partagez-la maintenant : c&apos;est ce qui lui amènera le plus de vues les premiers jours.
        </p>

        {titre && (
          <p className="mt-3 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
            {titre}
          </p>
        )}

        <div className="mt-4">
          <ShareActions path={`/annonce/${missionId}`} title={titre || "Soignect"} plateformes />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
        >
          Plus tard
        </button>
      </div>
    </BottomSheet>
  );
}
