import type { DrawOp } from "@/lib/resume/layout";
import { PAGE } from "@/lib/resume/layout";
import type { Template } from "@/lib/resume/templates";
import { cn } from "@/lib/utils";

/**
 * The resume page drawn from the exact operations the PDF renderer uses, so what
 * you see is what gets exported. Tinos and Arimo are metric twins of Times New
 * Roman and Arial, which keeps every line break identical on every device.
 */
export function PagePreview({
  ops,
  family,
  hovered,
  className,
}: {
  ops: DrawOp[];
  family: Template["family"];
  hovered?: string | null;
  className?: string;
}) {
  const fontFamily = family === "times" ? "var(--font-resume-serif), 'Times New Roman', Times, serif" : "var(--font-resume-sans), Arial, Helvetica, sans-serif";
  return (
    <svg
      viewBox={`0 0 ${PAGE.width} ${PAGE.height}`}
      role="img"
      aria-label="Resume preview"
      className={cn("h-auto w-full bg-white", className)}
      style={{ fontFamily }}
    >
      {ops.map((op, i) =>
        op.kind === "text" ? (
          <text
            key={i}
            x={op.x}
            y={PAGE.height - op.y}
            fontSize={op.size}
            fontWeight={op.font === "bold" ? 700 : 400}
            fontStyle={op.font === "italic" ? "italic" : "normal"}
            fill={hovered && op.ref === hovered ? "#0f6b4a" : "#141416"}
            data-ref={op.ref}
            xmlSpace="preserve"
          >
            {op.text}
          </text>
        ) : (
          <line key={i} x1={op.x1} x2={op.x2} y1={PAGE.height - op.y} y2={PAGE.height - op.y} stroke="#59595e" strokeWidth={op.thickness} />
        ),
      )}
    </svg>
  );
}
