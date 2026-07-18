import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "登入 · 3D 虛擬畫廊" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password: pw,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMsg("✅ 註冊成功,如需驗證請查郵箱,或直接登入。");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (err) {
      setMsg("⚠️ " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4">
      <div className="w-full max-w-sm rounded-2xl bg-neutral-900 p-6 text-white shadow-2xl">
        <div className="mb-4 text-center">
          <h1 className="text-2xl font-bold">🎨 3D 虛擬畫廊</h1>
          <p className="mt-1 text-sm text-white/60">{mode === "signup" ? "整個新 account" : "登入嚟創作"}</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email" required placeholder="Email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-transparent focus:ring-primary"
          />
          <input
            type="password" required minLength={6} placeholder="密碼 (最少 6 字)"
            value={pw} onChange={(e) => setPw(e.target.value)}
            className="w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-transparent focus:ring-primary"
          />
          <button disabled={busy}
            className="w-full rounded-lg bg-primary py-2 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
            {busy ? "…" : mode === "signup" ? "註冊" : "登入"}
          </button>
        </form>
        {msg && <div className="mt-3 rounded bg-neutral-800 p-2 text-sm">{msg}</div>}
        <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setMsg(null); }}
          className="mt-4 w-full text-center text-sm text-white/70 hover:text-white">
          {mode === "signup" ? "已有 account? 去登入" : "新用戶? 註冊"}
        </button>
        <div className="mt-4 text-center text-xs text-white/40">
          <Link to="/" className="hover:text-white">← 返回畫廊</Link>
        </div>
      </div>
    </div>
  );
}
