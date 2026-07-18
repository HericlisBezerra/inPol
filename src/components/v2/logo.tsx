/** Inpol wordmark — "In" ink, "pol" + dot in brand green. */
export function V2Logo({ size = 21 }: { size?: number }) {
  return (
    <span
      className="font-display font-semibold leading-none"
      style={{ fontSize: size, color: "var(--v2-ink)" }}
    >
      In<i style={{ color: "var(--v2-green)", fontStyle: "italic" }}>pol</i>
      <span style={{ color: "var(--v2-green)" }}>.</span>
    </span>
  );
}
