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
      }} />

      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-1.5 backdrop-blur">
        <div className="text-xs uppercase tracking-widest text-white/60">Floor</div>
        <div className="text-center text-lg font-bold text-white">{current.number}F · {current.name}</div>
      </div>

      {/* Auth affordance */}
      <div className="absolute left-3 top-3 flex items-center gap-2">
        {session ? (
          <>
            <div className="rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur">
              👤 {session.user.email}
            </div>
            <button
              onClick={async () => { await supabase.auth.signOut(); qc.invalidateQueries(); }}
              className="rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur hover:bg-black/80">
              登出
            </button>
          </>
        ) : (
          <Link to="/auth"
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground backdrop-blur hover:opacity-90">
            登入 / 註冊
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
        <KidToolbar
          floorId={current.id}
          onChanged={() => qc.invalidateQueries({ queryKey: ["assets", current.id] })}
        />
      )}
    </div>
  );
}
