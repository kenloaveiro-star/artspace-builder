import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { Gallery3D } from "@/components/Gallery3D";
import { KidToolbar } from "@/components/KidToolbar";
import { VirtualJoystick } from "@/components/VirtualJoystick";
import { listArtworks } from "@/lib/admin.functions";
import { listFloors } from "@/lib/floors.functions";
import { listFloorAssets } from "@/lib/floor-assets.functions";
import { checkMyRole, claimCreatorRole, kidMoveAsset, kidTransformAsset, kidDeleteAsset } from "@/lib/kid-tools.functions";
import { supabase } from "@/integrations/supabase/client";



type RidePhase = "idle" | "opening" | "moving" | "arriving";
type FloorInfo = { number: number; name: string };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "3D 虛擬畫廊" },
      { name: "description", content: "小朋友嘅 3D 虛擬畫廊，可以坐升降機去唔同樓層創作。" },
      { property: "og:title", content: "3D 虛擬畫廊" },
      { property: "og:description", content: "小朋友嘅 3D 虛擬畫廊，可以坐升降機去唔同樓層創作。" },
    ],
  }),
  component: Index,
});

function Index() {
  const qc = useQueryClient();
  const fetchArtworks = useServerFn(listArtworks);
  const fetchFloors = useServerFn(listFloors);
  const fetchAssets = useServerFn(listFloorAssets);
  const rideTimers = useRef<number[]>([]);

  const { data: floors = [] } = useQuery({
    queryKey: ["floors"],
    queryFn: () => fetchFloors(),
    staleTime: 30_000,
  });
  const { data: artworks = [] } = useQuery({
    queryKey: ["artworks"],
    queryFn: () => fetchArtworks(),
    staleTime: 30_000,
  });

  const [idx, setIdx] = useState(0);
  const [targetIdx, setTargetIdx] = useState<number | null>(null);
  const [ridePhase, setRidePhase] = useState<RidePhase>("idle");
  const [rideDirection, setRideDirection] = useState<1 | -1>(1);
  const [elevatorOpen, setElevatorOpen] = useState(false);
  const current = floors[idx];
  const target = targetIdx == null ? null : floors[targetIdx];

  const { data: assets = [] } = useQuery({
    queryKey: ["assets", current?.id],
    queryFn: () => fetchAssets({ data: { floorId: current!.id } }),
    enabled: !!current,
    staleTime: 10_000,
  });

  const currentArtworks = useMemo(
    () => (current ? artworks.filter((a) => a.floorId === current.id) : []),
    [artworks, current],
  );

  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const checkRole = useServerFn(checkMyRole);
  const moveAsset = useServerFn(kidMoveAsset);
  const transformAsset = useServerFn(kidTransformAsset);
  const { data: roleData } = useQuery({
    queryKey: ["my-role", session?.user.id],
    queryFn: () => checkRole(),
    enabled: !!session,
    staleTime: 60_000,
  });
  const canEdit = !!roleData?.isCreator;

  useEffect(() => {
    if (idx > floors.length - 1) {
      setIdx(Math.max(0, floors.length - 1));
    }
  }, [floors.length, idx]);

  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel("floor-" + current.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "floor_assets", filter: "floor_id=eq." + current.id },
        () => {
          qc.invalidateQueries({ queryKey: ["assets", current.id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "artworks", filter: "floor_id=eq." + current.id },
        () => {
          qc.invalidateQueries({ queryKey: ["artworks"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "floors", filter: "id=eq." + current.id },
        () => {
          qc.invalidateQueries({ queryKey: ["floors"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [current?.id, qc]);

  useEffect(() => {
    return () => {
      rideTimers.current.forEach((timer) => window.clearTimeout(timer));
      rideTimers.current = [];
    };
  }, []);

  function clearRideTimers() {
    rideTimers.current.forEach((timer) => window.clearTimeout(timer));
    rideTimers.current = [];
  }

  function rideTo(nextIdx: number) {
    if (!floors[nextIdx]) return;
    if (ridePhase !== "idle") return;
    if (nextIdx === idx) return;

    clearRideTimers();
    setTargetIdx(nextIdx);
    setRideDirection(nextIdx > idx ? 1 : -1);
    setRidePhase("opening");

    rideTimers.current.push(
      window.setTimeout(() => {
        setRidePhase("moving");
      }, 650),
    );
    rideTimers.current.push(
      window.setTimeout(() => {
        setIdx(nextIdx);
      }, 1200),
    );
    rideTimers.current.push(
      window.setTimeout(() => {
        setRidePhase("arriving");
      }, 1700),
    );
    rideTimers.current.push(
      window.setTimeout(() => {
        setRidePhase("idle");
        setTargetIdx(null);
        clearRideTimers();
      }, 2550),
    );
  }

  const rideTarget = target ?? current;

  if (!current) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
        {floors.length === 0 ? "載入中…" : "無樓層資料"}
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <Gallery3D
        floor={{
          id: current.id,
          theme: current.theme,
          layout: current.layout,
          artworks: currentArtworks,
          assets,
          wallTextureUrl: current.wallTextureUrl,
          floorTextureUrl: current.floorTextureUrl,
        }}
        canEdit={canEdit}
        onMoveAsset={async (id, x, z) => {
          try {
            await moveAsset({ data: { id, x, z } });
            qc.invalidateQueries({ queryKey: ["assets", current.id] });
          } catch (e) {
            console.error(e);
          }
        }}
        onTransformAsset={async (id, patch) => {
          try {
            await transformAsset({ data: { id, ...patch } });
            qc.invalidateQueries({ queryKey: ["assets", current.id] });
          } catch (e) {
            console.error(e);
          }
        }}
      />

      <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-4 py-1.5 backdrop-blur-xl">
        <div className="text-[10px] uppercase tracking-[0.35em] text-white/45">
          {ridePhase === "idle" ? "Floor" : "Elevator"}
        </div>
        <div className="text-center text-lg font-bold text-white">
          {ridePhase === "idle"
            ? current.number + "F · " + current.name
            : "前往 " + (rideTarget?.number ?? current.number) + "F"}
        </div>
      </div>

      <div className="absolute left-3 top-3 z-20">
        {session ? (
          <AuthMenu
            session={session}
            onSignOut={async () => {
              await supabase.auth.signOut();
              qc.invalidateQueries();
            }}
          />
        ) : (
          <Link
            to="/auth"
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:opacity-90"
          >
            登入
          </Link>
        )}
      </div>

      {!elevatorOpen && (
        <button
          onClick={() => setElevatorOpen(true)}
          className="absolute right-3 top-3 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-xl hover:bg-black/85"
          aria-label="開啟電梯控制"
        >
          🛗 <span>電梯 · {current.number}F</span>
        </button>
      )}

      <div
        className={
          "absolute right-0 top-0 z-30 h-full w-[min(92vw,340px)] border-l border-white/10 bg-black/70 p-4 shadow-2xl backdrop-blur-xl transition-transform duration-300 " +
          (elevatorOpen ? "translate-x-0" : "translate-x-full")
        }
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-white/45">Elevator Control</div>
            <div className="mt-1 text-sm text-white/70">揀層數，升降機帶你去。</div>
          </div>
          <button
            onClick={() => setElevatorOpen(false)}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/15"
            aria-label="收起電梯控制"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className={"rounded-full px-2.5 py-1 text-[10px] font-semibold " + (ridePhase === "idle" ? "bg-emerald-400/15 text-emerald-200" : "bg-cyan-400/15 text-cyan-100") }>
            {ridePhase === "idle" ? "READY" : "RIDE"}
          </div>
          <div className="text-xs text-white/55">現在 {current.number}F</div>
        </div>

        <div className="mt-3 grid max-h-[45vh] grid-cols-2 gap-2 overflow-auto pr-1">
          {floors.map((floor, floorIndex) => {
            const active = floorIndex === idx;
            const selected = floorIndex === targetIdx;
            const locked = ridePhase !== "idle";
            return (
              <button
                key={floor.id}
                onClick={() => rideTo(floorIndex)}
                disabled={locked}
                className={
                  "rounded-2xl border px-3 py-2 text-left transition " +
                  (active
                    ? "border-cyan-300/40 bg-cyan-300/15 text-white"
                    : selected
                      ? "border-fuchsia-300/50 bg-fuchsia-300/15 text-white"
                      : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10") +
                  (locked ? " cursor-not-allowed opacity-70" : "")
                }
              >
                <div className="text-[10px] uppercase tracking-[0.28em] text-white/45">{floor.number}F</div>
                <div className="mt-1 text-sm font-semibold">{floor.name}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => rideTo(Math.min(idx + 1, floors.length - 1))}
            disabled={ridePhase !== "idle" || idx >= floors.length - 1}
            className="flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            上一層
          </button>
          <button
            onClick={() => rideTo(Math.max(idx - 1, 0))}
            disabled={ridePhase !== "idle" || idx <= 0}
            className="flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            下一層
          </button>
        </div>
      </div>


      {ridePhase === "idle" && <VirtualJoystick />}


      {ridePhase !== "idle" && rideTarget && (
        <ElevatorRideOverlay
          phase={ridePhase}
          direction={rideDirection}
          fromFloor={{ number: current.number, name: current.name }}
          toFloor={{ number: rideTarget.number, name: rideTarget.name }}
        />
      )}

      {session && current && ridePhase === "idle" && (
        <CreatorGate session={session}>
          <KidToolbar
            floorId={current.id}
            onChanged={async () => {
              await qc.refetchQueries({ queryKey: ["assets", current.id] });
              await qc.refetchQueries({ queryKey: ["artworks"] });
            }}
          />
        </CreatorGate>
      )}
    </div>
  );
}

function ElevatorRideOverlay({
  phase,
  direction,
  fromFloor,
  toFloor,
}: {
  phase: RidePhase;
  direction: 1 | -1;
  fromFloor: FloorInfo;
  toFloor: FloorInfo;
}) {
  const doorsOpen = phase === "opening" || phase === "arriving";
  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
      <div className="relative h-[min(82vw,460px)] w-[min(86vw,380px)] overflow-hidden rounded-[2.25rem] border border-white/15 bg-slate-950/95 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.18),transparent_35%)]" />
        <div className="absolute inset-x-6 top-5 flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/55">
          <span>Elevator</span>
          <span>{phase === "moving" ? "RUNNING" : doorsOpen ? "OPEN" : "CLOSED"}</span>
        </div>

        <div className="absolute left-1/2 top-16 flex h-[70%] w-[66%] -translate-x-1/2 items-center justify-center overflow-hidden rounded-[1.8rem] border border-white/10 bg-gradient-to-b from-white/10 to-white/5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.35),transparent_45%),linear-gradient(180deg,rgba(2,6,23,0.95),rgba(15,23,42,0.92))]" />
          <div
            className="absolute left-0 top-0 h-full w-1/2 border-r border-slate-50/10 bg-gradient-to-r from-slate-200/95 to-slate-500/85 transition-transform duration-700 ease-in-out"
            style={{ transform: doorsOpen ? "translateX(-100%)" : "translateX(0%)" }}
          />
          <div
            className="absolute right-0 top-0 h-full w-1/2 border-l border-slate-50/10 bg-gradient-to-l from-slate-200/95 to-slate-500/85 transition-transform duration-700 ease-in-out"
            style={{ transform: doorsOpen ? "translateX(100%)" : "translateX(0%)" }}
          />

          <div className={"relative z-10 flex h-full w-full flex-col items-center justify-between p-4 text-white transition-transform duration-700 " + (phase === "moving" ? "-translate-y-1" : "translate-y-0") }>
            <div className="flex w-full items-center justify-between text-[11px] uppercase tracking-[0.35em] text-cyan-100/55">
              <span>Ride</span>
              <span>{fromFloor.number}F → {toFloor.number}F</span>
            </div>

            <div className="flex flex-1 items-center justify-center py-4">
              <div className="text-6xl font-black tracking-widest text-white/90 drop-shadow-lg">
                {phase === "moving" ? `${toFloor.number}F` : "···"}
              </div>
            </div>


            <div className="w-full">
              <div className="flex items-center justify-between text-xs text-white/55">
                <span>{fromFloor.number}F</span>
                <span>{toFloor.number}F</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={
                    "h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-fuchsia-300 transition-all duration-700 " +
                    (phase === "opening" ? "w-[20%]" : phase === "moving" ? "w-[72%]" : "w-[100%]")
                  }
                />
              </div>
              <div className="mt-3 text-center text-sm text-white/75">
                {phase === "opening"
                  ? "門已打開"
                  : phase === "moving"
                    ? (direction > 0 ? "升緊去上面樓層" : "落緊去下面樓層")
                    : "到站，請準備出門"}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-8 bottom-5 flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-white/40">
          <span>{direction > 0 ? "UP" : "DOWN"}</span>
          <span>Artspace Tour</span>
        </div>
      </div>
    </div>
  );
}

function CreatorGate({ session, children }: { session: Session; children: React.ReactNode }) {
  const qc = useQueryClient();
  const check = useServerFn(checkMyRole);
  const claim = useServerFn(claimCreatorRole);
  const { data, isLoading } = useQuery({
    queryKey: ["my-role", session.user.id],
    queryFn: () => check(),
    staleTime: 60_000,
  });
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (isLoading) return null;
  if (data?.isCreator) return <>{children}</>;

  async function onClaim() {
    setBusy(true);
    setErr(null);
    try {
      await claim({ data: { password: pw } });
      await qc.invalidateQueries({ queryKey: ["my-role", session.user.id] });
      setOpen(false);
      setPw("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-black/85 px-5 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur hover:bg-black"
        >
          申請創作權限
        </button>
      ) : (
        <div className="w-full max-w-sm rounded-2xl bg-neutral-900/95 p-4 text-white shadow-2xl backdrop-blur">
          <div className="mb-2 text-sm font-semibold">輸入管理員密碼以啟用創作工具</div>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="管理員密碼"
            autoFocus
            className="w-full rounded-lg bg-neutral-800 p-2 text-sm outline-none ring-1 ring-transparent focus:ring-primary"
          />
          {err && <div className="mt-2 text-xs text-red-400">⚠️ {err}</div>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={onClaim}
              disabled={busy || !pw}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "驗證中…" : "確認"}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setPw("");
                setErr(null);
              }}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AuthMenu({ session, onSignOut }: { session: Session; onSignOut: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const email = session.user.email ?? "";
  const initial = (email[0] ?? "?").toUpperCase();
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="帳戶"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-xs font-bold text-white/80 backdrop-blur transition hover:bg-black/70"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute left-0 top-10 min-w-[180px] rounded-lg bg-black/85 p-2 text-xs text-white shadow-xl backdrop-blur">
          <div className="truncate px-2 py-1 text-white/60">{email}</div>
          <button
            onClick={async () => {
              setOpen(false);
              await onSignOut();
            }}
            className="mt-1 w-full rounded px-2 py-1.5 text-left hover:bg-white/10"
          >
            登出
          </button>
        </div>
      )}
    </div>
  );
}
