import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "./admin-session";

export type FloorTheme = "wood" | "marble" | "dark" | "outdoor";
export type FloorLayout = "rect4" | "corridor" | "round";

export const listFloors = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: floors, error } = await supabaseAdmin
    .from("floors")
    .select("id, number, name, theme, layout")
    .order("number", { ascending: true });
  if (error) throw error;
  const { data: counts, error: cErr } = await supabaseAdmin
    .from("artworks")
    .select("floor_id");
  if (cErr) throw cErr;
  const countMap = new Map<string, number>();
  for (const r of counts ?? []) {
    countMap.set(r.floor_id, (countMap.get(r.floor_id) ?? 0) + 1);
  }
  return (floors ?? []).map((f) => ({
    id: f.id,
    number: f.number,
    name: f.name,
    theme: f.theme as FloorTheme,
    layout: f.layout as FloorLayout,
    artworkCount: countMap.get(f.id) ?? 0,
  }));
});

export const createFloor = createServerFn({ method: "POST" })
  .inputValidator((d: { number: number; name: string; theme: FloorTheme; layout: FloorLayout }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!Number.isInteger(data.number) || data.number < 1) throw new Error("樓層編號需為正整數");
    const ins = await supabaseAdmin.from("floors").insert({
      number: data.number, name: data.name, theme: data.theme, layout: data.layout,
    }).select("id").single();
    if (ins.error) {
      if (ins.error.code === "23505") throw new Error(`樓層 ${data.number} 已存在`);
      throw ins.error;
    }
    return { id: ins.data.id };
  });

export const updateFloor = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; name: string; theme: FloorTheme; layout: FloorLayout }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const upd = await supabaseAdmin.from("floors").update({
      name: data.name, theme: data.theme, layout: data.layout,
    }).eq("id", data.id);
    if (upd.error) throw upd.error;
    return { ok: true as const };
  });

export const deleteFloor = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: cErr } = await supabaseAdmin
      .from("artworks").select("id", { count: "exact", head: true }).eq("floor_id", data.id);
    if (cErr) throw cErr;
    if ((count ?? 0) > 0) throw new Error(`該樓層仍有 ${count} 幅作品,請先刪除或搬移`);
    const del = await supabaseAdmin.from("floors").delete().eq("id", data.id);
    if (del.error) throw del.error;
    return { ok: true as const };
  });
