import { cn } from "@/lib/utils";

/** Page gutter: 16px on phones, 24px from sm up, content capped at 72rem. */
export const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";

/** Wider gutter for full-bleed product moments (the hero stage). */
export const wideContainer = "mx-auto w-full max-w-[84rem] px-4 sm:px-6";

export function Section({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={cn("py-20 sm:py-28", className)}>
      <div className={container}>{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
  className,
  align = "start",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  align?: "start" | "center";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && (
        <p className={cn("inline-flex items-center gap-2 font-mono text-[12px] tracking-wide text-brand-ink uppercase", align === "center" && "justify-center")}>
          <span aria-hidden="true" className="h-px w-5 bg-brand" />
          {eyebrow}
        </p>
      )}
      <h2 className="mt-4 font-display text-[34px] leading-[1.04] font-semibold sm:text-[46px]">{title}</h2>
      {children && <p className="mt-5 text-[17px] leading-7 text-pretty text-muted-foreground sm:text-[18px] sm:leading-8">{children}</p>}
    </div>
  );
}
