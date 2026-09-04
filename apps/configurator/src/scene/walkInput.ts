/**
 * Render-free input channel between the on-screen touch overlay (plain HTML in
 * StudioPage) and the in-canvas WalkControls (react-three-fiber). Mutated
 * imperatively and consumed once per frame, so neither side re-renders.
 */
export const walkInput = {
  /** Analog movement from the on-screen joystick, each −1..1 (0 = keyboard-only). */
  move: { f: 0, s: 0 },
  /** Look delta in screen px, accumulated since the last frame; consumed + zeroed. */
  look: { dx: 0, dy: 0 },
};

/** Zero all transient input (on walk-mode exit). */
export function resetWalkInput() {
  walkInput.move.f = 0;
  walkInput.move.s = 0;
  walkInput.look.dx = 0;
  walkInput.look.dy = 0;
}
