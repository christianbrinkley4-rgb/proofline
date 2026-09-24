"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deleteAccount } from "@/lib/account/data";
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

/** Permanent. The person types their email to confirm; everything tied to the account goes with it. */
export async function deleteAccountAction(confirmEmail: string): Promise<{ ok: false; error: string } | never> {
  const session = await requireSession();
  if (confirmEmail.trim().toLowerCase() !== session.user.email.toLowerCase()) {
    return { ok: false, error: "Type your account email exactly to confirm." };
  }
  await deleteAccount(session.user.id);
  // The sessions are gone with the account; clear the now-dead cookies too.
  const jar = await cookies();
  for (const c of jar.getAll()) if (c.name.includes("better-auth")) jar.delete(c.name);
  redirect("/?deleted=1");
}

export async function revokeTokenAction(id: string) {
  const session = await requireSession();
  await revokeToken(session.user.id, z.uuid().parse(id));
  revalidatePath("/app/settings");
}
