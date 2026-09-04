import { useRef } from "react";
import { walkInput } from "../scene/walkInput";

/**
 * On-screen walkthrough controls for touch devices (factory tablets):
 *  - a left thumb-stick drives movement (walkInput.move),
 *  - dragging anywhere else looks around (walkInput.look).
 * Rendered only on coarse-pointer devices; desktop uses mouse-lock + WASD.
 * Uses Pointer Events, so it also works with a mouse if ever shown.
 */
export function WalkTouchControls() {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const joyId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lookPrev = useRef<{ x: number; y: number } | null>(null);

  const setJoy = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const R = r.width / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(len, R);
    const nx = (dx / len) * cl;
    const ny = (dy / len) * cl;
    if (knob.current) knob.current.style.transform = `translate(${nx}px, ${ny}px)`;
    walkInput.move.s = +(nx / R).toFixed(3); // strafe (right +)
    walkInput.move.f = +(-ny / R).toFixed(3); // forward (up +)
  };
  const endJoy = () => {
    joyId.current = null;
    walkInput.move.f = 0;
    walkInput.move.s = 0;
    if (knob.current) knob.current.style.transform = "";
  };

  return (
    <>
      <div
        className="walk-lookpad"
        onPointerDown={(e) => {
          lookId.current = e.pointerId;
          lookPrev.current = { x: e.clientX, y: e.clientY };
          (e.target as Element).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (e.pointerId !== lookId.current || !lookPrev.current) return;
          walkInput.look.dx += e.clientX - lookPrev.current.x;
          walkInput.look.dy += e.clientY - lookPrev.current.y;
          lookPrev.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => { lookId.current = null; lookPrev.current = null; }}
        onPointerCancel={() => { lookId.current = null; lookPrev.current = null; }}
      />
      <div
        ref={base}
        className="walk-joy"
        onPointerDown={(e) => {
          joyId.current = e.pointerId;
          (e.target as Element).setPointerCapture(e.pointerId);
          setJoy(e);
        }}
        onPointerMove={(e) => { if (e.pointerId === joyId.current) setJoy(e); }}
        onPointerUp={endJoy}
        onPointerCancel={endJoy}
      >
        <div ref={knob} className="walk-joy-knob" />
      </div>
    </>
  );
}
