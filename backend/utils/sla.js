// Service-Level Agreement (SLA): how many hours the city promises to resolve each type of issue.
// Overdue complaints are flagged so admins can escalate them (and citizens can see the promise).
const SLA_HOURS = { "Hazardous Waste": 24, "Illegal Dumping": 48, "Overflowing Bin": 48, "Missed Pickup": 72, Other: 120 };

function slaInfo({ status, category, createdAt, resolvedAt }, now = Date.now()) {
  const hours = SLA_HOURS[category] || SLA_HOURS.Other;
  const created = new Date(createdAt).getTime();
  const dueAt = new Date(created + hours * 36e5);
  if (status === "Resolved") {
    const done = resolvedAt ? new Date(resolvedAt).getTime() : now;
    return { slaHours: hours, dueAt, overdue: false, metSla: done <= dueAt.getTime(), hoursLeft: 0 };
  }
  const hoursLeft = Math.round(((dueAt.getTime() - now) / 36e5) * 10) / 10;
  return { slaHours: hours, dueAt, overdue: hoursLeft < 0, metSla: null, hoursLeft };
}

module.exports = { SLA_HOURS, slaInfo };
