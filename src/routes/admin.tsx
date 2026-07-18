import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  checkAdmin, unlockAdmin, lockAdmin,
  uploadArtwork, deleteArtwork, listArtworks,
} from "@/lib/admin.functions";
import {
  listFloors, createFloor, updateFloor, deleteFloor,
  type FloorTheme, type FloorLayout,
} from "@/lib/floors.functions";
import { generateFloorScene } from "@/lib/ai-floor.functions";

export const Route = createFileRoute("/admin")({ component: Admin });

type Item = { id: string; title: string; width: number; height: number; url: string; floorId: string };
type FloorRow = { id: string; number: number; name: string; theme: FloorTheme; layout: FloorLayout; artworkCount: number };

const MAX = 1600;
const THEME_OPTS: { v: FloorTheme; label: string }[] = [
  { v: "wood", label: "木系畫廊" }, { v: "marble", label: "大理石" },
  { v: "dark", label: "黑盒展廳" }, { v: "outdoor", label: "戶外庭園" },
];
const LAYOUT_OPTS: { v: FloorLayout; label: string }[] = [
  { v: "rect4", label: "四面牆" }, { v: "corridor", label: "長廊" }, { v: "round", label: "圓形展廳" },
];

async function fileToResizedDataUrl(file: File) {
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
  const listFl = useServerFn(listFloors);
  const createFl = useServerFn(createFloor);
  const updateFl = useServerFn(updateFloor);
  const deleteFl = useServerFn(deleteFloor);

  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [floors, setFloors] = useState<FloorRow[]>([]);
  const [title, setTitle] = useState("");
  const [uploadFloor, setUploadFloor] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // New floor form
  const [nfNumber, setNfNumber] = useState(2);
  const [nfName, setNfName] = useState("");
  const [nfTheme, setNfTheme] = useState<FloorTheme>("wood");
  const [nfLayout, setNfLayout] = useState<FloorLayout>("rect4");

  const reload = async () => {
    const [fl, its] = await Promise.all([listFl(), list()]);
    setFloors(fl);
    setItems(its);
    if (!uploadFloor && fl.length > 0) setUploadFloor(fl[0].id);
    const nextNum = fl.length > 0 ? Math.max(...fl.map((f) => f.number)) + 1 : 1;
    setNfNumber(nextNum);
  };

  useEffect(() => { check().then((r) => setUnlocked(r.unlocked)); }, []);
  useEffect(() => { if (unlocked) reload(); }, [unlocked]);

  async function onUnlock(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const r = await unlock({ data: { password: pw } });
    if (r.ok) { setUnlocked(true); setPw(""); } else setErr("密碼錯誤");
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    const f = fileRef.current?.files?.[0]; if (!f || !uploadFloor) return;
    setBusy(true);
    try {
      const { dataUrl, width, height } = await fileToResizedDataUrl(f);
      await upload({ data: { title: title || f.name, dataUrl, width, height, floorId: uploadFloor } });
      setTitle(""); if (fileRef.current) fileRef.current.value = "";
      await reload();
    } catch (e: any) { alert("上傳失敗: " + (e?.message ?? e)); }
    finally { setBusy(false); }
  }

  async function onDelete(id: string) {
    if (!confirm("確定刪除？")) return;
    await del({ data: { id } });
    await reload();
  }

  async function onLock() { await lock(); setUnlocked(false); setItems([]); setFloors([]); }

  async function onCreateFloor(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createFl({ data: { number: nfNumber, name: nfName || `${nfNumber}F`, theme: nfTheme, layout: nfLayout } });
      setNfName("");
      await reload();
    } catch (e: any) { alert(e?.message ?? String(e)); }
  }

  async function onUpdateFloor(f: FloorRow) {
    const name = prompt("樓層名稱", f.name) ?? f.name;
    const theme = (prompt(`主題 (${THEME_OPTS.map((t) => t.v).join("/")})`, f.theme) as FloorTheme) ?? f.theme;
    const layout = (prompt(`Layout (${LAYOUT_OPTS.map((l) => l.v).join("/")})`, f.layout) as FloorLayout) ?? f.layout;
    if (!THEME_OPTS.find((t) => t.v === theme) || !LAYOUT_OPTS.find((l) => l.v === layout)) {
      alert("無效嘅主題或 layout"); return;
    }
    await updateFl({ data: { id: f.id, name, theme, layout } });
    await reload();
  }

  async function onDeleteFloor(f: FloorRow) {
    if (f.artworkCount > 0) { alert(`該樓層仲有 ${f.artworkCount} 幅作品,請先刪除`); return; }
    if (!confirm(`確定刪除 ${f.number}F ${f.name}？`)) return;
    try { await deleteFl({ data: { id: f.id } }); await reload(); }
    catch (e: any) { alert(e?.message ?? String(e)); }
  }

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

      {/* 樓層管理 */}
      <section className="space-y-3 border border-white/20 p-4 rounded-lg">
        <h2 className="font-medium">樓層管理</h2>
        <table className="w-full text-sm">
          <thead className="text-white/60">
            <tr><th className="text-left py-1">#</th><th className="text-left">名</th><th className="text-left">主題</th><th className="text-left">Layout</th><th className="text-left">作品</th><th></th></tr>
          </thead>
          <tbody>
            {floors.map((f) => (
              <tr key={f.id} className="border-t border-white/10">
                <td className="py-1.5">{f.number}F</td>
                <td>{f.name}</td>
                <td>{THEME_OPTS.find((t) => t.v === f.theme)?.label ?? f.theme}</td>
                <td>{LAYOUT_OPTS.find((l) => l.v === f.layout)?.label ?? f.layout}</td>
                <td>{f.artworkCount}</td>
                <td className="text-right space-x-2">
                  <button onClick={() => onUpdateFloor(f)} className="text-blue-300 text-xs">改</button>
                  <button onClick={() => onDeleteFloor(f)}
                    disabled={f.artworkCount > 0}
                    title={f.artworkCount > 0 ? "請先清空作品" : ""}
                    className="text-red-400 text-xs disabled:opacity-30 disabled:cursor-not-allowed">刪</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form onSubmit={onCreateFloor} className="flex flex-wrap items-end gap-2 pt-3 border-t border-white/10">
          <label className="flex flex-col text-xs">編號
            <input type="number" min={1} value={nfNumber} onChange={(e) => setNfNumber(+e.target.value)}
              className="w-20 mt-1 px-2 py-1 bg-white/10 rounded outline-none" />
          </label>
          <label className="flex flex-col text-xs flex-1 min-w-[140px]">名稱
            <input value={nfName} onChange={(e) => setNfName(e.target.value)} placeholder={`${nfNumber}F`}
              className="mt-1 px-2 py-1 bg-white/10 rounded outline-none" />
          </label>
          <label className="flex flex-col text-xs">主題
            <select value={nfTheme} onChange={(e) => setNfTheme(e.target.value as FloorTheme)}
              className="mt-1 px-2 py-1 bg-white/10 rounded outline-none">
              {THEME_OPTS.map((t) => <option key={t.v} value={t.v} className="bg-black">{t.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs">Layout
            <select value={nfLayout} onChange={(e) => setNfLayout(e.target.value as FloorLayout)}
              className="mt-1 px-2 py-1 bg-white/10 rounded outline-none">
              {LAYOUT_OPTS.map((l) => <option key={l.v} value={l.v} className="bg-black">{l.label}</option>)}
            </select>
          </label>
          <button className="px-3 py-1.5 bg-white text-black rounded text-sm font-medium">新增樓層</button>
        </form>
      </section>

      {/* 上傳作品 */}
      <form onSubmit={onUpload} className="space-y-3 border border-white/20 p-4 rounded-lg">
        <h2 className="font-medium">上傳作品</h2>
        <div className="flex flex-wrap gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="標題（可空）"
            className="flex-1 min-w-[200px] px-3 py-2 bg-white/10 rounded outline-none" />
          <select value={uploadFloor} onChange={(e) => setUploadFloor(e.target.value)}
            className="px-3 py-2 bg-white/10 rounded outline-none">
            {floors.map((f) => <option key={f.id} value={f.id} className="bg-black">{f.number}F {f.name}</option>)}
          </select>
        </div>
        <input ref={fileRef} type="file" accept="image/*" required className="block text-sm" />
        <button disabled={busy || !uploadFloor} className="px-4 py-2 bg-white text-black rounded font-medium disabled:opacity-50">
          {busy ? "上傳中…" : "上傳"}
        </button>
      </form>

      {/* 作品列表 */}
      <div>
        <h2 className="font-medium mb-3">作品列表 ({items.length})</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((it) => {
            const fl = floors.find((f) => f.id === it.floorId);
            return (
              <div key={it.id} className="border border-white/20 rounded overflow-hidden">
                <img src={it.url} alt={it.title} className="w-full h-40 object-cover" />
                <div className="p-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="truncate">{it.title}</span>
                    <button onClick={() => onDelete(it.id)} className="text-red-400 text-xs ml-2">刪除</button>
                  </div>
                  <div className="text-xs text-white/50 mt-1">{fl ? `${fl.number}F ${fl.name}` : "?"}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
