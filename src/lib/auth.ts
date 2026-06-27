import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          include: { profile: true },
        });
        if (!user) return null;

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          profileId: user.profile?.id ?? null,
          profileType: user.profile?.type ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as { role: string; profileId: string | null; profileType: string | null };
        token.role = u.role;
        token.profileId = u.profileId;
        token.profileType = u.profileType;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      (session.user as { role: string }).role = token.role as string;
      (session.user as { profileId: string | null }).profileId = token.profileId as string | null;
      (session.user as { profileType: string | null }).profileType = token.profileType as string | null;
      return session;
    },
  },
});
