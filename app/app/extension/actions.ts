"use server";

import { revalidatePath } from "next/cache";
import { createToken, listTokens, revokeToken } from "@/lib/agent/tokens";
import { requireSession } from "@/lib/auth";
import { EXTENSION_TOKEN_NAME } from "@/lib/extension/service";

/** How many browsers can be connected at once; connecting another retires the oldest. */
const MAX_BROWSERS = 3;

/** A token for this browser's extension. It's handed to the extension on the page and never shown. */
export async function connectExtensionAction(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const session = await requireSession();
  const userId = session.user.id;
  try {
    const browsers = (await listTokens(userId)).filter((t) => t.name === EXTENSION_TOKEN_NAME);
    for (const old of browsers.slice(MAX_BROWSERS - 1)) await revokeToken(userId, old.id);
    const { token } = await createToken(userId, EXTENSION_TOKEN_NAME);
    revalidatePath("/app/extension");
    return { ok: true, token };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't connect. Try again." };
  }
}

/** Disconnects every browser: their tokens stop working at once. */
export async function disconnectExtensionsAction(): Promise<void> {
  const session = await requireSession();
  for (const t of await listTokens(session.user.id)) if (t.name === EXTENSION_TOKEN_NAME) await revokeToken(session.user.id, t.id);
  revalidatePath("/app/extension");
}
