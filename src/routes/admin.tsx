import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  checkAdmin, unlockAdmin, lockAdmin,
  uploadArtwork, deleteArtwork, listArtworks,
  uploadSprite, deleteFloorAsset, listFloorSprites,
  listFloorAssetsAdmin, updateFloorAsset, type AdminFloorAsset,
} from "@/lib/admin.functions";
import {
  listFloors, createFloor, updateFloor, deleteFloor,
  type FloorTheme, type FloorLayout,
} from "@/lib/floors.functions";
import { generateFloorScene, refineFloorScene } from "@/lib/ai-floor.functions";

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
  const genScene = useServerFn(generateFloorScene);
  const refineScene = useServerFn(refineFloorScene);
  const upSprite = useServerFn(uploadSprite);
  const listSpr = useServerFn(listFloorSprites);
  const delAsset = useServerFn(deleteFloorAsset);
  const listAssets = useServerFn(listFloorAssetsAdmin);
  const updateAsset = useServerFn(updateFloorAsset);

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

  // 文字造夢
  const [aiFloor, setAiFloor] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [rfInstr, setRfInstr] = useState("");
  const [rfBusy, setRfBusy] = useState(false);
  const [rfMsg, setRfMsg] = useState("");

  // 照片變公仔
  const [spFloor, setSpFloor] = useState("");
  const [spBusy, setSpBusy] = useState(false);
  const [spMsg, setSpMsg] = useState("");
  const [sprites, setSprites] = useState<{ id: string; url: string }[]>([]);
  const spFileRef = useRef<HTMLInputElement>(null);

  // 編輯資產
  const [edFloor, setEdFloor] = useState("");
  const [assets, setAssets] = useState<AdminFloorAsset[]>([]);
  const [edBusy, setEdBusy] = useState<string | null>(null);


  const reload = async () => {
    const [fl, its] = await Promise.all([listFl(), list()]);
    // Hide permanent system floor (Arcade 99F) from admin — it's not user-editable.
    const editable = fl.filter((f) => f.number !== 99);
    setFloors(editable);
    setItems(its);
    if (!uploadFloor && editable.length > 0) setUploadFloor(editable[0].id);
    const nextNum = editable.length > 0 ? Math.max(...editable.map((f) => f.number)) + 1 : 1;
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

  async function onGenerateScene(e: React.FormEvent) {
    e.preventDefault();
    if (!aiFloor || !aiPrompt.trim()) return;
    setAiBusy(true); setAiMsg("");
    try {
      const r = await genScene({ data: { floorId: aiFloor, prompt: aiPrompt } });
      setAiMsg(`✨ 造咗 ${r.count} 件嘢！返首頁睇睇 🎪`);
      setAiPrompt("");
      await reload();
    } catch (e: any) {
      setAiMsg("😢 造夢失敗: " + (e?.message ?? String(e)));
    } finally { setAiBusy(false); }
  }

  async function onRefineScene(e: React.FormEvent) {
    e.preventDefault();
    if (!aiFloor || !rfInstr.trim()) return;
    setRfBusy(true); setRfMsg("");
    try {
      const r = await refineScene({ data: { floorId: aiFloor, instruction: rfInstr } });
      setRfMsg(`🪄 加${r.added} / 改${r.updated} / 刪${r.deleted}`);
      setRfInstr("");
    } catch (e: any) {
      setRfMsg("😢 微調失敗: " + (e?.message ?? String(e)));
    } finally { setRfBusy(false); }
  }


  const reloadSprites = async (fid: string) => {
    if (!fid) { setSprites([]); return; }
    try { setSprites(await listSpr({ data: { floorId: fid } })); }
    catch { setSprites([]); }
  };

  useEffect(() => { if (unlocked && spFloor) reloadSprites(spFloor); }, [unlocked, spFloor]);

  async function onUploadSprite(e: React.FormEvent) {
    e.preventDefault();
    const f = spFileRef.current?.files?.[0]; if (!f || !spFloor) return;
    setSpBusy(true); setSpMsg("");
    try {
      const { dataUrl } = await fileToResizedDataUrl(f);
      await upSprite({ data: { floorId: spFloor, dataUrl } });
      if (spFileRef.current) spFileRef.current.value = "";
      setSpMsg("🎉 公仔已放入樓層！返首頁睇睇");
      await reloadSprites(spFloor);
    } catch (e: any) { setSpMsg("😢 失敗: " + (e?.message ?? e)); }
    finally { setSpBusy(false); }
  }

  async function onDeleteSprite(id: string) {
    if (!confirm("確定刪除呢隻公仔？")) return;
    await delAsset({ data: { id } });
    await reloadSprites(spFloor);
  }

  const reloadAssets = async (fid: string) => {
    if (!fid) { setAssets([]); return; }
    try { setAssets(await listAssets({ data: { floorId: fid } })); }
    catch { setAssets([]); }
  };
  useEffect(() => { if (unlocked && edFloor) reloadAssets(edFloor); }, [unlocked, edFloor]);

  function patchAsset(id: string, patch: Partial<AdminFloorAsset>) {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  async function onSaveAsset(a: AdminFloorAsset) {
    setEdBusy(a.id);
    try {
      await updateAsset({ data: { id: a.id, x: a.x, y: a.y, z: a.z, rotation_y: a.rotation_y, scale: a.scale } });
    } catch (e: any) { alert("儲存失敗: " + (e?.message ?? e)); }
    finally { setEdBusy(null); }
  }
  async function onDeleteAsset(id: string) {
    if (!confirm("確定刪除呢件資產？")) return;
    await delAsset({ data: { id } });
    await reloadAssets(edFloor);
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

      {/* 文字造夢 */}
      <section className="space-y-3 border border-pink-300/40 bg-gradient-to-br from-pink-500/10 to-indigo-500/10 p-4 rounded-lg">
        <h2 className="font-medium">🪄 文字造夢樓層</h2>
        <p className="text-xs text-white/60">揀一層,用一句說話描述你嘅夢境世界,AI 會幫你擺樹、雲、城堡…</p>
        <form onSubmit={onGenerateScene} className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <select value={aiFloor} onChange={(e) => setAiFloor(e.target.value)} required
              className="px-3 py-2 bg-white/10 rounded outline-none">
              <option value="" className="bg-black">— 揀樓層 —</option>
              {floors.map((f) => <option key={f.id} value={f.id} className="bg-black">{f.number}F {f.name}</option>)}
            </select>
            <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} required
              placeholder="例如：夜空下的粉紅城堡花園" maxLength={200}
              className="flex-1 min-w-[220px] px-3 py-2 bg-white/10 rounded outline-none" />
          </div>
          <div className="flex items-center gap-3">
            <button disabled={aiBusy || !aiFloor || !aiPrompt.trim()}
              className="px-4 py-2 bg-pink-400 text-black rounded font-medium disabled:opacity-50">
              {aiBusy ? "造夢中…" : "✨ 開始造夢"}
            </button>
            {aiBusy && (
              <div className="flex items-center gap-2 text-sm text-pink-200">
                <span className="inline-block animate-bounce">🌟</span>
                <span className="inline-block animate-bounce [animation-delay:120ms]">🪄</span>
                <span className="inline-block animate-bounce [animation-delay:240ms]">🏰</span>
                <span className="inline-block animate-bounce [animation-delay:360ms]">🌈</span>
                <span className="ml-2 opacity-80">小精靈正在搭場景…</span>
              </div>
            )}
            {!aiBusy && aiMsg && <span className="text-sm text-white/80">{aiMsg}</span>}
          </div>
          <p className="text-[11px] text-white/40">⚠️ 此操作會覆蓋該樓層現有嘅 AI 資產(唔影響已上傳嘅畫作)</p>
        </form>

        <div className="pt-3 mt-2 border-t border-white/10 space-y-2">
          <p className="text-xs text-white/70">🪄 微調呢層(唔洗重造成個場景)</p>
          <form onSubmit={onRefineScene} className="flex flex-wrap gap-2 items-center">
            <input value={rfInstr} onChange={(e) => setRfInstr(e.target.value)}
              placeholder="例如：把城堡放大 / 多加幾棵樹 / 移走全部石頭"
              maxLength={200} disabled={!aiFloor}
              className="flex-1 min-w-[220px] px-3 py-2 bg-white/10 rounded outline-none disabled:opacity-50" />
            <button disabled={rfBusy || !aiFloor || !rfInstr.trim()}
              className="px-3 py-2 bg-indigo-300 text-black rounded text-sm font-medium disabled:opacity-50">
              {rfBusy ? "微調中…" : "🪄 微調"}
            </button>
            {rfBusy && <span className="text-xs text-indigo-200 inline-flex gap-1">
              <span className="animate-bounce">✨</span>
              <span className="animate-bounce [animation-delay:150ms]">🔧</span>
            </span>}
            {!rfBusy && rfMsg && <span className="text-xs text-white/80">{rfMsg}</span>}
          </form>
          <p className="text-[11px] text-white/40">💡 用返上面揀嘅樓層。只會改 AI 預製資產,唔影響公仔同畫作。</p>
        </div>
      </section>


      {/* 照片變公仔 */}
      <section className="space-y-3 border border-emerald-300/40 bg-gradient-to-br from-emerald-500/10 to-sky-500/10 p-4 rounded-lg">
        <h2 className="font-medium">📸 照片變 2.5D 公仔</h2>
        <p className="text-xs text-white/60">上載一張圖(建議透明背景 PNG),會變成企喺樓層度嘅 billboard 公仔。</p>
        <form onSubmit={onUploadSprite} className="space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <select value={spFloor} onChange={(e) => setSpFloor(e.target.value)} required
              className="px-3 py-2 bg-white/10 rounded outline-none">
              <option value="" className="bg-black">— 揀樓層 —</option>
              {floors.map((f) => <option key={f.id} value={f.id} className="bg-black">{f.number}F {f.name}</option>)}
            </select>
            <input ref={spFileRef} type="file" accept="image/*" required className="text-sm" />
            <button disabled={spBusy || !spFloor}
              className="px-4 py-2 bg-emerald-400 text-black rounded font-medium disabled:opacity-50">
              {spBusy ? "生成中…" : "🧸 變公仔"}
            </button>
            {spBusy && (
              <span className="text-sm text-emerald-200 inline-flex gap-1">
                <span className="animate-bounce">✂️</span>
                <span className="animate-bounce [animation-delay:120ms]">🖼️</span>
                <span className="animate-bounce [animation-delay:240ms]">🧸</span>
              </span>
            )}
            {!spBusy && spMsg && <span className="text-sm text-white/80">{spMsg}</span>}
          </div>
        </form>
        {spFloor && sprites.length > 0 && (
          <div>
            <div className="text-xs text-white/50 mb-2">呢層公仔 ({sprites.length})</div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {sprites.map((s) => (
                <div key={s.id} className="relative border border-white/20 rounded overflow-hidden bg-black/40">
                  <img src={s.url} alt="" className="w-full h-24 object-contain" />
                  <button onClick={() => onDeleteSprite(s.id)}
                    className="absolute top-1 right-1 bg-black/70 text-red-300 text-xs px-1.5 rounded">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 編輯樓層資產 */}
      <section className="space-y-3 border border-amber-300/40 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-4 rounded-lg">
        <h2 className="font-medium">🛠️ 編輯樓層資產(位置 / 旋轉 / 縮放)</h2>
        <div className="flex flex-wrap gap-2">
          <select value={edFloor} onChange={(e) => setEdFloor(e.target.value)}
            className="px-3 py-2 bg-white/10 rounded outline-none">
            <option value="" className="bg-black">— 揀樓層 —</option>
            {floors.map((f) => <option key={f.id} value={f.id} className="bg-black">{f.number}F {f.name}</option>)}
          </select>
          {edFloor && <button onClick={() => reloadAssets(edFloor)} className="px-3 py-2 text-xs border border-white/20 rounded">重新載入</button>}
        </div>
        {edFloor && assets.length === 0 && <p className="text-xs text-white/50">呢層冇資產。</p>}
        {edFloor && assets.length > 0 && (
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {assets.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 border border-white/10 rounded p-2 bg-black/30">
                {a.thumb
                  ? <img src={a.thumb} alt="" className="w-10 h-10 object-contain bg-black/40 rounded" />
                  : <div className="w-10 h-10 rounded bg-white/10 grid place-items-center text-[10px] text-white/60">{a.preset_id ?? a.kind}</div>}
                <span className="text-[11px] text-white/60 w-16 truncate">{a.preset_id ?? a.kind}</span>
                {(["x", "y", "z", "rotation_y", "scale"] as const).map((k) => (
                  <label key={k} className="flex flex-col text-[10px] text-white/60">
                    {k}
                    <input type="number" step={k === "scale" ? 0.1 : k === "rotation_y" ? 0.1 : 0.5}
                      value={a[k]}
                      onChange={(e) => patchAsset(a.id, { [k]: Number(e.target.value) } as Partial<AdminFloorAsset>)}
                      className="w-20 mt-0.5 px-1.5 py-1 bg-white/10 rounded outline-none text-white text-xs" />
                  </label>
                ))}
                <div className="ml-auto flex gap-2">
                  <button onClick={() => onSaveAsset(a)} disabled={edBusy === a.id}
                    className="px-2.5 py-1 bg-amber-400 text-black rounded text-xs font-medium disabled:opacity-50">
                    {edBusy === a.id ? "…" : "儲存"}
                  </button>
                  <button onClick={() => onDeleteAsset(a.id)} className="px-2.5 py-1 border border-red-400/40 text-red-300 rounded text-xs">刪</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-white/40">💡 改完位置要撳「儲存」,返首頁 refresh 就見到新擺位。</p>
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
