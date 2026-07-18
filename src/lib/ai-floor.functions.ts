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
      .update({ source_type: "ai", scene_json: scene as unknown as object, theme, layout })
      .eq("id", data.floorId);
    if (up.error) throw up.error;

    return { count: assets.length, theme, layout };
  });

function clamp(n: unknown, lo: number, hi: number) {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(lo, Math.min(hi, v));
}
