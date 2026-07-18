import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  checkAdmin, unlockAdmin, lockAdmin,
  uploadArtwork, deleteArtwork, listArtworks,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({ component: Admin });

type Item = { id: string; title: string; width: number; height: number; url: string };

const MAX = 1600;

async function fileToResizedDataUrl(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return { dataUrl: c.toDataURL("image/jpeg", 0.85), width: w, height: h };
}

function Admin() {
  const check = useServerFn(checkAdmin);
  const unlock = useServerFn(unlockAdmin);
  const lock = useServerFn(lockAdmin);
  const list = useServerFn(listArtworks);
  const upload = useServerFn(uploadArtwork);
  const del = useServerFn(deleteArtwork);

  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { check().then((r) => setUnlocked(r.unlocked)); }, []);
  useEffect(() => { if (unlocked) list().then(setItems); }, [unlocked]);

  async function onUnlock(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const r = await unlock({ data: { password: pw } });
    if (r.ok) { setUnlocked(true); setPw(""); } else setErr("密碼錯誤");
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    const f = fileRef.current?.files?.[0]; if (!f) return;
    setBusy(true);
    try {
      const { dataUrl, width, height } = await fileToResizedDataUrl(f);
      await upload({ data: { title: title || f.name, dataUrl, width, height } });
      setTitle(""); if (fileRef.current) fileRef.current.value = "";
      setItems(await list());
    } catch (e: any) { alert("上傳失敗: " + (e?.message ?? e)); }
    finally { setBusy(false); }
  }

  async function onDelete(id: string) {
    if (!confirm("確定刪除？")) return;
    await del({ data: { id } });
    setItems((xs) => xs.filter((x) => x.id !== id));
  }

  async function onLock() { await lock(); setUnlocked(false); setItems([]); }

  if (unlocked === null) return <div className="p-8 text-white">Loading…</div>;

  if (!unlocked) return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <form onSubmit={onUnlock} className="w-full max-w-sm space-y-4 border border-white/20 p-6 rounded-lg">
        <h1 className="text-xl font-semibold">Admin 登入</h1>
        <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)}
          placeholder="共用密碼" className="w-full px-3 py-2 bg-white/10 rounded outline-none" />
        {err && <p className="text-red-400 text-sm">{err}</p>}
        <button className="w-full py-2 bg-white text-black rounded font-medium">解鎖</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">3D樂園 Admin</h1>
        <button onClick={onLock} className="px-3 py-1.5 border border-white/30 rounded text-sm">Lock</button>
      </div>

      <form onSubmit={onUpload} className="space-y-3 border border-white/20 p-4 rounded-lg">
        <h2 className="font-medium">上傳作品</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="標題（可空）"
          className="w-full px-3 py-2 bg-white/10 rounded outline-none" />
        <input ref={fileRef} type="file" accept="image/*" required className="block text-sm" />
        <button disabled={busy} className="px-4 py-2 bg-white text-black rounded font-medium disabled:opacity-50">
          {busy ? "上傳中…" : "上傳"}
        </button>
      </form>

      <div>
        <h2 className="font-medium mb-3">作品列表 ({items.length})</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((it) => (
            <div key={it.id} className="border border-white/20 rounded overflow-hidden">
              <img src={it.url} alt={it.title} className="w-full h-40 object-cover" />
              <div className="p-2 text-sm flex justify-between items-center">
                <span className="truncate">{it.title}</span>
                <button onClick={() => onDelete(it.id)} className="text-red-400 text-xs ml-2">刪除</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
