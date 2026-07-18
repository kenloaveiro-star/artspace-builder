import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { kidUploadSprite, kidRefineFloor, transcribeVoice, kidGenerateSurfaces } from "@/lib/kid-tools.functions";

type Mode = null | "upload" | "text" | "voice" | "decor";
type DecorTarget = "wall" | "floor" | "both";

interface Props {
  floorId: string;
  onChanged: () => Promise<void> | void;
}

type Toast = { kind: "ok" | "err" | "info"; text: string };

export function KidToolbar({ floorId, onChanged }: Props) {
  const qc = useQueryClient();
  const upload = useServerFn(kidUploadSprite);
  const refine = useServerFn(kidRefineFloor);
  const stt = useServerFn(transcribeVoice);
  const genSurfaces = useServerFn(kidGenerateSurfaces);

  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const [decorTarget, setDecorTarget] = useState<DecorTarget>("both");
  const [busy, setBusy] = useState(false);
  const [toastMsg, setToastMsg] = useState<Toast | null>(null);
  const [recording, setRecording] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function toast(text: string, kind: Toast["kind"] = "info", ms = 3500) {
    setToastMsg({ kind, text });
    setTimeout(() => setToastMsg((cur) => (cur?.text === text ? null : cur)), ms);
  }

  async function onUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setBusy(true);
    toast("⏳ 上載緊…", "info", 10_000);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(new Error("read fail"));
        r.readAsDataURL(f);
      });
      await upload({ data: { floorId, dataUrl } });
      await onChanged();
      await qc.refetchQueries({ queryKey: ["assets", floorId] });
      toast("✅ 加咗一個公仔落樓層!", "ok", 4000);
      setMode(null);
    } catch (err) {
      toast("⚠️ " + (err instanceof Error ? err.message : String(err)), "err", 5000);
    } finally { setBusy(false); }
  }

  async function onSubmitText() {
    if (!text.trim()) return;
    setBusy(true);
    toast("✨ AI 諗緊…", "info", 15_000);
    try {
      const r = await refine({ data: { floorId, instruction: text.trim() } });
      await onChanged();
      await qc.refetchQueries({ queryKey: ["assets", floorId] });
      toast(`✅ 完成! 加${r.added} · 改${r.updated} · 刪${r.deleted}`, "ok", 4000);
      setText("");
      setMode(null);
    } catch (err) {
      toast("⚠️ " + (err instanceof Error ? err.message : String(err)), "err", 5000);
    } finally { setBusy(false); }
  }


  async function startRec() {
    setToastMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1024) { toast("錄音太短,再試一次"); return; }
        setBusy(true);
        try {
          const dataUrl = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.onerror = () => rej(new Error("read fail"));
            r.readAsDataURL(blob);
          });
          const { text: t } = await stt({ data: { audioDataUrl: dataUrl } });
          if (!t) { toast("聽唔清楚,再講一次"); return; }
          setText((prev) => (prev ? prev + " " : "") + t);
          setMode("text");
        } catch (err) {
          toast("⚠️ " + (err instanceof Error ? err.message : String(err)));
        } finally { setBusy(false); }
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch (err) {
      toast("⚠️ 無法用麥克風: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  function stopRec() {
    setRecording(false);
    recRef.current?.stop();
    recRef.current = null;
  }

  useEffect(() => () => { recRef.current?.stop(); }, []);

  return (
    <>
      {toastMsg && (
        <div className={`pointer-events-none fixed left-1/2 top-20 z-40 -translate-x-1/2 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-2xl backdrop-blur ${
          toastMsg.kind === "ok" ? "bg-emerald-600/90"
          : toastMsg.kind === "err" ? "bg-red-600/90"
          : "bg-black/80"
        }`}>
          {toastMsg.text}
        </div>
      )}

      {/* Expanded panel */}
      {!collapsed && mode && (
        <div className="fixed inset-x-0 bottom-28 z-30 flex justify-center px-4">
          <div className="w-full max-w-md rounded-2xl bg-neutral-900/95 p-4 text-white shadow-2xl backdrop-blur">
            {mode === "upload" && (
              <div>
                <div className="mb-2 text-sm font-semibold">📸 揀張相 → 變 3D 公仔</div>
                <label className="block cursor-pointer rounded-xl border-2 border-dashed border-white/30 p-6 text-center text-sm hover:bg-white/5">
                  {busy ? "上載緊…" : "📁 揀張相 (建議透明背景 PNG)"}
                  <input type="file" accept="image/*" hidden onChange={onUploadFile} disabled={busy} />
                </label>
              </div>
            )}
            {mode === "text" && (
              <div>
                <div className="mb-2 text-sm font-semibold">✨ 講一句 → AI 幫你改樓層</div>
                <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="例如:加多幾棵樹 / 把城堡放大 / 全部石頭都拎走"
                  className="w-full resize-none rounded-lg bg-neutral-800 p-2 text-sm outline-none ring-1 ring-transparent focus:ring-primary" />
                <div className="mt-2 flex gap-2">
                  <button onClick={onSubmitText} disabled={busy || !text.trim()}
                    className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
                    {busy ? "AI 諗緊…" : "✨ 開始"}
                  </button>
                  <button onClick={recording ? stopRec : startRec} disabled={busy}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${recording ? "animate-pulse bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}>
                    {recording ? "⏹ 停" : "🎤"}
                  </button>
                </div>
              </div>
            )}
            {mode === "voice" && (
              <div className="text-center">
                <div className="mb-3 text-sm font-semibold">🎤 講咩你想改?</div>
                <button
                  onClick={recording ? stopRec : startRec}
                  disabled={busy}
                  className={`h-24 w-24 rounded-full text-3xl transition ${recording ? "animate-pulse bg-red-500" : "bg-primary"} text-white shadow-lg hover:scale-105 disabled:opacity-50`}>
                  {recording ? "⏹" : "🎤"}
                </button>
                <div className="mt-2 text-xs text-white/60">
                  {busy ? "轉緊文字…" : recording ? "錄緊音,講完撳停" : "撳一下開始講"}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom sidebar */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-3">
        <div className={`pointer-events-auto flex flex-col gap-2 rounded-t-2xl bg-black/85 px-4 pt-2 shadow-2xl backdrop-blur transition-all duration-300 ${collapsed ? "w-full max-w-sm items-center" : "w-full max-w-md items-stretch"}`}>
          <div className="flex w-full items-center justify-between">
            <button onClick={() => setCollapsed((c) => !c)} className="flex items-center gap-2 text-white/80 hover:text-white">
              <span className="text-xs font-semibold tracking-wide">{collapsed ? "🎨 創作工具" : "🎨 創作工具"}</span>
              <span className="text-sm transition-transform duration-300">{collapsed ? "▲" : "▼"}</span>
            </button>
            {!collapsed && mode && (
              <button onClick={() => setMode(null)} className="rounded-full bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20">✕ 收起</button>
            )}
          </div>

          {!collapsed && (
            <div className="flex items-center justify-center gap-3 pb-2">
              <ToolBtn active={mode === "upload"} onClick={() => setMode(mode === "upload" ? null : "upload")} label="相→公仔" icon="📸" />
              <ToolBtn active={mode === "text"} onClick={() => setMode(mode === "text" ? null : "text")} label="改樓層" icon="✨" />
              <ToolBtn active={mode === "voice"} onClick={() => setMode(mode === "voice" ? null : "voice")} label="講嘢" icon="🎤" />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ToolBtn({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: string }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-white transition ${active ? "bg-primary" : "hover:bg-white/10"}`}>
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  );
}
