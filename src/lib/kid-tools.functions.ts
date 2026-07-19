import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PRESET_IDS } from "@/components/preset-assets";
import { createHash, timingSafeEqual } from "crypto";

async function assertCreator(ctx: { supabase: unknown; userId: string }) {
  const sb = ctx.supabase as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
  const { data, error } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "creator" });
  if (error) throw new Error("權限檢查失敗");
  if (!data) throw new Error("你未有創作權限,請先申請");
}



// 檢查自己有無 creator 權限
export const checkMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "creator",
    });
    return { isCreator: !!data };
  });

// 用管理員密碼申請 creator 權限
export const claimCreatorRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data, context }) => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) throw new Error("ADMIN_PASSWORD 未設定");
    const a = createHash("sha256").update(data.password).digest();
    const b = createHash("sha256").update(expected).digest();
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("密碼錯誤");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ins = await supabaseAdmin.from("user_roles").upsert(
      { user_id: context.userId, role: "creator" },
      { onConflict: "user_id,role" },
    );
    if (ins.error) throw ins.error;
    return { ok: true };
  });


// --- 上載照片 → 2.5D 公仔（需要 creator 權限） ---
export const kidUploadSprite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { floorId: string; dataUrl: string; scale?: number }) => d)
  .handler(async ({ data, context }) => {
    await assertCreator(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const m = data.dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!m) throw new Error("Invalid dataUrl");
    const mime = m[1];
    const ext = mime.split("/")[1].replace("jpeg", "jpg");
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length > 6 * 1024 * 1024) throw new Error("圖片太大 (>6MB)");
    const path = `${crypto.randomUUID()}.${ext}`;
    const up = await supabaseAdmin.storage.from("floor-sprites").upload(path, bytes, { contentType: mime });
    if (up.error) throw up.error;
    const angle = Math.random() * Math.PI * 2;
    const r = 3 + Math.random() * 4;
    const scale = data.scale ?? 1.4;
    const ins = await supabaseAdmin.from("floor_assets").insert({
      floor_id: data.floorId, kind: "sprite", image_path: path,
      x: Math.cos(angle) * r, y: scale / 2, z: Math.sin(angle) * r,
      rotation_y: 0, scale,
    }).select("id").single();
    if (ins.error) throw ins.error;
    return { id: ins.data.id };
  });

// --- 一句話微調樓層（登入用戶都可以，只動 preset 資產） ---
type RefineOp =
  | { op: "add"; preset_id: string; x: number; y?: number; z: number; rotation_y?: number; scale?: number; color?: string }
  | { op: "update"; id: string; patch: { x?: number; y?: number; z?: number; rotation_y?: number; scale?: number } }
  | { op: "delete"; id: string };

const REFINE_SYSTEM = `You edit an existing 3D scene of children's playground assets.
You will get the current asset list (with ids) and a short instruction.
Reply with STRICT JSON: {"ops":[...]}. No prose. No markdown.

Allowed ops:
- {"op":"add","preset_id":"<one of allowed>","x":number,"y":number,"z":number,"rotation_y":number,"scale":number,"color":"#rrggbb"}
- {"op":"update","id":"<existing id>","patch":{"x":number,"y":number,"z":number,"rotation_y":number,"scale":number}}
- {"op":"delete","id":"<existing id>"}

Rules:
- Minimal ops. At most 15 ops.
- preset_id must be one of: {PRESETS}.
- Do NOT touch assets you don't see in the list (they are user photos).
- x,z in [-8,8]; y >= 0; scale in [0.4,3]; rotation_y in radians.`;

function clamp(n: unknown, lo: number, hi: number) {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(lo, Math.min(hi, v));
}

