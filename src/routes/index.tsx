import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Gallery3D } from "@/components/Gallery3D";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "3D樂園" },
      { name: "description", content: "小朋友嘅 3D 虛擬畫廊,展示畫作同照片。" },
      { property: "og:title", content: "3D樂園" },
      { property: "og:description", content: "小朋友嘅 3D 虛擬畫廊。" },
    ],
  }),
  component: Index,
});

const MAX_FLOOR = 2;
const MIN_FLOOR = 1;

function Index() {
  const [floor, setFloor] = useState<1 | 2>(1);
  const artworks: never[] = []; // Task 6 會由 server 讀取

  const goUp = () => setFloor((f) => (f < MAX_FLOOR ? ((f + 1) as 1 | 2) : f));
  const goDown = () => setFloor((f) => (f > MIN_FLOOR ? ((f - 1) as 1 | 2) : f));

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <Gallery3D floor={floor} artworks={artworks} />

      {/* Floor label */}
      <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-1.5 backdrop-blur">
        <div className="text-xs uppercase tracking-widest text-white/60">Floor</div>
        <div className="text-center text-lg font-bold text-white">{floor}F</div>
      </div>

      {/* Floor switcher (下一層 / 上一層) */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={goUp}
          disabled={floor >= MAX_FLOOR}
          className="rounded-lg bg-black/60 px-3 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-30"
        >
          ↑ 上一層
        </button>
        <button
          onClick={goDown}
          disabled={floor <= MIN_FLOOR}
          className="rounded-lg bg-black/60 px-3 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-30"
        >
          ↓ 下一層
        </button>
      </div>

      {/* Empty state (1F only) */}
      {floor === 1 && artworks.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center">
          <div className="rounded-lg bg-black/60 px-4 py-2 text-sm text-white backdrop-blur">
            目前沒有作品,請到 <span className="font-semibold">/admin</span> 上傳
          </div>
        </div>
      )}

      {/* 2F hint */}
      {floor === 2 && (
        <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center">
          <div className="rounded-lg bg-black/60 px-4 py-2 text-sm text-white backdrop-blur">
            2F 空房間(預留擴展)
          </div>
        </div>
      )}

      {/* Controls hint */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-black/50 px-3 py-1 text-xs text-white/80 backdrop-blur">
        拖曳滑鼠環顧四周 · 滾輪縮放
      </div>
    </div>
  );
}
