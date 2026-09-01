import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: string;
      profileId: string | null;
      profileType: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    profileId?: string | null;
    profileType?: string | null;
    isEmployeur?: boolean;
    /** Date (ms) de la dernière confrontation du jeton à la base — voir lib/auth.ts. */
    verifiedAt?: number;
  }
}
