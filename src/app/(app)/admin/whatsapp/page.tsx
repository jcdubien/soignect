import { exigerAdmin } from "@/lib/exigerAdmin";
import { packWhatsappDeLaSemaine, PACK_JOURS, LIBELLES_MOTIF } from "@/lib/packWhatsapp";
import PackClient from "./PackClient";

export const dynamic = "force-dynamic";

// Pack WhatsApp de la semaine (23/10) — voir lib/packWhatsapp. Aucun numéro dans cette page.
export default async function AdminWhatsappPage() {
  await exigerAdmin();
  const lignes = await packWhatsappDeLaSemaine();
  return <PackClient lignes={lignes} jours={PACK_JOURS} libelles={LIBELLES_MOTIF} />;
}
