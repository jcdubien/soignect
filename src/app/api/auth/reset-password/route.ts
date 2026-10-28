import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import { estCompteConfrereEnAttente, MESSAGE_COMPTE_EN_ATTENTE } from "@/lib/compteEnAttente";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(6, "Le mot de passe doit faire au moins 6 caractères"),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { token, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 400 });
  }

  // Le lien d'activation d'un confrère porte le même jeton (section 373) : ici, il poserait un
  // mot de passe sans acceptation des conditions. L'activation se fait par /activer/<jeton>.
  if (await estCompteConfrereEnAttente(user.id)) {
    return NextResponse.json({ error: MESSAGE_COMPTE_EN_ATTENTE }, { status: 400 });
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null },
  });

  return NextResponse.json({ ok: true });
}
