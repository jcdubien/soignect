import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import { ProfileType, TitulaireKind } from "@prisma/client";
import { sendWelcomeEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const createProfileSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  type: z.nativeEnum(ProfileType),
  // Nature du titulaire (Cabinet libéral vs Structure privée) posée dès l'inscription
  // pour l'entrée « Établissement ». Ignoré pour les remplaçants (défaut CABINET).
  titulaireKind: z.nativeEnum(TitulaireKind).optional(),
  name: z.string().max(100).optional(),
  bio: z.string().max(300).optional(),
  bioTinder: z.string().max(700).optional(),
  photoUrl: z.string().url().optional(),
  phone: z.string().max(20).optional(),
  phoneCountry: z.string().max(4).optional(),
  emailOptIn: z.boolean().optional(),
  acceptedTerms: z.boolean().optional(),
  // Invitation à rejoindre un poste (section 187) : rattachement automatique à l'inscription.
  inviteToken: z.string().max(200).optional(), // consentement légal (section 150)
});

// POST /api/profiles — inscription (profil simple, sans mission)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email: rawEmail, password, type, titulaireKind, name, bio, bioTinder, photoUrl, phone, phoneCountry, emailOptIn, acceptedTerms, inviteToken } = parsed.data;
  // Email normalisé à la source : la connexion, check-email et forgot-password comparent tous
  // en minuscules. Enregistrer une saisie capitalisée créait un compte que son propriétaire ne
  // pouvait plus retrouver — et un doublon possible face à un compte déjà existant.
  const email = rawEmail.toLowerCase().trim();
  // Ne persiste la nature que pour un titulaire ; sinon on laisse le défaut (CABINET).
  const kind = type === "TITULAIRE" ? titulaireKind : undefined;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Email déjà utilisé" }, { status: 409 });
  }

  const passwordHash = await hash(password, 12);
  const optIn = emailOptIn ?? true;

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      phone: phone ?? null,
      phoneCountry: phoneCountry ?? "GP",
      emailOptIn: optIn,
      acceptedTermsAt: acceptedTerms ? new Date() : null,
      profile: {
        create: { type, name, bio, bioTinder, photoUrl, ...(kind ? { titulaireKind: kind } : {}) },
      },
    },
    include: { profile: true },
  });

  // Rattachement au poste invité (section 187). Aucune restriction de type : un co-titulaire
  // est traité comme un assistant — même compte déporté, même invitation, mêmes droits sur son
  // poste. La séparation de leurs spécificités viendra plus tard.
  // Silencieux en cas d'échec : un token périmé ou un poste déjà pris ne doit pas faire échouer
  // une inscription par ailleurs valide.
  if (inviteToken) {
    try {
      const inv = await prisma.posteInvitation.findUnique({ where: { token: inviteToken } });
      if (
        inv && inv.status === "PENDING" && inv.expiresAt > new Date() &&
        inv.invitedEmail.toLowerCase() === email
      ) {
        const post = await prisma.cabinetPost.findUnique({
          where: { id: inv.cabinetPostId },
          select: { id: true, linkedUserId: true, isOwnerSeat: true },
        });
        // Jamais le siège du détenteur : c'est SA ligne, elle ne se délègue pas.
        if (post && !post.linkedUserId && !post.isOwnerSeat) {
          await prisma.$transaction([
            prisma.cabinetPost.update({ where: { id: post.id }, data: { linkedUserId: user.id } }),
            prisma.posteInvitation.update({ where: { id: inv.id }, data: { status: "USED" } }),
          ]);
        }
      }
    } catch (e) {
      console.error("[register] rattachement invitation impossible:", e);
    }
  }

  // Email de bienvenue (fire-and-forget, respecte emailOptIn)
  const firstName = (name ?? "").trim().split(" ")[0] || "à vous";
  const cibleLabel = type === "TITULAIRE" ? "remplaçants" : "cabinets";
  await sendWelcomeEmail(email, { firstName, cibleLabel, optIn });

  return NextResponse.json(
    { id: user.id, email: user.email, profile: user.profile },
    { status: 201 }
  );
}
