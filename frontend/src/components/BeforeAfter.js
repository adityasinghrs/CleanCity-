import { img } from "../api";

export default function BeforeAfter({ c }) {
  if (!c.resolvedImage) return c.image ? <img src={img(c.image)} alt={c.title} className="zoomable" /> : null;
  return (
    <div className="ba">
      <figure><img src={img(c.image)} alt="before" /><figcaption>Before</figcaption></figure>
      <figure><img src={img(c.resolvedImage)} alt="after" /><figcaption>After ✅</figcaption></figure>
    </div>
  );
}
