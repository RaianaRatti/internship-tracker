import Link from "next/link";
import type { Status } from "@/db/schema";
import { STATUS_LABEL } from "@/lib/core/status";
import { Px, type IconName } from "./px";

/** A card: pink title strip (with optional pixel icon) over a white body. */
export function Win({ title, icon, right, children, flush, id }: { title: string; icon?: IconName; right?: React.ReactNode; children: React.ReactNode; flush?: boolean; id?: string }) {
  return (
    <section className="win" id={id}>
      <div className="win-title">
        <span>
          {icon && <Px name={icon} />}
          {title}
        </span>
        {right && <div className="right row tight">{right}</div>}
      </div>
      <div className={`win-body${flush ? " flush" : ""}`}>{children}</div>
    </section>
  );
}

/** Consistent page header: pink icon tile, title, one-line subtitle, actions on the right. */
export function PageHead({ icon, title, sub, children, back }: { icon: IconName; title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <>
      {back && (
        <Link href={back.href} className="back">
          ← {back.label}
        </Link>
      )}
      <header className="page-head">
        <div className="tile">
          <Px name={icon} size={3} />
        </div>
        <div className="titles">
          <h1>{title}</h1>
          {sub && <p className="sub">{sub}</p>}
        </div>
        {children && <div className="actions">{children}</div>}
      </header>
    </>
  );
}

/** Small "?" that explains something on hover instead of a paragraph on the page. */
export function Hint({ children }: { children: string }) {
  return (
    <span className="hint" title={children} aria-label={children} role="note">
      ?
    </span>
  );
}

export function Stat({ icon, value, label }: { icon: IconName; value: React.ReactNode; label: string }) {
  return (
    <div className="stat">
      <Px name={icon} size={3} />
      <div>
        <b>{value}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge s-${status}`}>
      <i className="sw" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Fit({ score }: { score: number | null }) {
  if (score == null) return null;
  return (
    <span className={`fit${score >= 70 ? " hi" : ""}`} title="Fit score">
      {Math.round(score)}
    </span>
  );
}

export function Meter({ value, max = 10 }: { value: number; max?: number }) {
  const on = Math.round(Math.max(0, Math.min(1, value)) * max);
  return (
    <span className="meter" aria-label={`${Math.round(value * 100)}%`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < on ? "on" : ""} />
      ))}
    </span>
  );
}

export function Empty({ children, href, cta }: { children: React.ReactNode; href?: string; cta?: string }) {
  return (
    <div className="empty">
      {children}
      {href && (
        <>
          {" "}
          <Link className="link" href={href}>
            {cta?.toLowerCase()} →
          </Link>
        </>
      )}
    </div>
  );
}

export function fmtDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T12:00:00` : d) : d;
  if (Number.isNaN(date.getTime())) return String(d);
  return opts.timeStyle ? date.toLocaleString("en-US", opts) : date.toLocaleDateString("en-US", opts);
}

export function daysAgo(d: Date | null | undefined) {
  if (!d) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86400_000);
  return days <= 0 ? "today" : days === 1 ? "1d ago" : `${days}d ago`;
}

export const TYPE_LABEL: Record<string, string> = {
  internship: "Internship",
  coop: "Co-op",
  early_program: "Early program",
  research: "Research",
  fellowship: "Fellowship",
  scholarship: "Scholarship",
  event: "Event",
  new_grad: "New grad",
  other: "Other",
};
