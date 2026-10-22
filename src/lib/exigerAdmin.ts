import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Garde des pages /admin, à appeler en PREMIÈRE ligne de chaque page serveur, avant toute
 * lecture en base (22/10).
 *
 * Le contrôle du layout /admin ne suffit pas : Next rend le layout et la page EN PARALLÈLE, et
 * le flux de la page part dans la réponse même quand le layout redirige. Constaté en
 * production : sans session, /admin/users renvoyait une 307 dont le corps contenait déjà la
 * liste des comptes. Le layout garde son contrôle ; chaque page porte désormais le sien.
 */
export async function exigerAdmin(): Promise<void> {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") redirect("/annonces");
}
