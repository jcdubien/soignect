import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

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
    jwt({ token, user }) {
      if (user) {
        const u = user as { role: string; profileId: string | null; profileType: string | null; isEmployeur: boolean };
        token.role = u.role;
        token.profileId = u.profileId;
        token.profileType = u.profileType;
        token.isEmployeur = u.isEmployeur;
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
