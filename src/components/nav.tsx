"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import { SoundToggle } from "./sound";
import { Px, type IconName } from "./px";

export const NAV: { href: string; label: string; key: string; group: number; icon: IconName }[] = [
  { href: "/", label: "Home", key: "h", group: 0, icon: "home" },
  { href: "/quests", label: "Quest Board", key: "q", group: 0, icon: "search" },
  { href: "/log", label: "Quest Log", key: "l", group: 0, icon: "list" },
  { href: "/calendar", label: "Calendar", key: "c", group: 0, icon: "calendar" },
  { href: "/vault", label: "Character", key: "v", group: 1, icon: "user" },
  { href: "/spellbook", label: "Spellbook", key: "s", group: 1, icon: "book" },
  { href: "/forge", label: "Forge", key: "f", group: 1, icon: "quill" },
  { href: "/research", label: "Research", key: "r", group: 1, icon: "flask" },
  { href: "/messenger", label: "Messenger", key: "m", group: 2, icon: "mail" },
  { href: "/stats", label: "Stats", key: "t", group: 2, icon: "chart" },
  { href: "/settings", label: "Settings", key: ",", group: 2, icon: "gear" },
  { href: "/add", label: "Add quest", key: "a", group: 3, icon: "plus" },
];

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      <div className="topbar">
        <Link href="/" className="brand" style={{ margin: 0 }}>
          <i className="brand-mark" /> QUEST LOG
        </Link>
        <button className="small ghost" onClick={() => setOpen(true)} aria-label="Open menu">
          MENU
        </button>
      </div>
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="row between">
          <Link href="/" className="brand" onClick={() => setOpen(false)}>
            <i className="brand-mark" /> QUEST LOG
          </Link>
          {open && (
            <button className="small" onClick={() => setOpen(false)} aria-label="Close menu">
              X
            </button>
          )}
        </div>
        <nav className="nav">
          {NAV.filter((n) => n.group < 3).map((n, i, arr) => (
            <Fragment key={n.href}>
              {i > 0 && arr[i - 1].group !== n.group && <span className="sep" aria-hidden />}
              <Link href={n.href} aria-current={active(n.href) ? "page" : undefined} onClick={() => setOpen(false)}>
                <Px name={n.icon} />
                {n.label}
              </Link>
            </Fragment>
          ))}
        </nav>
        <div className="nav-foot">
          <ThemeToggle />
          <SoundToggle />
          <span className="kbd" title="Keyboard shortcuts: press ?">?</span>
        </div>

      </aside>
    </>
  );
}
