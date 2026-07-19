import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, DoorOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Phase = "idle" | "boarding" | "moving" | "arriving";

type FloorPanel = {
  title: string;
  label: string;
  accent: string;
  summary: string;
  cards: string[];
  walkPoints: Array<{ left: string; top: string; scale: number }>;
};

const floors: FloorPanel[] = [
  {
    title: "相片樓",
    label: "1F",
    accent: "from-amber-300 to-orange-500",
    summary: "放相片、旅行照同家庭記憶，變成小展覽。",
    cards: ["照片牆", "旅程故事", "貼紙裝飾"],
    walkPoints: [
      { left: "14%", top: "58%", scale: 1 },
      { left: "30%", top: "50%", scale: 1.03 },
      { left: "48%", top: "60%", scale: 0.98 },
    ],
  },
  {
    title: "創作樓",
    label: "2F",
    accent: "from-sky-300 to-cyan-500",
    summary: "畫畫、上色、拼貼，仲可以展示作品。",
    cards: ["畫筆工具", "顏色卡", "作品展示"],
    walkPoints: [
      { left: "18%", top: "60%", scale: 1 },
      { left: "34%", top: "52%", scale: 1.04 },
      { left: "54%", top: "57%", scale: 0.99 },
    ],
  },
  {
    title: "故事樓",
    label: "3F",
    accent: "from-violet-300 to-fuchsia-500",
    summary: "把圖片同文字變成故事，讓小朋友自己講。",
    cards: ["故事卡", "貼圖角", "說故事角"],
    walkPoints: [
      { left: "16%", top: "57%", scale: 1.02 },
      { left: "36%", top: "49%", scale: 1.06 },
      { left: "58%", top: "59%", scale: 1 },
    ],
  },
];

const motionTimings = {
  board: 420,
  travel: 850,
  arrive: 420,
};

const phaseLabel: Record<Phase, string> = {
  idle: "自己遊走",
  boarding: "人仔入緊電梯",
  moving: "人仔行緊",
  arriving: "準備到站",
};

