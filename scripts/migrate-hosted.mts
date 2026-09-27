import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url || !/^postgres(?:ql)?:\/\//.test(url)) {
  throw new Error("Set DATABASE_URL to a direct Postgres connection before running migrations.");
}
if (new URL(url).hostname.includes("-pooler")) {
  throw new Error("Use a direct Postgres URL for migrations, not a pooled URL.");
}

const client = postgres(url, { max: 1, prepare: false });
try {
  await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  const [schema] = await client`
    select
      to_regclass('public.user') is not null as has_user,
      to_regclass('public.profile') is not null as has_profile,
      to_regclass('public.bullet_suggestion') is not null as has_bullet_suggestion,
      to_regclass('public.career_goal') is not null as has_career_goal,
      to_regclass('public.career_checkin') is not null as has_career_checkin,
      to_regclass('public.model_daily_budget') is not null as has_model_budget,
      exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'career_checkin' and column_name = 'completed_action_id') as has_completed_action
  `;
  if (!schema.has_user || !schema.has_profile || !schema.has_bullet_suggestion || !schema.has_career_goal || !schema.has_career_checkin || !schema.has_model_budget || !schema.has_completed_action) {
    throw new Error("Required Proofline tables are missing after migration.");
  }
  console.log("Proofline database migrations applied and core tables verified.");
} catch {
  console.error("Proofline database migration failed. Check the database connection and migration history.");
  process.exitCode = 1;
} finally {
  await client.end();
}
