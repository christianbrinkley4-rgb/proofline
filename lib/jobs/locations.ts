/**
 * Place matching without a geocoding service: US states, and metro areas as
 * clusters of nearby cities. "Raleigh" matches Durham, Cary, and RTP postings.
 */

export const STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/** Metro areas: the first city names the metro; the rest are within commuting distance. */
export const METROS: Array<{ name: string; state: string; cities: string[] }> = [
  { name: "Raleigh", state: "NC", cities: ["raleigh", "durham", "cary", "chapel hill", "morrisville", "research triangle", "rtp", "apex", "wake forest", "garner", "holly springs"] },
  { name: "Charlotte", state: "NC", cities: ["charlotte", "concord", "gastonia", "huntersville", "matthews", "rock hill", "fort mill"] },
  { name: "Greensboro", state: "NC", cities: ["greensboro", "winston-salem", "winston salem", "high point", "burlington"] },
  { name: "Atlanta", state: "GA", cities: ["atlanta", "alpharetta", "marietta", "sandy springs", "duluth", "decatur"] },
  { name: "New York", state: "NY", cities: ["new york", "nyc", "manhattan", "brooklyn", "jersey city", "hoboken", "newark", "stamford"] },
  { name: "San Francisco", state: "CA", cities: ["san francisco", "sf", "oakland", "san jose", "palo alto", "mountain view", "menlo park", "sunnyvale", "santa clara", "redwood city", "san mateo", "cupertino", "south san francisco"] },
  { name: "Los Angeles", state: "CA", cities: ["los angeles", "santa monica", "culver city", "irvine", "pasadena", "burbank", "el segundo", "long beach"] },
  { name: "Seattle", state: "WA", cities: ["seattle", "bellevue", "redmond", "kirkland", "tacoma"] },
  { name: "Boston", state: "MA", cities: ["boston", "cambridge", "somerville", "waltham", "burlington"] },
  { name: "Chicago", state: "IL", cities: ["chicago", "evanston", "oak brook", "naperville", "schaumburg"] },
  { name: "Washington", state: "DC", cities: ["washington", "arlington", "alexandria", "reston", "mclean", "tysons", "bethesda", "herndon"] },
  { name: "Austin", state: "TX", cities: ["austin", "round rock"] },
  { name: "Dallas", state: "TX", cities: ["dallas", "fort worth", "plano", "irving", "frisco", "addison"] },
  { name: "Houston", state: "TX", cities: ["houston", "the woodlands", "sugar land"] },
  { name: "Denver", state: "CO", cities: ["denver", "boulder", "aurora", "englewood", "broomfield"] },
  { name: "Philadelphia", state: "PA", cities: ["philadelphia", "king of prussia", "conshohocken", "wilmington"] },
  { name: "Miami", state: "FL", cities: ["miami", "fort lauderdale", "boca raton", "coral gables"] },
  { name: "Nashville", state: "TN", cities: ["nashville", "franklin", "brentwood"] },
  { name: "Minneapolis", state: "MN", cities: ["minneapolis", "st. paul", "saint paul", "bloomington"] },
  { name: "Phoenix", state: "AZ", cities: ["phoenix", "scottsdale", "tempe", "chandler", "mesa"] },
];

const STATE_BY_NAME = new Map(Object.entries(STATES).map(([abbr, name]) => [name.toLowerCase(), abbr]));

export type Place = { label: string; cities: string[]; state: string | null };

/** "Raleigh, NC", "raleigh", "North Carolina", "NC" -> a place to match against postings. */
export function resolvePlace(raw: string): Place | null {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return null;
  const [cityPart, statePart] = text.split(/,\s*/);
  const lowerCity = cityPart.toLowerCase();

  const stateAbbr =
    (statePart && (STATES[statePart.toUpperCase()] ? statePart.toUpperCase() : STATE_BY_NAME.get(statePart.toLowerCase()))) ??
    (STATES[text.toUpperCase()] ? text.toUpperCase() : STATE_BY_NAME.get(text.toLowerCase())) ??
    null;

  // A whole state: "North Carolina" or "NC".
  if (!statePart && stateAbbr && (STATES[text.toUpperCase()] || STATE_BY_NAME.has(text.toLowerCase()))) {
    return { label: STATES[stateAbbr], cities: [], state: stateAbbr };
  }

  const metro = METROS.find((m) => m.cities.includes(lowerCity) && (!stateAbbr || m.state === stateAbbr));
  if (metro) return { label: `${metro.name} area`, cities: metro.cities, state: metro.state };
  return { label: stateAbbr ? `${cityPart}, ${stateAbbr}` : cityPart, cities: [lowerCity], state: stateAbbr };
}

/** Does a posting's location text fall in this place? */
export function matchesPlace(location: string | null | undefined, place: Place): boolean {
  if (!location) return false;
  const l = location.toLowerCase();
  if (place.cities.length) {
    return place.cities.some((c) => new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(l));
  }
  if (place.state) {
    const name = STATES[place.state].toLowerCase();
    return l.includes(name) || new RegExp(`(,|\\b)\\s*${place.state.toLowerCase()}\\b`).test(l) || new RegExp(`\\bus-${place.state.toLowerCase()}\\b`).test(l);
  }
  return false;
}

export function isRemoteText(location: string | null | undefined): boolean {
  return !!location && /\b(remote|anywhere|distributed|work from home)\b/i.test(location);
}

export function isUSLocation(location: string | null | undefined): boolean {
  if (!location) return false;
  if (/\b(united states|usa|u\.s\.|us remote|remote.*us|us-)\b/i.test(location)) return true;
  return Object.keys(STATES).some((abbr) => new RegExp(`,\\s*${abbr}\\b`).test(location)) ||
    Object.values(STATES).some((n) => location.toLowerCase().includes(n.toLowerCase()));
}

/**
 * How a place reads on a card: "Cary,North Carolina,United States" becomes
 * "Cary, NC". Each place in a list ("San Francisco, CA • New York, NY") is
 * tidied on its own; anything we don't recognize keeps its words.
 */
export function tidyLocation(location: string | null | undefined): string | null {
  if (!location?.trim()) return null;
  return location
    .split(/\s*(•|;|\|)\s*/)
    .map((part) => {
      if (/^(•|;|\|)$/.test(part)) return part === "•" ? " • " : `${part} `;
      const pieces = part.split(/\s*,\s*/).map((p) => p.trim()).filter(Boolean);
      if (pieces.length > 1 && /^(united states( of america)?|usa|us)$/i.test(pieces.at(-1)!)) pieces.pop();
      if (pieces.length === 2) {
        const code = STATE_BY_NAME.get(pieces[1].toLowerCase());
        if (code) pieces[1] = code;
      }
      return pieces.join(", ");
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}
