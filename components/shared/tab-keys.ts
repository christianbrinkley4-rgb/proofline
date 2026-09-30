import type { KeyboardEvent } from "react";

/**
 * Keyboard for a role="tablist": Left and Right arrows, Home and End move to a tab
 * and select it (WAI-ARIA tabs pattern). Pair with tabIndex={selected ? 0 : -1} on
 * each tab so Tab moves past the strip in one step.
 */
export function onTabListKeyDown(e: KeyboardEvent<HTMLElement>) {
  const tabs = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])')];
  const current = tabs.indexOf(document.activeElement as HTMLElement);
  if (current < 0) return;
  const last = tabs.length - 1;
  const next =
    e.key === "ArrowRight" ? (current === last ? 0 : current + 1)
    : e.key === "ArrowLeft" ? (current === 0 ? last : current - 1)
    : e.key === "Home" ? 0
    : e.key === "End" ? last
    : -1;
  if (next < 0) return;
  e.preventDefault();
  tabs[next].focus();
  tabs[next].click();
}
