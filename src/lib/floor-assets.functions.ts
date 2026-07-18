import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type FloorAsset = {
  id: string;
  kind: string;
  preset_id: string | null;
  image_path: string | null;
  color: string | null;
  x: number;
  y: number;
  z: number;
  rotation_y: number;
  scale: number;
};

function pubClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const listFloorAssets = createServerFn({ method: "GET" })
  .inputValidator((data: { floorId: string }) => data)
  .handler(async ({ data }): Promise<FloorAsset[]> => {
    const sb = pubClient();
    const { data: rows, error } = await sb
      .from("floor_assets")
      .select("id, kind, preset_id, image_path, color, x, y, z, rotation_y, scale")
      .eq("floor_id", data.floorId);
    if (error) throw new Error(error.message);
    return (rows ?? []) as FloorAsset[];
  });