export const kidRefineFloor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { floorId: string; instruction: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCreator(context);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const instruction = data.instruction.trim();
    if (!instruction) throw new Error("請講句嘢");
    if (instruction.length > 300) throw new Error("句子太長");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cur = await supabaseAdmin.from("floor_assets")
      .select("id, kind, preset_id, x, y, z, rotation_y, scale, color")
      .eq("floor_id", data.floorId);
    if (cur.error) throw cur.error;
    const editable = (cur.data ?? []).filter((r) => r.kind === "preset");

    const sys = REFINE_SYSTEM.replace("{PRESETS}", PRESET_IDS.join(", "));
    const user = `Current assets (JSON):\n${JSON.stringify(editable)}\n\nInstruction: ${instruction}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? "";
    let parsed: { ops?: RefineOp[] };
    try { parsed = JSON.parse(text); }
    catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned non-JSON");
      parsed = JSON.parse(m[0]);
    }
    const ops = (parsed.ops ?? []).slice(0, 15);
    const validPresets = new Set(PRESET_IDS as readonly string[]);
    const editableIds = new Set(editable.map((r) => r.id));

    let added = 0, updated = 0, deleted = 0;
    for (const op of ops) {
      if (op.op === "add" && validPresets.has(op.preset_id)) {
        const ins = await supabaseAdmin.from("floor_assets").insert({
          floor_id: data.floorId, kind: "preset", preset_id: op.preset_id,
          x: clamp(op.x, -8, 8), y: Math.max(0, op.y ?? 0), z: clamp(op.z, -8, 8),
          rotation_y: Number.isFinite(op.rotation_y) ? op.rotation_y! : 0,
          scale: clamp(op.scale ?? 1, 0.4, 3),
          color: typeof op.color === "string" ? op.color : null,
        });
        if (!ins.error) added++;
      } else if (op.op === "update" && editableIds.has(op.id)) {
        const k = op.patch ?? {};
        const p: { x?: number; y?: number; z?: number; rotation_y?: number; scale?: number } = {};
        if (Number.isFinite(k.x)) p.x = clamp(k.x, -8, 8);
        if (Number.isFinite(k.y)) p.y = Math.max(0, k.y!);
        if (Number.isFinite(k.z)) p.z = clamp(k.z, -8, 8);
        if (Number.isFinite(k.rotation_y)) p.rotation_y = k.rotation_y!;
        if (Number.isFinite(k.scale)) p.scale = clamp(k.scale, 0.4, 3);
        if (Object.keys(p).length) {
          const u = await supabaseAdmin.from("floor_assets").update(p).eq("id", op.id);
          if (!u.error) updated++;
        }
      } else if (op.op === "delete" && editableIds.has(op.id)) {
        const d = await supabaseAdmin.from("floor_assets").delete().eq("id", op.id);
        if (!d.error) deleted++;
      }
    }
    return { added, updated, deleted };
  });

// --- 語音輸入 → 文字 (Lovable AI Gateway) ---
export const transcribeVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { audioDataUrl: string }) => d)
  .handler(async ({ data, context }): Promise<{ text: string }> => {
    await assertCreator(context);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const m = data.audioDataUrl.match(/^data:(audio\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) throw new Error("Invalid audio dataUrl");
    const mime = m[1].split(";")[0];
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length < 1024) throw new Error("錄音太短");
    if (bytes.length > 20 * 1024 * 1024) throw new Error("錄音太大 (>20MB)");
    const ext = mime.includes("webm") ? "webm"
      : mime.includes("mp4") ? "mp4"
      : mime.includes("mpeg") ? "mp3"
      : mime.includes("wav") ? "wav"
      : "webm";

    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", new Blob([bytes], { type: mime }), `voice.${ext}`);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`轉文字失敗 ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json() as { text?: string };
    return { text: (json.text ?? "").trim() };
  });

// --- AI 生成牆紙 / 地板貼圖 (Nano Banana) ---
type SurfaceTarget = "wall" | "floor" | "both";

async function genTexture(prompt: string, key: string): Promise<Buffer> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const images: Array<{ image_url?: { url?: string } }> =
    json.choices?.[0]?.message?.images ?? [];
  const dataUrl = images[0]?.image_url?.url;
  if (!dataUrl) throw new Error("AI 冇畀圖");
  const m = dataUrl.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
  if (!m) throw new Error("圖片格式錯");
  return Buffer.from(m[1], "base64");
}

export const kidGenerateSurfaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { floorId: string; instruction: string; target: SurfaceTarget }) => d)
  .handler(async ({ data, context }) => {
    await assertCreator(context);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    const instr = data.instruction.trim();
    if (!instr) throw new Error("請講句嘢");
    if (instr.length > 300) throw new Error("句子太長");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { wall_texture_url?: string; floor_texture_url?: string } = {};

    async function makeAndSave(kind: "wall" | "floor") {
      const surfaceHint = kind === "wall"
        ? "seamless tileable interior wall material / wallpaper texture, flat lit, no shadows, no perspective, no objects, front-facing swatch"
        : "seamless tileable floor material texture, top-down view, flat lit, no shadows, no perspective, no objects, square swatch";
      const prompt = `Generate a ${surfaceHint}. Style: ${instr}. Square 1024x1024, tileable, high detail.`;
      const bytes = await genTexture(prompt, key!);
      const path = `${data.floorId}/${kind}-${Date.now()}.png`;
      const up = await supabaseAdmin.storage.from("floor-textures")
        .upload(path, bytes, { contentType: "image/png", upsert: true });
      if (up.error) throw up.error;
      const signed = await supabaseAdmin.storage.from("floor-textures")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed.error || !signed.data) throw signed.error ?? new Error("signed url fail");
      if (kind === "wall") patch.wall_texture_url = signed.data.signedUrl;
      else patch.floor_texture_url = signed.data.signedUrl;
    }

    if (data.target === "wall" || data.target === "both") await makeAndSave("wall");
    if (data.target === "floor" || data.target === "both") await makeAndSave("floor");

    const up = await supabaseAdmin.from("floors").update(patch).eq("id", data.floorId);
    if (up.error) throw up.error;
    return { ok: true, ...patch };
  });

