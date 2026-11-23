"use client";

import { useEffect, useState } from "react";

// 8-bit blips on status changes (PLAN.md §8): square waves via WebAudio, off by default.
function enabled() {
  try {
    return localStorage.getItem("sound") === "on";
  } catch {
    return false;
  }
}

export function blip(kind: "good" | "bad" | "tick" = "tick") {
  if (typeof window === "undefined" || !enabled()) return;
  const ctx = new AudioContext();
  const notes = kind === "good" ? [523, 659, 784, 1047] : kind === "bad" ? [392, 330, 262] : [880];
  notes.forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = f;
    g.gain.value = 0.05;
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + i * 0.09);
    o.stop(ctx.currentTime + i * 0.09 + 0.08);
  });
}

export function SoundToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(enabled()), []);
  return (
    <button
      className="small ghost"
      style={{ padding: 0 }}
      onClick={() => {
        const next = !on;
        setOn(next);
        try {
          localStorage.setItem("sound", next ? "on" : "off");
        } catch {}
        if (next) setTimeout(() => blip("good"), 0);
      }}
      aria-pressed={on}
    >
      ♪ {on ? "On" : "Off"}
    </button>
  );
}
