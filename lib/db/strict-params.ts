import type { Logger } from "drizzle-orm/logger";

/**
 * Makes PGlite refuse what the hosted database refuses.
 *
 * Production runs postgres-js, and drizzle turns off its timestamp serializer so
 * that column values (already ISO strings by the time they get there) pass straight
 * through. The side effect: a raw `Date` handed to a `sql` template, as in
 * sql`${col} > ${date}`, reaches the wire writer as an object and throws
 * ERR_INVALID_ARG_TYPE. PGlite accepts a Date, so such a query passes every local
 * test and then fails only on the real database. Compare with a column helper
 * (`gt(col, date)`), which encodes the Date for you.
 */
export const rejectRawDates: Logger = {
  logQuery(query, params) {
    const at = params.findIndex((param) => param instanceof Date);
    if (at >= 0) {
      throw new TypeError(
        `Query parameter $${at + 1} is a raw Date, which the hosted database (postgres-js) rejects. Compare with a column helper such as gt(column, date), or pass date.toISOString(). Query: ${query}`,
      );
    }
  },
};
