import { describe, expect, it } from "vitest";
import { tidyLocation } from "./locations";

describe("tidyLocation", () => {
  it("spaces commas, shortens state names, and drops a trailing country", () => {
    expect(tidyLocation("Cary,North Carolina,United States")).toBe("Cary, NC");
    expect(tidyLocation("Chicago, United States")).toBe("Chicago");
    expect(tidyLocation("Doraville, GA, US")).toBe("Doraville, GA");
    expect(tidyLocation("San Francisco, CA • New York, NY")).toBe("San Francisco, CA • New York, NY");
    expect(tidyLocation("Hybrid - New York, NY")).toBe("Hybrid - New York, NY");
    expect(tidyLocation("Mountain View, California (HQ)")).toBe("Mountain View, California (HQ)");
    expect(tidyLocation("New York, New York, United States, Stamford, Connecticut")).toBe("New York, NY • Stamford, CT");
    expect(tidyLocation("  ")).toBeNull();
  });
});
