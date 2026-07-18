import { createServerFn } from "@tanstack/react-start";

export type FloorAsset = {
  id: string;
  kind: string;
  preset_id: string | null;
  image_path: string | null;
  image_url: string | null;
  color: string | null;
  x: number;
  y: number;
  z: number;
  rotation_y: number;
  scale: number;
};

export const listFloorAssets = createServerFn({ method: "GET" })
  .inputValidator((data: { floorId: string }) => data)
  .handler(async ({ data }): Promise<FloorAsset[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("floor_assets")
      .select("id, kind, preset_id, image_path, color, x, y, z, rotation_y, scale")
      .eq("floor_id", data.floorId);
    if (error) throw new Error(error.message);
    const out: FloorAsset[] = [];
    for (const r of rows ?? []) {
      let image_url: string | null = null;
      if (r.image_path) {
        const s = await supabaseAdmin.storage.from("floor-sprites").createSignedUrl(r.image_path, 60 * 60);
        image_url = s.data?.signedUrl ?? null;
      }
      out.push({ ...(r as Omit<FloorAsset, "image_url">), image_url });
    }
    return out;
  });

