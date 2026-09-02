import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

/** Fenêtre au-delà de laquelle le jeton est reconfronté à la base. Voir le callback `jwt`. */
const INTERVALLE_REVALIDATION_MS = 5 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Recherche insensible à la casse et aux espaces parasites. La saisie brute échouait
        // silencieusement (« identifiants invalides » avec le bon mot de passe) dès qu'un
        // gestionnaire de mots de passe, un copier-coller ou un clavier mobile ajoutait une
        // majuscule ou une espace — alors que forgot-password et check-email normalisent déjà.
        const raw = parsed.data.email.trim();
        const normalized = raw.toLowerCase();
        const user =
          (await prisma.user.findUnique({ where: { email: normalized }, include: { profile: true } })) ??
          // Repli pour un compte historique enregistré avec des majuscules (aucun aujourd'hui,
          // mais la recherche ne doit pas régresser pour lui).
          (raw !== normalized
            ? await prisma.user.findUnique({ where: { email: raw }, include: { profile: true } })
            : null);
        if (!user) return null;

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          profileId: user.profile?.id ?? null,
          profileType: user.profile?.type ?? null,
          // Une Structure privée (EHPAD/clinique/SSR) est un employeur : on dérive le
          // flag legacy isEmployeur de titulaireKind pour que le parcours salarié
          // (libellés « établissement », placeholders « Vacation/CDD/CDI ») s'applique.
          isEmployeur: (user.profile?.isEmployeur ?? false) || user.profile?.titulaireKind === "STRUCTURE",
        };
      },
    }),
  ],
  callbacks: {
    // ── Revalidation du jeton (section 219, 01/09) ────────────────────────────────────────────
    //
    // CE QUI SE PASSAIT. Le jeton n'était écrit qu'au sign-in et n'était plus jamais relu. Une
    // session survivait donc à la suppression du compte qu'elle désigne : constaté le 01/09 avec
    // un cookie visant un compte absent de la base, encore valide un mois plus tard. L'application
    // se comportait comme si quelqu'un était connecté — page à 200, barre de navigation affichée —
    // et seul /api/feed trahissait le problème par un « 404 Profil introuvable ». Un état ni
    // connecté ni déconnecté, que l'utilisateur ne peut ni comprendre ni corriger.
    //
    // Renvoyer `null` ici fait purger le cookie par Auth.js (actions/session.js : `token !== null`
    // sinon `sessionStore.clean()`), et `auth()` rend une session vide côté serveur — donc la
    // redirection habituelle vers /login.
    //
    // POURQUOI PAS À CHAQUE REQUÊTE. Ce callback s'exécute à chaque appel d'`auth()`, c'est-à-dire
    // à chaque requête : une lecture systématique ajouterait un aller-retour base partout, sur une
    // instance dont la limite de connexions est déjà un sujet connu (P1017). On revalide donc au
    // plus une fois par tranche de 5 minutes, ce qui borne la survie d'une session orpheline sans
    // rien coûter au régime courant.
    //
    // CE QUE L'INTERVALLE NE BORNE PAS. `verifiedAt` ne progresse que si le cookie est réécrit —
    // ce que fait la route /api/auth/session, mais PAS un rendu de composant serveur, où Next
    // interdit d'écrire un cookie. Une navigation qui n'irait que sur des pages rendues côté
    // serveur relit donc la base à chaque rendu : une lecture par clé primaire, indexée, que l'on
    // accepte — c'est le prix de la garantie, et il reste très inférieur à celui d'une session
    // orpheline qui survit un mois.
    //
    // FORÇAGE PAR `trigger === "update"` (section 222). Le type de profil pilote des redirections
    // de route lues DANS LE JETON (/planning, /disponibilites). Sans ce forçage, un changement de
    // camp n'aurait pris effet qu'à la fin de la fenêtre de 5 minutes : l'utilisateur aurait été
    // renvoyé vers l'écran de son ancien camp juste après avoir basculé, sans rien y comprendre.
    // Le client appelle `update()` après le changement ; on relit alors immédiatement.
    async jwt({ token, user, trigger }) {
      if (user) {
        const u = user as { role: string; profileId: string | null; profileType: string | null; isEmployeur: boolean };
        token.role = u.role;
        token.profileId = u.profileId;
        token.profileType = u.profileType;
        token.isEmployeur = u.isEmployeur;
        token.verifiedAt = Date.now();
        return token;
      }

      const verifiedAt = typeof token.verifiedAt === "number" ? token.verifiedAt : 0;
      if (trigger !== "update" && Date.now() - verifiedAt < INTERVALLE_REVALIDATION_MS) return token;

      try {
        const compte = await prisma.user.findUnique({
          where: { id: token.sub! },
          select: {
            role: true,
            profile: { select: { id: true, type: true, isEmployeur: true, titulaireKind: true } },
          },
        });

        // Compte supprimé — la suppression retire toujours le User, le Profile suivant en cascade
        // (schema.prisma : onDelete: Cascade). C'est donc l'existence du compte qui fait foi.
        if (!compte) return null;

        // Les mêmes dérivations qu'au sign-in, relues à la source. Un jeton figé affirmait aussi
        // un rôle et un type de profil que la base pouvait avoir démentis depuis.
        token.role = compte.role;
        token.profileId = compte.profile?.id ?? null;
        token.profileType = compte.profile?.type ?? null;
        token.isEmployeur =
          (compte.profile?.isEmployeur ?? false) || compte.profile?.titulaireKind === "STRUCTURE";
        token.verifiedAt = Date.now();
      } catch {
        // PANNE BASE ≠ COMPTE SUPPRIMÉ. Une erreur de connexion ne prouve rien sur l'existence du
        // compte ; déconnecter ici transformerait une coupure passagère en déconnexion générale.
        // On garde le jeton tel quel SANS toucher à `verifiedAt`, donc on retentera à la requête
        // suivante plutôt que d'attendre la prochaine fenêtre.
        return token;
      }

      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      (session.user as { role: string }).role = token.role as string;
      (session.user as { profileId: string | null }).profileId = token.profileId as string | null;
      (session.user as { profileType: string | null }).profileType = token.profileType as string | null;
      (session.user as unknown as { isEmployeur: boolean }).isEmployeur = (token.isEmployeur as boolean) ?? false;
      return session;
    },
  },
});
