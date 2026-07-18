import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Gallery3D } from "@/components/Gallery3D";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "3D樂園" },
      { name: "description", content: "小朋友嘅 3D 虛擬畫廊，展示畫作同照片。" },
      { property: "og:title", content: "3D樂園" },
      { property: "og:description", content: "小朋友嘅 3D 虛擬畫廊。" },
    ],
  }),
  component: Index,
});

function Index() {
  const [floor, setFloor] = useState<1 | 2>(1);
  const artworks: never[] = []; // Task 6 會由 server 讀取

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <Gallery3D floor={floor} artworks={artworks} />

      {/* Floor switcher */}
      <div className="absolute top-4 left-4 flex gap-2 rounded-lg bg-black/60 p-2 backdrop-blur">
        <button
          onClick={() => setFloor(1)}
          className={`rounded px-3 py-1.5 text-sm font-medium transition ${
            floor === 1 ? "bg-white text-black" : "text-white hover:bg-white/10"
          }`}
        >
          1F
        </button>
        <button
          onClick={() => setFloor(2)}
          className={`rounded px-3 py-1.5 text-sm font-medium transition ${
            floor === 2 ? "bg-white text-black" : "text-white hover:bg-white/10"
          }`}
        >
          2F
        </button>
      </div>

      {/* Empty state */}
      {floor === 1 && artworks.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center">
          <div className="rounded-lg bg-black/60 px-4 py-2 text-sm text-white backdrop-blur">
            目前沒有作品，請到 <span className="font-semibold">/admin</span> 上傳
          </div>
        </div>
      )}

      {/* Hint */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-black/50 px-3 py-1 text-xs text-white/80 backdrop-blur">
        拖曳滑鼠環顧四周 · 滾輪縮放
      </div>
    </div>
  );
}
