import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import { ProfileType } from "@prisma/client";
import { sendWelcomeEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const createProfileSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  type: z.nativeEnum(ProfileType),
  name: z.string().max(100).optional(),
  bio: z.string().max(300).optional(),
  bioTinder: z.string().max(280).optional(),
  photoUrl: z.string().url().optional(),
  phone: z.string().max(20).optional(),
  phoneCountry: z.string().max(4).optional(),
  emailOptIn: z.boolean().optional(),
});

// POST /api/profiles — inscription (profil simple, sans mission)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, type, name, bio, bioTinder, photoUrl, phone, phoneCountry, emailOptIn } = parsed.data;

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
      profile: {
        create: { type, name, bio, bioTinder, photoUrl },
      },
    },
    include: { profile: true },
  });

  // Email de bienvenue (fire-and-forget, respecte emailOptIn)
  const firstName = (name ?? "").trim().split(" ")[0] || "à vous";
  const cibleLabel = type === "TITULAIRE" ? "remplaçants" : "cabinets";
  await sendWelcomeEmail(email, { firstName, cibleLabel, optIn });

  return NextResponse.json(
    { id: user.id, email: user.email, profile: user.profile },
    { status: 201 }
  );
}
