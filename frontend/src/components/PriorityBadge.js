export default function PriorityBadge({ level, score }) {
  if (!level || level === "Done") return null;
  const cls = level === "High" ? "red" : level === "Medium" ? "orange" : "slate";
  return <span className={`badge ${cls}`} title={`Priority score ${score}`}>{level} priority</span>;
}
