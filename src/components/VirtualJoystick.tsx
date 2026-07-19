import { useEffect, useRef, useState } from "react";
import { setJoystick, clearJoystick } from "@/lib/player-input";

// Touch-friendly virtual joystick shown in bottom corners on mobile/tablet.
// Left pad = movement (forward/back + turn).
export function VirtualJoystick() {
  const padRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const activeId = useRef<number | null>(null);

  useEffect(() => {
    const el = padRef.current;
    if (!el) return;
    const RADIUS = 55;

    function updateFromTouch(clientX: number, clientY: number) {
      const rect = el!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > RADIUS) {
        dx = (dx / dist) * RADIUS;
        dy = (dy / dist) * RADIUS;
      }
      setKnob({ x: dx, y: dy });
      // forward = -dy / R (up on screen = forward), turn = dx / R
      setJoystick(-dy / RADIUS, dx / RADIUS);
    }

    function onDown(e: PointerEvent) {
      if (activeId.current !== null) return;
      activeId.current = e.pointerId;
      el!.setPointerCapture(e.pointerId);
      updateFromTouch(e.clientX, e.clientY);
    }
    function onMove(e: PointerEvent) {
      if (activeId.current !== e.pointerId) return;
      updateFromTouch(e.clientX, e.clientY);
    }
    function onUp(e: PointerEvent) {
      if (activeId.current !== e.pointerId) return;
      activeId.current = null;
      try { el!.releasePointerCapture(e.pointerId); } catch {}
      setKnob({ x: 0, y: 0 });
      clearJoystick();
    }

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-6 left-6 z-30 select-none md:hidden">
      <div
        ref={padRef}
        className="pointer-events-auto relative h-36 w-36 touch-none rounded-full border border-white/25 bg-white/10 backdrop-blur-md shadow-2xl"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85 shadow-lg transition-transform"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
        <div className="absolute inset-x-0 -top-6 text-center text-[10px] font-semibold uppercase tracking-widest text-white/80 drop-shadow">
          搖桿
        </div>
      </div>
    </div>
  );
}
