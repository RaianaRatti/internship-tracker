"use client";

import Link from "next/link";
import { useOptimistic, useTransition, useState } from "react";
import type { Status } from "@/db/schema";
import { STATUS_LABEL } from "@/lib/core/status";
import { moveCard } from "@/app/actions/tracker";
import { blip } from "./sound";

export type Card = { id: number; org: string; title: string; status: Status; deadline: string | null; type: string; days: number };

export function Kanban({ cards, columns }: { cards: Card[]; columns: Status[][] }) {
  const [, start] = useTransition();
  const [optimistic, move] = useOptimistic(cards, (state, { id, status }: { id: number; status: Status }) =>
    state.map((c) => (c.id === id ? { ...c, status } : c)),
  );
  const [over, setOver] = useState<string | null>(null);

  function drop(id: number, status: Status) {
    start(async () => {
      move({ id, status });
      blip(status === "offer" || status === "accepted" ? "good" : status === "rejected" ? "bad" : "tick");
      await moveCard(id, status);
    });
  }

  return (
    <div className="board">
      {columns.map((col) => {
        const key = col.join("|");
        const items = optimistic.filter((c) => col.includes(c.status));
        return (
          <div
            key={key}
            className={`col${over === key ? " drop" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(key);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              setOver(null);
              const id = Number(e.dataTransfer.getData("text/plain"));
              if (id && !col.includes(optimistic.find((c) => c.id === id)!.status)) drop(id, col[0]);
            }}
          >
            <div className="col-head">
              <span>{col.map((s) => STATUS_LABEL[s].toUpperCase()).join(" / ")}</span>
              <span>{items.length}</span>
            </div>
            <div className="col-body">
              {items.map((c) => (
                <div key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", String(c.id))} className="qcard" data-nav>
                  <div className="org clip">{c.org}</div>
                  <Link href={`/log/${c.id}`} style={{ display: "block" }}>{c.title}</Link>
                  <div className="row between" style={{ marginTop: 4, minHeight: 22 }}>
                    <span className="meta">{c.deadline ? `due ${c.deadline}` : c.days > 0 ? `${c.days}d here` : ""}</span>
                    {/* Keyboard/touch alternative to drag and drop */}
                    <select
                      className="card-move"
                      aria-label={`Move ${c.title}`}
                      value={c.status}
                      onChange={(e) => drop(c.id, e.target.value as Status)}
                    >
                      {Object.entries(STATUS_LABEL).map(([s, l]) => (
                        <option key={s} value={s}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
