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

// --- 語音輸入 → 文字（Soniox） ---
export const transcribeVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { audioDataUrl: string }) => d)
  .handler(async ({ data, context }): Promise<{ text: string }> => {
    await assertCreator(context);
    const key = process.env.SONIOX_API_KEY;
    if (!key) throw new Error("SONIOX_API_KEY missing");

    const m = data.audioDataUrl.match(/^data:(audio\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) throw new Error("Invalid audio dataUrl");
    const mime = m[1];
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length < 1024) throw new Error("錄音太短");
    if (bytes.length > 10 * 1024 * 1024) throw new Error("錄音太大 (>10MB)");
    const ext = mime.includes("webm") ? "webm" : mime.includes("mp4") ? "m4a" : mime.includes("wav") ? "wav" : "webm";

    const auth = { Authorization: `Bearer ${key}` };

    // 1) upload file
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mime }), `voice.${ext}`);
    const upRes = await fetch("https://api.soniox.com/v1/files", { method: "POST", headers: auth, body: form });
    if (!upRes.ok) throw new Error(`Soniox upload ${upRes.status}: ${await upRes.text()}`);
    const upJson = await upRes.json();
    const fileId: string = upJson.id;

    // 2) create transcription
    const trRes = await fetch("https://api.soniox.com/v1/transcriptions", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId, model: "stt-async-preview" }),
    });
    if (!trRes.ok) throw new Error(`Soniox tx ${trRes.status}: ${await trRes.text()}`);
    const trJson = await trRes.json();
    const txId: string = trJson.id;

    // 3) poll
    const deadline = Date.now() + 30_000;
    let status = trJson.status ?? "queued";
    while (Date.now() < deadline && status !== "completed" && status !== "error") {
      await new Promise((r) => setTimeout(r, 700));
      const pr = await fetch(`https://api.soniox.com/v1/transcriptions/${txId}`, { headers: auth });
      if (!pr.ok) throw new Error(`Soniox poll ${pr.status}`);
      status = (await pr.json()).status;
    }
    if (status !== "completed") throw new Error(`轉文字失敗: ${status}`);

    // 4) get transcript
    const tRes = await fetch(`https://api.soniox.com/v1/transcriptions/${txId}/transcript`, { headers: auth });
    if (!tRes.ok) throw new Error(`Soniox transcript ${tRes.status}`);
    const tJson = await tRes.json();

    // cleanup (best-effort)
    fetch(`https://api.soniox.com/v1/transcriptions/${txId}`, { method: "DELETE", headers: auth }).catch(() => {});
    fetch(`https://api.soniox.com/v1/files/${fileId}`, { method: "DELETE", headers: auth }).catch(() => {});

    return { text: (tJson.text ?? "").trim() };
  });
