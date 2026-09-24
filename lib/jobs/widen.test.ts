import { describe, expect, it } from "vitest";
import { parseIntent } from "./intent";
import { widerSearches } from "./widen";

describe("widerSearches", () => {
  it("drops the place first, then offers neighboring roles, keeping level and season", () => {
    const intent = parseIntent("business internships in Raleigh for summer 2027");
    const wider = widerSearches(intent);
    expect(wider[0].query).toBe("business and operations internships for summer 2027 anywhere");
    expect(wider[1].label).toBe("Sales");
    expect(wider[1].query).toBe("sales internships in Raleigh for summer 2027");
  });

  it("produces queries the parser reads back as the intended role", () => {
    for (const w of widerSearches(parseIntent("business internships"), 5)) {
      expect(parseIntent(w.query).roles.length).toBeGreaterThan(0);
      expect(parseIntent(w.query).level).toBe("internship");
    }
  });

  it("returns nothing for a search with no role", () => {
    expect(widerSearches(parseIntent("jobs"))).toEqual([]);
  });
});