function WalkingKid({
  phase,
  destination,
}: {
  phase: Phase;
  destination: string;
}) {
  const moving = phase === "moving";
  const boarding = phase === "boarding";

  return (
    <div
      className={[
        "relative flex flex-col items-center",
        moving ? "animate-[kidRide_0.85s_ease-in-out_infinite] scale-110" : "animate-[kidWobble_2.2s_ease-in-out_infinite]",
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

          <div
            className={`absolute left-[19%] top-11 h-7 w-3 origin-top rounded-full bg-sky-200 shadow-sm ${
              boarding ? "animate-[armSwing_0.7s_ease-in-out_infinite]" : "animate-[armSwing_1.05s_ease-in-out_infinite]"
            }`}
          />
          <div
            className={`absolute right-[19%] top-11 h-7 w-3 origin-top rounded-full bg-sky-200 shadow-sm ${
              boarding ? "animate-[armSwingReverse_0.7s_ease-in-out_infinite]" : "animate-[armSwingReverse_1.05s_ease-in-out_infinite]"
            }`}
          />

          <div className="absolute left-1/2 top-[55%] h-14 w-11 -translate-x-1/2 rounded-[1rem] bg-gradient-to-b from-slate-100 to-slate-300 shadow-[0_10px_18px_rgba(15,23,42,0.18)]" />

          <div
            className={`absolute left-[34%] top-[71%] h-11 w-3 origin-top rounded-full bg-slate-700 shadow-sm ${
              moving ? "animate-[legSwingLeft_0.5s_ease-in-out_infinite]" : "animate-[legSwingLeft_1.15s_ease-in-out_infinite]"
            }`}
          />
          <div
            className={`absolute left-[58%] top-[71%] h-11 w-3 origin-top rounded-full bg-slate-700 shadow-sm ${
              moving ? "animate-[legSwingRight_0.5s_ease-in-out_infinite]" : "animate-[legSwingRight_1.15s_ease-in-out_infinite]"
            }`}
          />

          <div className="absolute left-[29%] top-[83%] h-3 w-4 rounded-full bg-slate-800" />
          <div className="absolute right-[29%] top-[83%] h-3 w-4 rounded-full bg-slate-800" />
        </div>
      </div>

      <div className="mt-2 rounded-full bg-slate-950 px-3 py-1 text-[10px] font-bold text-white shadow-sm">
        去緊 {destination} 樓
      </div>
    </div>
  );
}

export default function KidsFloorExplorer() {
  const [activeFloorIndex, setActiveFloorIndex] = useState(1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [targetFloorIndex, setTargetFloorIndex] = useState<number | null>(null);
  const [walkIndex, setWalkIndex] = useState(0);
  const timersRef = useRef<number[]>([]);

  const activeFloor = floors[activeFloorIndex];
  const targetFloor = targetFloorIndex !== null ? floors[targetFloorIndex] : null;

  useEffect(() => {
    setWalkIndex(0);
  }, [activeFloorIndex]);

  useEffect(() => {
    if (phase !== "idle") return undefined;

    const interval = window.setInterval(() => {
      setWalkIndex((current) => (current + 1) % activeFloor.walkPoints.length);
    }, 2600);

    return () => window.clearInterval(interval);
  }, [activeFloor.walkPoints.length, phase]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const moveToFloor = (nextFloorIndex: number) => {
    if (nextFloorIndex === activeFloorIndex || phase !== "idle") return;

    clearTimers();
    setTargetFloorIndex(nextFloorIndex);
    setPhase("boarding");

    timersRef.current = [
      window.setTimeout(() => setPhase("moving"), motionTimings.board),
      window.setTimeout(() => {
        setActiveFloorIndex(nextFloorIndex);
        setPhase("arriving");
      }, motionTimings.board + motionTimings.travel),
      window.setTimeout(() => {
        setPhase("idle");
        setTargetFloorIndex(null);
      }, motionTimings.board + motionTimings.travel + motionTimings.arrive),
    ];
  };

  const goUp = () => moveToFloor(Math.min(floors.length - 1, activeFloorIndex + 1));
  const goDown = () => moveToFloor(Math.max(0, activeFloorIndex - 1));

  const guidePosition = useMemo(() => {
    if (phase !== "idle") {
      return { left: "74%", top: "52%", scale: 1.16 };
    }

    return activeFloor.walkPoints[walkIndex] ?? activeFloor.walkPoints[0];
  }, [activeFloor, phase, walkIndex]);

  const statusText =
    phase === "idle"
      ? `目前在 ${activeFloor.label} · ${activeFloor.title}`
      : targetFloor
        ? `升降機前往 ${targetFloor.label} · ${targetFloor.title}`
        : "升降機準備中";

  const floorDisplay =
    phase === "idle" || targetFloor === null
      ? activeFloor.label
      : `${activeFloor.label} → ${targetFloor.label}`;

  const panelHint =
    phase === "moving"
      ? "門已關上，升降機正在上升"
      : phase === "boarding"
        ? "小朋友正走進升降機"
        : phase === "arriving"
          ? "已到站，門即將打開"
          : "點選升降機按鈕，去另一層看看";

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,#f7fafc_0%,#eef2ff_100%)] shadow-[0_30px_80px_-45px_rgba(15,23,42,0.45)]">
      <style>{`
        @keyframes kidWobble {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-6px) rotate(1.5deg); }
        }
        @keyframes kidRide {
          0%, 100% { transform: translateX(-2px) translateY(0px) rotate(-2deg); }
          50% { transform: translateX(6px) translateY(-10px) rotate(3deg); }
        }
        @keyframes armSwing {
          0%, 100% { transform: rotate(18deg); }
          50% { transform: rotate(-18deg); }
        }
        @keyframes armSwingReverse {
          0%, 100% { transform: rotate(-18deg); }
          50% { transform: rotate(18deg); }
        }
        @keyframes legSwingLeft {
          0%, 100% { transform: rotate(20deg); }
          50% { transform: rotate(-26deg); }
        }
        @keyframes legSwingRight {
          0%, 100% { transform: rotate(-24deg); }
          50% { transform: rotate(22deg); }
        }
      `}</style>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(125,211,252,0.25),transparent_24%),radial-gradient(circle_at_55%_90%,rgba(99,102,241,0.15),transparent_28%)]" />

      <div className="relative grid gap-6 p-5 lg:grid-cols-[1.35fr_0.78fr] lg:p-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] text-white">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              Floor Tour
            </div>
            <div className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
              {statusText}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="text-sm font-bold uppercase tracking-[0.25em] text-slate-500">FLOOR</div>
                <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">升降機遊覽</h1>
                <p className="max-w-xl text-base leading-8 text-slate-600">
                  小朋友可以自己控制人仔在不同樓層遊走，再搭升降機去下一層。
                  每一層都可以放不同內容，例如相片、畫畫或故事。
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={goUp}
                  disabled={phase !== "idle" || activeFloorIndex === floors.length - 1}
                  className="rounded-full px-5"
                >
                  <ChevronUp className="h-4 w-4" />
                  上一層
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={goDown}
                  disabled={phase !== "idle" || activeFloorIndex === 0}
                  className="rounded-full px-5"
                >
                  <ChevronDown className="h-4 w-4" />
                  下一層
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {floors.map((floor, index) => {
                  const active = index === activeFloorIndex;
                  return (
                    <button
                      key={floor.label}
                      type="button"
                      onClick={() => moveToFloor(index)}
                      disabled={phase !== "idle" || active}
                      className={`rounded-[1.2rem] border px-4 py-4 text-left transition ${
                        active
                          ? "border-slate-900 bg-slate-950 text-white shadow-[0_18px_35px_-22px_rgba(15,23,42,0.6)]"
                          : "border-slate-200 bg-white/85 text-slate-700 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <div className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">{floor.label}</div>
                      <div className="mt-1 text-lg font-black">{floor.title}</div>
                      <div className={`mt-2 h-1.5 rounded-full bg-gradient-to-r ${floor.accent}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/70 bg-white/80 p-4 shadow-[0_18px_60px_-35px_rgba(15,23,42,0.55)] backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-bold uppercase tracking-[0.24em] text-slate-500">Current</div>
                  <div className="mt-1 text-2xl font-black text-slate-950">{floorDisplay}</div>
                </div>
                <div className="rounded-2xl bg-slate-950 px-3 py-2 text-right text-white">
                  <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/60">Floor</div>
                  <div className="text-xl font-black">{activeFloor.label}</div>
                </div>
              </div>

              <div
                className="relative mt-4 overflow-hidden rounded-[1.6rem] bg-[linear-gradient(180deg,#dbeafe_0%,#bfdbfe_36%,#e2e8f0_36%,#d9f99d_100%)] p-4"
                style={{ perspective: "1200px" }}
              >
                <div className="absolute inset-x-0 top-[32%] h-[1px] bg-white/65" />
                <div className="absolute inset-x-0 top-[68%] h-[1px] bg-white/65" />

                <div className="absolute left-4 top-5 rounded-full bg-slate-950/85 px-3 py-1 text-xs font-bold text-white">
                  {activeFloor.label}
                </div>

                <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
                  {activeFloor.cards.map((card, index) => (
                    <div
                      key={card}
                      className={`w-full rounded-[1.2rem] border border-white/60 bg-white/70 px-3 py-3 text-center text-sm font-semibold text-slate-800 shadow-sm transition duration-500 ${
                        index === 1 ? "translate-y-[-2px]" : ""
                      }`}
                    >
                      {card}
                    </div>
                  ))}
                </div>

                <div className="absolute right-3 top-6 h-[72%] w-[34%] rounded-[1.5rem] border border-slate-900/10 bg-slate-100/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                  <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-slate-950 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-white">
                    升降機
                  </div>

                  <div className="absolute inset-x-4 top-12 bottom-4 overflow-hidden rounded-[1.1rem] bg-[linear-gradient(180deg,#d9e2ec_0%,#f8fafc_45%,#dde5f0_100%)]">
                    <div
                      className={`absolute inset-y-0 left-0 w-1/2 bg-slate-800 transition-transform duration-700 ease-in-out ${
                        phase === "idle" ? "translate-x-0" : "-translate-x-full"
                      }`}
                    />
                    <div
                      className={`absolute inset-y-0 right-0 w-1/2 bg-slate-800 transition-transform duration-700 ease-in-out ${
                        phase === "idle" ? "translate-x-0" : "translate-x-full"
                      }`}
                    />

                    <div
                      className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-center transition-all duration-700 ${
                        phase === "moving" ? "translate-y-[-8px] scale-105" : "translate-y-0"
                      }`}
                    >
                      <div className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
                        {phase === "idle" ? "Ready" : "Moving"}
                      </div>
                      <div className="text-3xl font-black tracking-tight text-slate-950">{floorDisplay}</div>
                      <div className="text-xs font-medium text-slate-500">{panelHint}</div>
                    </div>

                    <div
                      className={`absolute left-1/2 top-[56%] -translate-x-1/2 transition-all duration-700 ${
                        phase === "moving" ? "opacity-100 scale-100" : "opacity-0 scale-75"
                      }`}
                    >
                      <div className="rounded-[1.2rem] border border-cyan-200/40 bg-cyan-50/95 px-3 py-2 text-center text-[11px] font-black uppercase tracking-[0.22em] text-cyan-800 shadow-[0_12px_28px_rgba(34,211,238,0.18)]">
                        人仔行緊
                      </div>
                      <div className="mt-2 flex justify-center">
                        <div className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold text-slate-700 shadow-sm">
                          {targetFloor ? `去 ${targetFloor.label}` : "準備出發"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={`absolute left-1/2 top-1/2 transition-[left,top,transform] duration-700 ease-in-out ${
                    phase === "moving" ? "z-20" : "z-10"
                  }`}
                  style={{
                    left: guidePosition.left,
                    top: guidePosition.top,
                    transform: `translate(-50%, -50%) scale(${guidePosition.scale})`,
                  }}
                >
                  <WalkingKid phase={phase} destination={targetFloor?.label ?? activeFloor.label} />
                </div>

                {phase !== "idle" && (
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-[56%] top-[47%] h-[2px] w-[24%] -translate-y-1/2 rounded-full bg-cyan-200/80 shadow-[0_0_18px_rgba(103,232,249,0.55)]" />
                    <div className="absolute left-[60%] top-[41%] h-2 w-2 rounded-full bg-cyan-200/90 shadow-[0_0_18px_rgba(103,232,249,0.7)]" />
                    <div className="absolute left-[66%] top-[54%] h-2 w-2 rounded-full bg-cyan-200/90 shadow-[0_0_18px_rgba(103,232,249,0.7)]" />
                    <div className="absolute left-[72%] top-[48%] h-2 w-2 rounded-full bg-cyan-200/90 shadow-[0_0_18px_rgba(103,232,249,0.7)]" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_20px_55px_-30px_rgba(15,23,42,0.8)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200/70">Guide</div>
              <div className="mt-1 text-2xl font-black">小人仔導覽員</div>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2 text-right">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-white/60">Status</div>
              <div className="text-sm font-bold">{phase === "idle" ? "四處探索" : "升降機啟動"}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <div className="rounded-[1.5rem] bg-white/10 p-4 ring-1 ring-white/10">
              <div className="text-sm font-bold text-cyan-200">玩法</div>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-white/80">
                <li>1. 用按鈕控制人仔上下一層。</li>
                <li>2. 走到升降機時，門會自動開關。</li>
                <li>3. 開始升降後，會顯示目標樓層。</li>
              </ul>
            </div>

            <div className="rounded-[1.5rem] bg-white/10 p-4 ring-1 ring-white/10">
              <div className="flex items-center gap-2 text-sm font-bold text-cyan-200">
                <DoorOpen className="h-4 w-4" />
                升降機提示
              </div>
              <p className="mt-3 text-sm leading-7 text-white/75">
                人仔一路遊覽，會清楚見到佢入電梯、移動中，同埋到站後開門。
              </p>
            </div>

            <div className="rounded-[1.5rem] bg-gradient-to-br from-cyan-500/20 to-violet-500/20 p-4 ring-1 ring-white/10">
              <div className="text-sm font-bold text-white">當前樓層內容</div>
              <p className="mt-2 text-sm leading-7 text-white/80">{activeFloor.summary}</p>
            </div>

            <div className="rounded-[1.5rem] bg-white/10 p-4 ring-1 ring-white/10">
              <div className="text-sm font-bold text-cyan-200">人仔狀態</div>
              <p className="mt-2 text-sm leading-7 text-white/80">
                {phase === "idle"
                  ? "人仔會喺每層自己走動，方便小朋友慢慢探索作品。"
                  : `而家人仔正前往 ${targetFloor?.label ?? activeFloor.label}，你會見到佢行緊同電梯門開關。`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        {statusText}
      </div>
    </section>
  );
}
