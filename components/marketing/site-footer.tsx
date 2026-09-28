import { Logo } from "@/components/brand/logo";
import { site } from "@/lib/site";
import { container } from "./section";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/#proof", label: "How bullets are written" },
      { href: "/check", label: "Free resume check" },
      { href: "/guides", label: "Guides" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/contact", label: "Contact us" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className={`${container} flex flex-col gap-10 py-12 sm:flex-row sm:justify-between`}>
        <div className="max-w-xs">
          <Logo />
          <p className="mt-3 text-[14px] leading-6 text-muted-foreground">For students who&apos;d rather be interviewing.</p>
        </div>
        <div className="grid grid-cols-2 gap-10 sm:gap-16">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-[13px] font-medium">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="text-[14px] text-muted-foreground transition-colors hover:text-foreground">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t">
        <div className={`${container} py-6 text-[13px] text-subtle-foreground`}>
          © {new Date().getFullYear()} {site.name}
        </div>
      </div>
    </footer>
  );
}
