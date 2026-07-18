import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Gallery3D } from "@/components/Gallery3D";
import { listArtworks } from "@/lib/admin.functions";
import { listFloors } from "@/lib/floors.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "3D 虛擬畫廊" },
      { name: "description", content: "小朋友嘅 3D 虛擬畫廊,展示畫作同照片。" },
      { property: "og:title", content: "3D 虛擬畫廊" },
      { property: "og:description", content: "小朋友嘅 3D 虛擬畫廊,展示畫作同照片。" },
    ],
  }),
  component: Index,
});

function Index() {
  const fetchArtworks = useServerFn(listArtworks);
  const fetchFloors = useServerFn(listFloors);

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
  const current = floors[idx];
  const currentArtworks = useMemo(
    () => (current ? artworks.filter((a) => a.floorId === current.id) : []),
    [artworks, current],
  );

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
      <Gallery3D floor={{ id: current.id, theme: current.theme, layout: current.layout, artworks: currentArtworks }} />

      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-1.5 backdrop-blur">
        <div className="text-xs uppercase tracking-widest text-white/60">Floor</div>
        <div className="text-center text-lg font-bold text-white">{current.number}F · {current.name}</div>
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

      {currentArtworks.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center">
          <div className="rounded-lg bg-black/60 px-4 py-2 text-sm text-white backdrop-blur">
            呢層仲未有作品,請到 <span className="font-semibold">/admin</span> 上傳
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-black/50 px-3 py-1 text-xs text-white/80 backdrop-blur">
        拖曳滑鼠環顧四周 · 滾輪縮放 · 點擊畫作放大
      </div>
    </div>
  );
}
