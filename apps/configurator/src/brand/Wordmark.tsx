/**
 * ATOM MODULAR wordmark — CSS/SVG reconstruction of the brand-guide lockup
 * (heavy uppercase ATOM over letter-spaced MODULAR, in ATOM Red).
 *
 * TODO: replace with the supplied vector artwork when available — drop
 * `atom-primary.svg` / `atom-mono.svg` into `public/brand/` and swap this
 * component's body for an <img>. Keeping it as markup avoids shipping a
 * traced approximation of the real logo file.
 */
export function Wordmark({ mono = false }: { mono?: boolean }) {
  return (
    <span className={`wordmark ${mono ? "mono" : ""}`} aria-label="ATOM Modular">
      <span className="wordmark-atom">ATOM</span>
      <span className="wordmark-modular">MODULAR</span>
    </span>
  );
}
