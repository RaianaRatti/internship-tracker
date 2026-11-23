import { Px } from "./px";

export function Flash({ sp }: { sp: { msg?: string; err?: string } }) {
  if (sp.err) return <div className="alert inv" role="alert"><Px name="bolt" /> {sp.err}</div>;
  if (sp.msg) return <div className="alert" role="status"><Px name="check" className="accent" /> {sp.msg}</div>;
  return null;
}

export type SP = Promise<Record<string, string | undefined>>;
