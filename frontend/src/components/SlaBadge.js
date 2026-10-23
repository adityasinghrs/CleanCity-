// Shows the service promise (SLA) for a complaint: time left, overdue, or met / missed once resolved.
export default function SlaBadge({ sla, compact }) {
  if (!sla) return null;
  if (sla.metSla === true) return <span className="badge green" title="Resolved within the promised time">✅ SLA met</span>;
  if (sla.metSla === false) return <span className="badge slate" title="Resolved after the promised time">SLA missed</span>;
  if (sla.overdue) return <span className="badge red" title={`Promised within ${sla.slaHours} h`}>⏰ Overdue {Math.abs(Math.round(sla.hoursLeft))} h</span>;
  const h = Math.round(sla.hoursLeft);
  const text = h >= 48 ? `${Math.round(h / 24)} days left` : `${h} h left`;
  return <span className="badge blue" title={`Promised within ${sla.slaHours} h`}>{compact ? text : `⏱ ${text}`}</span>;
}
