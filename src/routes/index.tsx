import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { Gallery3D } from "@/components/Gallery3D";
import { KidToolbar } from "@/components/KidToolbar";
import { listArtworks } from "@/lib/admin.functions";
import { listFloors } from "@/lib/floors.functions";
import { listFloorAssets } from "@/lib/floor-assets.functions";
import { checkMyRole, claimCreatorRole } from "@/lib/kid-tools.functions";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "3D 虛擬畫廊" },
      { name: "description", content: "小朋友嘅 3D 虛擬畫廊,可以上載相片、講嘢改樓層。" },
      { property: "og:title", content: "3D 虛擬畫廊" },
      { property: "og:description", content: "小朋友嘅 3D 虛擬畫廊,可以上載相片、講嘢改樓層。" },
    ],
  }),
  component: Index,
});

function Index() {
  const qc = useQueryClient();
  const fetchArtworks = useServerFn(listArtworks);
  const fetchFloors = useServerFn(listFloors);
  const fetchAssets = useServerFn(listFloorAssets);

  const { data: floors = [] } = useQuery({
    queryKey: ["floors"], queryFn: () => fetchFloors(), staleTime: 30_000,
  });
  const { data: artworks = [] } = useQuery({
    queryKey: ["artworks"], queryFn: () => fetchArtworks(), staleTime: 30_000,
  });

  const [idx, setIdx] = useState(0);
  const current = floors[idx];

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

  // Realtime: 樓層資產 / 畫作變咗就自動 refetch (多裝置同步)
  useEffect(() => {
    if (!current) return;
    const ch = supabase
      .channel(`floor-${current.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "floor_assets", filter: `floor_id=eq.${current.id}` },
        () => { qc.invalidateQueries({ queryKey: ["assets", current.id] }); })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "artworks", filter: `floor_id=eq.${current.id}` },
        () => { qc.invalidateQueries({ queryKey: ["artworks"] }); })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "floors", filter: `id=eq.${current.id}` },
        () => { qc.invalidateQueries({ queryKey: ["floors"] }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [current?.id, qc]);

  const goUp = () => setIdx((i) => Math.min(i + 1, floors.length - 1));
  const goDown = () => setIdx((i) => Math.max(i - 1, 0));

  if (!current) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
        {floors.length === 0 ? "載入中…" : "無樓層資料"}
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <Gallery3D floor={{
        id: current.id, theme: current.theme, layout: current.layout,
        artworks: currentArtworks, assets,
        wallTextureUrl: current.wallTextureUrl, floorTextureUrl: current.floorTextureUrl,
      }} />

      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-1.5 backdrop-blur">
        <div className="text-xs uppercase tracking-widest text-white/60">Floor</div>
        <div className="text-center text-lg font-bold text-white">{current.number}F · {current.name}</div>
      </div>

      {/* Auth affordance – 隱蔽小 avatar,點擊展開 */}
      <div className="absolute left-3 top-3 z-20">
        {session ? (
          <AuthMenu session={session} onSignOut={async () => { await supabase.auth.signOut(); qc.invalidateQueries(); }} />
        ) : (
          <Link to="/auth"
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:opacity-90">
            登入
          </Link>
        )}
      </div>


      <div className="absolute right-4 top-4 flex flex-col gap-2">
        <button onClick={goUp} disabled={idx >= floors.length - 1}
          className="rounded-lg bg-black/60 px-3 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-30">
          ↑ 上一層
        </button>
        <button onClick={goDown} disabled={idx <= 0}
          className="rounded-lg bg-black/60 px-3 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-30">
          ↓ 下一層
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 rounded bg-black/50 px-3 py-1 text-xs text-white/80 backdrop-blur">
        拖曳環顧 · 滾輪縮放 · 點擊畫作放大
      </div>

      {session && current && (
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
    setBusy(true); setErr(null);
    try {
      await claim({ data: { password: pw } });
      await qc.invalidateQueries({ queryKey: ["my-role", session.user.id] });
      setOpen(false); setPw("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4">
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="rounded-full bg-black/85 px-5 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur hover:bg-black">
          🔒 申請創作權限
        </button>
      ) : (
        <div className="w-full max-w-sm rounded-2xl bg-neutral-900/95 p-4 text-white shadow-2xl backdrop-blur">
          <div className="mb-2 text-sm font-semibold">🔑 輸入管理員密碼以啟用創作工具</div>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
            placeholder="管理員密碼" autoFocus
            className="w-full rounded-lg bg-neutral-800 p-2 text-sm outline-none ring-1 ring-transparent focus:ring-primary" />
          {err && <div className="mt-2 text-xs text-red-400">⚠️ {err}</div>}
          <div className="mt-3 flex gap-2">
            <button onClick={onClaim} disabled={busy || !pw}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {busy ? "驗證中…" : "確認"}
            </button>
            <button onClick={() => { setOpen(false); setPw(""); setErr(null); }}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm">取消</button>
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
        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-xs font-bold text-white/80 backdrop-blur transition hover:bg-black/70">
        {initial}
      </button>
      {open && (
        <div className="absolute left-0 top-10 min-w-[180px] rounded-lg bg-black/85 p-2 text-xs text-white shadow-xl backdrop-blur">
          <div className="truncate px-2 py-1 text-white/60">{email}</div>
          <button
            onClick={async () => { setOpen(false); await onSignOut(); }}
            className="mt-1 w-full rounded px-2 py-1.5 text-left hover:bg-white/10">
            登出
          </button>
        </div>
      )}
    </div>
  );
}


