import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { EMAIL_CLASSES } from "@/db/schema";
import { Win, Empty, fmtDate, PageHead, Hint } from "@/components/ui";
import { Flash, type SP } from "@/components/flash";
import { Submit } from "@/components/submit";
import { gmailConfigured, getGoogleAccount } from "@/lib/gmail/oauth";
import { aiConfigured } from "@/lib/ai/client";
import { syncGmailAction, confirmEmail, dismissEmail, disconnectGmailAction } from "../actions/gmail";

export default async function Messenger({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const account = await getGoogleAccount();
  const [pending, recent, apps] = await Promise.all([
    db.select().from(schema.emails).where(eq(schema.emails.reviewState, "pending")).orderBy(desc(schema.emails.receivedAt)),
    db.select().from(schema.emails).where(eq(schema.emails.reviewState, "auto")).orderBy(desc(schema.emails.receivedAt)).limit(30),
    db
      .select({ id: schema.applications.id, org: schema.opportunities.org, title: schema.opportunities.title })
      .from(schema.applications)
      .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id)),
  ]);

  return (
    <>
      <PageHead icon="mail" title="Messenger" sub={account ? `Gmail · ${account.accountEmail}` : "Auto-update statuses from your inbox"}>
        {account && <form action={syncGmailAction}><Submit className="primary" pendingText="Reading">↻ Sync</Submit></form>}
      </PageHead>
      <Flash sp={sp} />
      <Win title="Gmail" icon="mail" right={<Hint>Read-only. Searches recruiting mail only and keeps just sender, subject, date and the detected status.</Hint>}>
        {!gmailConfigured() ? (
          <div>
            <p>Detects confirmations, interviews, rejections and offers, and turns job-alert emails into quests.</p>
            <details>
            <summary className="accent">Set up (5 min)</summary>
            <ol className="meta">
              <li>In Google Cloud Console, create a project and enable the <b>Gmail API</b>.</li>
              <li>OAuth consent screen: External, add yourself as a <b>test user</b> (keeps it in Testing mode; no Google review needed for personal use).</li>
              <li>Create an OAuth client of type <b>Web application</b> with redirect URI <code>http://localhost:3000/api/gmail/callback</code>.</li>
              <li>Put <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in <code>.env.local</code> and restart.</li>
            </ol>
            </details>
          </div>
        ) : account ? (
          <div className="row between">
            <span className="meta">Last sync {account.lastSyncAt ? fmtDate(account.lastSyncAt, { dateStyle: "medium", timeStyle: "short" }) : "never"}{!aiConfigured() && " · rules-only sorting"}</span>
            <form action={disconnectGmailAction}><button className="small ghost">Disconnect</button></form>
          </div>
        ) : (
          <div className="row between">
            <span className="meta">Not connected</span>
            <a className="btn primary" href="/api/gmail/connect">Connect Gmail</a>
          </div>
        )}
      </Win>

      <Win title={`To review · ${pending.length}`} icon="check">
        {pending.length ? (
          pending.map((m) => (
            <form key={m.id} action={confirmEmail.bind(null, m.id)} className="stack item">
              <div>
                <b>{m.subject}</b>
                <div className="meta">{m.fromAddress} · {fmtDate(m.receivedAt)} · <span className="tag">{m.classification?.replace(/_/g, " ")}?</span></div>
              </div>
              <div className="row tight">
                <select name="classification" defaultValue={m.classification ?? "other"} style={{ maxWidth: 200 }}>
                  {EMAIL_CLASSES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                </select>
                <select name="applicationId" defaultValue={m.applicationId ?? ""} style={{ maxWidth: 320 }}>
                  <option value="">— which quest? —</option>
                  {apps.map((a) => <option key={a.id} value={a.id}>{a.org}: {a.title}</option>)}
                </select>
                <button className="primary small">Confirm</button>
                <button className="small ghost" formAction={dismissEmail.bind(null, m.id)}>Skip</button>
              </div>
            </form>
          ))
        ) : (
          <Empty>Nothing to review</Empty>
        )}
      </Win>

      <Win title="Handled automatically" icon="mail" flush>
        {recent.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Email</th><th>Detected</th></tr></thead>
              <tbody>
                {recent.map((m) => (
                  <tr key={m.id}>
                    <td className="nowrap meta">{fmtDate(m.receivedAt)}</td>
                    <td>{m.subject}<div className="meta">{m.fromAddress}</div></td>
                    <td><span className="tag">{m.classification?.replace(/_/g, " ")}</span> {m.applicationId && <a className="link" href={`/log/${m.applicationId}`}>quest</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="win-body"><Empty>Nothing yet</Empty></div>
        )}
      </Win>
    </>
  );
}
