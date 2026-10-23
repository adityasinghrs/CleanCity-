export default function Timeline({ history = [] }) {
  return (
    <ul className="timeline">
      {history.map((h, i) => (
        <li key={i}>
          <b>{h.status}</b> <span className="muted small">· {new Date(h.at).toLocaleString()}{h.by ? ` · ${h.by}` : ""}</span>
          {h.note && <div className="small">{h.note}</div>}
        </li>
      ))}
    </ul>
  );
}
