/**
 * The Welbourne Security radar brand-mark: concentric rings, a crosshair, a core dot and a sweep arc.
 * Decorative, so it is hidden from assistive tech. Themed and centred via the `.brand-mark` styles.
 */
export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48" focusable="false">
        <circle cx="24" cy="24" r="18" className="brand-mark-ring" />
        <circle cx="24" cy="24" r="11" className="brand-mark-ring" />
        <path d="M24 6 V42" className="brand-mark-grid" />
        <path d="M6 24 H42" className="brand-mark-grid" />
        <circle cx="24" cy="24" r="3.2" className="brand-mark-core" />
        <path d="M24 6 A18 18 0 0 1 42 24" className="brand-mark-sweep" />
      </svg>
    </span>
  );
}
