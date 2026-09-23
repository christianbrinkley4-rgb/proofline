import { cn } from "@/lib/utils";

/** Page gutter: 16px on phones, 24px from sm up, content capped at 72rem. */
export const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";

export function Section({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={cn("border-t py-20 sm:py-28", className)}>
      <div className={container}>{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow && <p className="font-mono text-[12px] text-subtle-foreground">{eyebrow}</p>}
      <h2 className="mt-3 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-[40px]">{title}</h2>
      {children && <p className="mt-4 text-[17px] leading-7 text-pretty text-muted-foreground">{children}</p>}
    </div>
  );
}
