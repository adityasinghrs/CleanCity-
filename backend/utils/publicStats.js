// Public transparency numbers (no personal data). Pure function over decorated complaints.
function publicStats(complaints) {
  const total = complaints.length;
  const resolved = complaints.filter((c) => c.status === "Resolved");
  const open = complaints.filter((c) => c.status !== "Resolved");
  const overdue = open.filter((c) => c.sla?.overdue).length;
  const metSla = resolved.filter((c) => c.sla?.metSla).length;
  const hours = resolved.filter((c) => c.resolvedAt).map((c) => (new Date(c.resolvedAt) - new Date(c.createdAt)) / 36e5);
  const byCategory = {};
  complaints.forEach((c) => { byCategory[c.category] = (byCategory[c.category] || 0) + 1; });
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
  return {
    total, open: open.length, resolved: resolved.length, overdue,
    resolutionRatePct: pct(resolved.length, total),
    slaComplianceOfResolvedPct: pct(metSla, resolved.length),
    avgResolutionHours: hours.length ? Math.round((hours.reduce((s, x) => s + x, 0) / hours.length) * 10) / 10 : null,
    byCategory: Object.entries(byCategory).map(([category, n]) => ({ category, n })).sort((a, b) => b.n - a.n),
  };
}
module.exports = { publicStats };
