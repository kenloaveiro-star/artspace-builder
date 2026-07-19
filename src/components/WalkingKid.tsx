// Animated walking-kid character extracted from KidsFloorExplorer.
// Reusable overlay figure with wobble / ride / walk animations.

export type WalkingKidPhase = "idle" | "boarding" | "moving" | "arriving";

const phaseLabel: Record<WalkingKidPhase, string> = {
  idle: "自己遊走",
  boarding: "人仔入緊電梯",
  moving: "人仔行緊",
  arriving: "準備到站",
};

export function WalkingKid({
  phase,
  destination,
}: {
  phase: WalkingKidPhase;
  destination?: string;
}) {
  const moving = phase === "moving";
  const boarding = phase === "boarding";

  return (
    <>
      <style>{`
        @keyframes kidWobble { 0%,100% { transform: translateY(0) rotate(-1deg);} 50% { transform: translateY(-6px) rotate(1.5deg);} }
        @keyframes kidRide { 0%,100% { transform: translateX(-2px) translateY(0) rotate(-2deg);} 50% { transform: translateX(6px) translateY(-10px) rotate(3deg);} }
        @keyframes armSwing { 0%,100% { transform: rotate(18deg);} 50% { transform: rotate(-18deg);} }
        @keyframes armSwingReverse { 0%,100% { transform: rotate(-18deg);} 50% { transform: rotate(18deg);} }
        @keyframes legSwingLeft { 0%,100% { transform: rotate(20deg);} 50% { transform: rotate(-26deg);} }
        @keyframes legSwingRight { 0%,100% { transform: rotate(-24deg);} 50% { transform: rotate(22deg);} }
      `}</style>
      <div
        className={[
          "relative flex flex-col items-center",
          moving
            ? "animate-[kidRide_0.85s_ease-in-out_infinite] scale-110"
            : "animate-[kidWobble_2.2s_ease-in-out_infinite]",
        ].join(" ")}
      >
        <div className="mb-2 rounded-full border border-white/80 bg-white/95 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 shadow-sm">
          {phaseLabel[phase]}
        </div>

        <div className="relative">
          <div className="absolute -bottom-3 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-slate-900/20 blur-md" />
          <div className="relative h-36 w-28">
            <div className="absolute left-1/2 top-0 h-11 w-11 -translate-x-1/2 rounded-full bg-gradient-to-br from-amber-100 to-amber-300 ring-2 ring-white/45 shadow-[0_10px_24px_rgba(251,191,36,0.32)]" />
            <div className="absolute left-1/2 top-1 h-4 w-4 -translate-x-[70%] rounded-full bg-slate-950/80" />
            <div className="absolute left-1/2 top-1 h-4 w-4 translate-x-[25%] rounded-full bg-slate-950/80" />
            <div className="absolute left-1/2 top-3 h-1.5 w-4 -translate-x-1/2 rounded-full bg-slate-950/80" />
            <div className="absolute left-1/2 top-10 h-12 w-12 -translate-x-1/2 rounded-[1.25rem] bg-gradient-to-b from-sky-300 via-sky-500 to-sky-700 ring-2 ring-white/40 shadow-[0_12px_24px_rgba(14,165,233,0.32)]" />
            <div className={`absolute left-[19%] top-11 h-7 w-3 origin-top rounded-full bg-sky-200 shadow-sm ${boarding ? "animate-[armSwing_0.7s_ease-in-out_infinite]" : "animate-[armSwing_1.05s_ease-in-out_infinite]"}`} />
            <div className={`absolute right-[19%] top-11 h-7 w-3 origin-top rounded-full bg-sky-200 shadow-sm ${boarding ? "animate-[armSwingReverse_0.7s_ease-in-out_infinite]" : "animate-[armSwingReverse_1.05s_ease-in-out_infinite]"}`} />
            <div className="absolute left-1/2 top-[55%] h-14 w-11 -translate-x-1/2 rounded-[1rem] bg-gradient-to-b from-slate-100 to-slate-300 shadow-[0_10px_18px_rgba(15,23,42,0.18)]" />
            <div className={`absolute left-[34%] top-[71%] h-11 w-3 origin-top rounded-full bg-slate-700 shadow-sm ${moving ? "animate-[legSwingLeft_0.5s_ease-in-out_infinite]" : "animate-[legSwingLeft_1.15s_ease-in-out_infinite]"}`} />
            <div className={`absolute left-[58%] top-[71%] h-11 w-3 origin-top rounded-full bg-slate-700 shadow-sm ${moving ? "animate-[legSwingRight_0.5s_ease-in-out_infinite]" : "animate-[legSwingRight_1.15s_ease-in-out_infinite]"}`} />
            <div className="absolute left-[29%] top-[83%] h-3 w-4 rounded-full bg-slate-800" />
            <div className="absolute right-[29%] top-[83%] h-3 w-4 rounded-full bg-slate-800" />
          </div>
        </div>

        {destination && (
          <div className="mt-4 rounded-full bg-slate-950 px-3 py-1 text-[10px] font-bold text-white shadow-sm">
            去緊 {destination}
          </div>
        )}
      </div>
    </>
  );
}
