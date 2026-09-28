/**
 * Characters resumes use as bullet markers. Word exports often use Symbol or
 * Wingdings glyphs, which come out of a PDF as private-use code points
 * (U+F0B7 is Symbol's round bullet, U+F0A7 Wingdings' square, U+F076 its
 * diamond, U+F0D8 and U+F0E8 its arrows, U+F0FC its check mark).
 */
export const BULLET_CHARS = "•●▪◦■‣⁃∙➢➤►▸✓✔→\uF0B7\uF0A7\uF076\uF0D8\uF0E8\uF0FC";

/** A glyph marker, which needs no space after it ("•Led" and "• Led" both count). */
export const GLYPH_BULLET = new RegExp(`^\\s*[${BULLET_CHARS}]\\s*`);

/** A glyph marker, or a dash, star, or middle dot followed by a space. */
export const BULLET = new RegExp(`^\\s*(?:[${BULLET_CHARS}]\\s*|[-*–·]\\s+)`);

/** "record-" then "keeping" becomes "record-keeping"; anything else joins with a space. */
export function joinWrapped(first: string, next: string): string {
  return /[A-Za-z]-$/.test(first) ? `${first}${next}` : `${first} ${next}`;
}
