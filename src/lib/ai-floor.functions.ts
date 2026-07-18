import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "./admin-session";
import { PRESET_IDS } from "@/components/preset-assets";

type SceneAsset = {
  preset_id: string;
  x: number;
  y: number;
  z: number;
  rotation_y?: number;
  scale?: number;
  color?: string;
};

const SYSTEM = `You are a 3D scene planner for a children's playground gallery.
Given a short user prompt, output a JSON scene made ONLY of these preset assets:
${PRESET_IDS.join(", ")}.

Rules:
- Output STRICT JSON, no prose, no markdown, no comments.
- Shape: {"theme":"wood|marble|dark|outdoor","layout":"rect4|corridor|round","assets":[{...}]}
- 6 to 15 assets. Spread them across the floor (x in [-6,6], z in [-6,6], y=0).
- rotation_y in radians [0, 6.28]. scale in [0.6, 2.5]. color is optional hex like "#88cc44".
- Choose theme that best matches the vibe. Pick a layout too.
- preset_id MUST be one of the listed presets. No new asset types.`;

export const generateFloorScene = createServerFn({ method: "POST" })
  .inputValidator((d: { floorId: string; prompt: string }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: data.prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI gateway ${res.status}: ${t}`);
    }
    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? "";
    let scene: { theme?: string; layout?: string; assets?: SceneAsset[] };
    try {
      scene = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned non-JSON");
      scene = JSON.parse(m[0]);
    }
    const validPresets = new Set(PRESET_IDS as readonly string[]);
    const assets = (scene.assets ?? [])
      .filter((a) => a && validPresets.has(a.preset_id))
      .slice(0, 20)
      .map((a) => ({
        kind: "preset",
        preset_id: a.preset_id,
        floor_id: data.floorId,
        x: clamp(a.x, -8, 8),
        y: Math.max(0, a.y ?? 0),
        z: clamp(a.z, -8, 8),
        rotation_y: Number.isFinite(a.rotation_y) ? a.rotation_y! : 0,
        scale: clamp(a.scale ?? 1, 0.4, 3),
        color: typeof a.color === "string" ? a.color : null,
      }));
    if (assets.length === 0) throw new Error("AI produced 0 valid assets");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Wipe existing assets on this floor, then insert new ones
    await supabaseAdmin.from("floor_assets").delete().eq("floor_id", data.floorId);
    const ins = await supabaseAdmin.from("floor_assets").insert(assets);
    if (ins.error) throw ins.error;

    // Persist theme/layout/scene_json + mark ai
    const theme = ["wood", "marble", "dark", "outdoor"].includes(scene.theme ?? "") ? scene.theme! : "outdoor";
    const layout = ["rect4", "corridor", "round"].includes(scene.layout ?? "") ? scene.layout! : "round";
    const up = await supabaseAdmin
      .from("floors")
      .update({ source_type: "ai", scene_json: scene as never, theme, layout })
      .eq("id", data.floorId);
    if (up.error) throw up.error;

    return { count: assets.length, theme, layout };
  });

function clamp(n: unknown, lo: number, hi: number) {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(lo, Math.min(hi, v));
}

// ---------------- Refine (local tweak) ----------------
type RefineOp =
  | { op: "add"; preset_id: string; x: number; y?: number; z: number; rotation_y?: number; scale?: number; color?: string }
  | { op: "update"; id: string; patch: { x?: number; y?: number; z?: number; rotation_y?: number; scale?: number } }
  | { op: "delete"; id: string };

const REFINE_SYSTEM = `You edit an existing 3D scene of children's playground assets.
You will get the current asset list (with ids) and a short instruction.
Reply with STRICT JSON: {"ops":[...]}. No prose. No markdown.

Allowed ops (only these shapes):
- {"op":"add","preset_id":"<one of allowed>","x":number,"y":number,"z":number,"rotation_y":number,"scale":number,"color":"#rrggbb"}
- {"op":"update","id":"<existing id>","patch":{"x":number,"y":number,"z":number,"rotation_y":number,"scale":number}}   // patch keys optional
- {"op":"delete","id":"<existing id>"}

Rules:
- Prefer minimal ops (do only what the instruction says). At most 20 ops.
- Only use preset_ids from: {PRESETS}.
- Do NOT touch assets with kind "sprite" (their ids won't appear in the list you get).
- x,z in [-8,8]; y >= 0; scale in [0.4,3]; rotation_y in radians.`;

export const refineFloorScene = createServerFn({ method: "POST" })
  .inputValidator((d: { floorId: string; instruction: string }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cur = await supabaseAdmin.from("floor_assets")
      .select("id, kind, preset_id, x, y, z, rotation_y, scale, color")
      .eq("floor_id", data.floorId);
    if (cur.error) throw cur.error;
    // Only expose preset assets to the model (sprites are user uploads)
    const editable = (cur.data ?? []).filter((r) => r.kind === "preset");

    const sys = REFINE_SYSTEM.replace("{PRESETS}", PRESET_IDS.join(", "));
    const user = `Current assets (JSON):\n${JSON.stringify(editable)}\n\nInstruction: ${data.instruction}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`AI gateway ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? "";
    let parsed: { ops?: RefineOp[] };
    try { parsed = JSON.parse(text); }
    catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned non-JSON");
      parsed = JSON.parse(m[0]);
    }
    const ops = (parsed.ops ?? []).slice(0, 20);
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
