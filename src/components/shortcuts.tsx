"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV } from "./nav";

/** Keyboard-first (PLAN.md §8): g+key to navigate, / to search, j/k to move through lists, ? for help. */
export function Shortcuts() {
  const router = useRouter();
  const [help, setHelp] = useState(false);

  useEffect(() => {
    let pendingG = false;
    let timer: ReturnType<typeof setTimeout>;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (pendingG) {
        pendingG = false;
        const hit = NAV.find((n) => n.key === e.key);
        if (hit) {
          e.preventDefault();
          router.push(hit.href);
        }
        return;
      }
      if (e.key === "g") {
        pendingG = true;
        clearTimeout(timer);
        timer = setTimeout(() => (pendingG = false), 1200);
      } else if (e.key === "/") {
        const s = document.querySelector<HTMLInputElement>("#search");
        if (s) {
          e.preventDefault();
          s.focus();
        }
      } else if (e.key === "a") {
        router.push("/add");
      } else if (e.key === "?") {
        setHelp((h) => !h);
      } else if (e.key === "Escape") {
        setHelp(false);
      } else if (e.key === "j" || e.key === "k") {
        const rows = [...document.querySelectorAll<HTMLElement>("[data-nav]")];
        if (!rows.length) return;
        const i = rows.findIndex((r) => r.classList.contains("sel"));
        const next = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === "j" ? 1 : -1)))] ?? rows[0];
        rows.forEach((r) => r.classList.remove("sel"));
        next.classList.add("sel");
        next.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        document.querySelector<HTMLElement>("[data-nav].sel a")?.click();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (!help) return null;
  return (
    <div role="dialog" aria-label="Keyboard shortcuts" style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", zIndex: 100 }} className="d-50" onClick={() => setHelp(false)}>
      <div className="win" style={{ width: "min(440px, 92vw)" }} onClick={(e) => e.stopPropagation()}>
        <div className="win-title">
          <span>SHORTCUTS</span>
          <button className="small right" onClick={() => setHelp(false)}>
            X
          </button>
        </div>
        <div className="win-body">
          <table>
            <tbody>
              {NAV.map((n) => (
                <tr key={n.href}>
                  <td>
                    <span className="kbd">g</span> <span className="kbd">{n.key}</span>
                  </td>
                  <td>{n.label}</td>
                </tr>
              ))}
              <tr><td><span className="kbd">/</span></td><td>Search</td></tr>
              <tr><td><span className="kbd">j</span> <span className="kbd">k</span></td><td>Move through rows · Enter opens</td></tr>
              <tr><td><span className="kbd">a</span></td><td>Add a quest</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
