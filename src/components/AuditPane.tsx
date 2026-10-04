import type { Vendor } from "../lib/types";
import { formatOverride, type AuditEvent } from "../lib/audit";
import { Icon } from "./Icon";

export function AuditPane({ vendor, events, storageWarning }: { vendor: Vendor; events: AuditEvent[]; storageWarning: string }) {
  const entries = [
    ...vendor.emails.map(email => ({ id: email.id, at: email.date, title: email.from === vendor.contactEmail ? "Email Received" : "Email Sent",
      detail: `${email.fromName} · ${email.from} → ${email.to}`, subject: email.subject, body: email.body, kind: "email" as const })),
    ...events.filter(event => event.vendorId === vendor.id).map(event => ({ ...event, subject: "",
      detail: event.kind === "email-handoff" ? event.detail.replace(" · sending not confirmed", "") : event.detail,
      title: event.kind === "edit" ? "Manual Override" : event.kind === "email-handoff" || event.kind === "email-sent" ? "Email Sent"
        : event.title.startsWith("Removed") ? "Removed from Vendor Follow-Up" : "Flagged for Vendor Follow-Up" })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return <section className="audit-pane" aria-label="Audit history">
    <header className="column-header"><h2>Audit</h2><span>{entries.length} events</span></header>
    <p className="audit-note">Email history and manual actions · newest first. Changes are saved in this browser. Demo email delivery is simulated.</p>
    {storageWarning && <p className="override-error" role="alert">{storageWarning}</p>}
    <ol className="audit-timeline">
      {entries.map(entry => <li key={entry.id} className="audit-event">
        <span className="audit-event-icon"><Icon name={entry.kind === "edit" ? "pencil" : entry.kind === "follow-up" ? "flag" : "file"} /></span>
        <div className="audit-event-content"><header><strong>{entry.title}</strong><time dateTime={entry.at}>{new Date(entry.at).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</time></header>
          <p>{entry.detail}</p>
          {entry.kind === "edit" && <div className="audit-change"><span>{formatOverride(entry.before)}</span><span aria-label="changed to">→</span><strong>{formatOverride(entry.after)}</strong></div>}
          {entry.subject && <p className="audit-email-subject">{entry.subject}</p>}
        </div>
      </li>)}
    </ol>
  </section>;
}
