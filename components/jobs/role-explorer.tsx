import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import type { RoleRecommendation } from "@/lib/jobs/recommend";

export function RoleExplorer({ roles }: { roles: RoleRecommendation[] }) {
  return (
    <section className="mt-9 rounded-xl border bg-background p-5 sm:p-6" aria-labelledby="role-explorer-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 id="role-explorer-heading" className="text-[17px] font-semibold tracking-tight">Roles to explore</h2>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Based on your goals and confirmed profile. Check each opening for its actual requirements.
          </p>
        </div>
        <Link href="/app/onboarding?step=goals" className="text-[12px] text-muted-foreground hover:text-foreground">
          Edit goals
        </Link>
      </div>
      {roles.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {roles.map((role) => (
            <Link
              key={role.id}
              href={`/app/jobs?q=${encodeURIComponent(role.query)}`}
              className="group flex min-h-36 flex-col rounded-lg border p-4 transition-colors hover:border-border-strong hover:bg-muted/40"
            >
              <span className="text-[11px] font-medium text-subtle-foreground">{role.source === "goal" ? "YOUR GOAL" : "FROM YOUR PROFILE"}</span>
              <span className="mt-2 text-[15px] font-semibold">{role.label}</span>
              <span className="mt-1 text-[12.5px] leading-5 text-muted-foreground">{role.reason}</span>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-[12.5px] font-medium text-foreground">
                Search openings <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed p-4 text-[13px] text-muted-foreground">
          Add a goal or confirm a few skills and experiences to get role ideas tied to your profile. <Link href="/app/profile" className="font-medium text-foreground hover:underline">Review your profile</Link>
        </div>
      )}
      <p className="mt-3 text-[11.5px] text-subtle-foreground">These are starting points for a search, not a prediction of whether an employer will hire you.</p>
    </section>
  );
}