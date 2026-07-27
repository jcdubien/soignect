import { Prisma } from "@prisma/client";

// Reconnexion transitoire (serverless Vercel + pooler Supabase, section 186).
// Une connexion poolée peut être fermée par pgBouncer/Supabase entre deux invocations d'une
// Lambda chaude (idle) → la requête suivante échoue en P1017 « Server has closed the connection ».
// Prisma rétablit la connexion à l'essai suivant : un simple retry court absorbe le cas.
// Codes transitoires : P1017 (server closed), P1001 (serveur injoignable), P1008 (timeout).
const TRANSIENT_CODES = new Set(["P1017", "P1001", "P1008"]);

export async function withDbRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const transient =
      e instanceof Prisma.PrismaClientKnownRequestError && TRANSIENT_CODES.has(e.code);
    if (retries > 0 && transient) {
      await new Promise((r) => setTimeout(r, 120));
      return withDbRetry(fn, retries - 1);
    }
    throw e;
  }
}
