"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createToken, revokeToken, TokenNameSchema } from "@/lib/agent/tokens";

export async function createTokenAction(name: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const session = await requireSession();
  const parsed = TokenNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Name the connection." };
  try {
    const { token } = await createToken(session.user.id, parsed.data);
    revalidatePath("/app/settings");
    return { ok: true, token };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't create the connection." };
  }
}

export async function revokeTokenAction(id: string) {
  const session = await requireSession();
  await revokeToken(session.user.id, z.uuid().parse(id));
  revalidatePath("/app/settings");
}
