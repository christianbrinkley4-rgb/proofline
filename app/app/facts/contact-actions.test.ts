import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireSession: vi.fn(async () => ({ user: { id: "owner" } })) }));
vi.mock("@/lib/kb/profile", () => ({ updateProfile: vi.fn() }));
import { saveContactAction } from "./actions";
import { updateProfile } from "@/lib/kb/profile";

const contact = { fullName: "Casey Morgan", contactEmail: "casey.resume@example.invalid", phone: "", city: "", region: "", linkedinUrl: "linkedin.com/in/casey", portfolioUrl: "casey.com", confirmed: true as const };
beforeEach(() => { vi.mocked(updateProfile).mockClear(); });

describe("resume contact details", () => {
  it("writes the user's selected resume email, scoped to the authenticated account", async () => {
    expect(await saveContactAction(contact)).toEqual({ ok: true });
    expect(updateProfile).toHaveBeenCalledWith("owner", expect.objectContaining({ contactEmail: contact.contactEmail, portfolioUrl: "casey.com" }));
  });
  it("keeps a blank email blank", async () => {
    expect(await saveContactAction({ ...contact, contactEmail: "" })).toEqual({ ok: true });
    expect(updateProfile).toHaveBeenCalledWith("owner", expect.objectContaining({ contactEmail: null }));
  });
  it("refuses unconfirmed contact edits", async () => {
    expect((await saveContactAction({ ...contact, confirmed: false as unknown as true })).ok).toBe(false);
    expect(updateProfile).not.toHaveBeenCalled();
  });
  it("rejects malformed emails", async () => {
    expect((await saveContactAction({ ...contact, contactEmail: "bad@address" })).ok).toBe(false);
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
