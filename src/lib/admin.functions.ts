import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { adminSessionConfig, pwMatch, requireAdmin, type AdminSession } from "./admin-session";

export const unlockAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) throw new Error("ADMIN_PASSWORD not set");
    if (!pwMatch(data.password, expected)) return { ok: false as const };
    const s = await useSession<AdminSession>(adminSessionConfig());
    await s.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const s = await useSession<AdminSession>(adminSessionConfig());
  await s.clear();
  return { ok: true as const };
});

export const checkAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const s = await useSession<AdminSession>(adminSessionConfig());
  return { unlocked: !!s.data.unlocked };
});

export const uploadArtwork = createServerFn({ method: "POST" })
  .inputValidator((d: { title: string; dataUrl: string; width: number; height: number; floorId: string }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const m = data.dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!m) throw new Error("Invalid dataUrl");
    const mime = m[1];
    const ext = mime.split("/")[1].replace("jpeg", "jpg");
    const bytes = Buffer.from(m[2], "base64");
    const path = `${crypto.randomUUID()}.${ext}`;
    const up = await supabaseAdmin.storage.from("artworks").upload(path, bytes, { contentType: mime });
    if (up.error) throw up.error;
    const ins = await supabaseAdmin.from("artworks").insert({
      title: data.title, storage_path: path, width: data.width, height: data.height, floor_id: data.floorId,
    }).select("id").single();
    if (ins.error) throw ins.error;
    return { id: ins.data.id };
  });

export const deleteArtwork = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = await supabaseAdmin.from("artworks").select("storage_path").eq("id", data.id).single();
    if (row.error) throw row.error;
    await supabaseAdmin.storage.from("artworks").remove([row.data.storage_path]);
    const del = await supabaseAdmin.from("artworks").delete().eq("id", data.id);
    if (del.error) throw del.error;
    return { ok: true as const };
  });

export const listArtworks = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("artworks").select("id, title, storage_path, width, height, floor_id, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const items = await Promise.all((data ?? []).map(async (a) => {
    const s = await supabaseAdmin.storage.from("artworks").createSignedUrl(a.storage_path, 60 * 60);
    return { id: a.id, title: a.title, width: a.width, height: a.height, floorId: a.floor_id, url: s.data?.signedUrl ?? "" };
  }));
  return items;
});

export const uploadSprite = createServerFn({ method: "POST" })
  .inputValidator((d: { floorId: string; dataUrl: string; scale?: number }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const m = data.dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!m) throw new Error("Invalid dataUrl");
    const mime = m[1];
    const ext = mime.split("/")[1].replace("jpeg", "jpg");
    const bytes = Buffer.from(m[2], "base64");
    const path = `${crypto.randomUUID()}.${ext}`;
    const up = await supabaseAdmin.storage.from("floor-sprites").upload(path, bytes, { contentType: mime });
    if (up.error) throw up.error;
    // random position on floor, avoid center
    const angle = Math.random() * Math.PI * 2;
    const r = 3 + Math.random() * 4;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const scale = data.scale ?? 1.4;
    const ins = await supabaseAdmin.from("floor_assets").insert({
      floor_id: data.floorId, kind: "sprite", image_path: path,
      x, y: scale / 2, z, rotation_y: 0, scale,
    }).select("id").single();
    if (ins.error) throw ins.error;
    return { id: ins.data.id };
  });

export const deleteFloorAsset = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = await supabaseAdmin.from("floor_assets")
      .select("image_path").eq("id", data.id).single();
    if (row.error) throw row.error;
    if (row.data.image_path) {
      await supabaseAdmin.storage.from("floor-sprites").remove([row.data.image_path]);
    }
    const del = await supabaseAdmin.from("floor_assets").delete().eq("id", data.id);
    if (del.error) throw del.error;
    return { ok: true as const };
  });

export const listFloorSprites = createServerFn({ method: "GET" })
  .inputValidator((d: { floorId: string }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("floor_assets")
      .select("id, image_path").eq("floor_id", data.floorId).eq("kind", "sprite");
    if (error) throw error;
    const items = await Promise.all((rows ?? []).map(async (r) => {
      const s = r.image_path
        ? await supabaseAdmin.storage.from("floor-sprites").createSignedUrl(r.image_path, 60 * 60)
        : null;
      return { id: r.id, url: s?.data?.signedUrl ?? "" };
    }));
    return items;
  });

export type AdminFloorAsset = {
  id: string; kind: string; preset_id: string | null; image_path: string | null;
  x: number; y: number; z: number; rotation_y: number; scale: number; thumb: string | null;
};

export const listFloorAssetsAdmin = createServerFn({ method: "GET" })
  .inputValidator((d: { floorId: string }) => d)
  .handler(async ({ data }): Promise<AdminFloorAsset[]> => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("floor_assets")
      .select("id, kind, preset_id, image_path, x, y, z, rotation_y, scale")
      .eq("floor_id", data.floorId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return await Promise.all((rows ?? []).map(async (r) => {
      let thumb: string | null = null;
      if (r.image_path) {
        const s = await supabaseAdmin.storage.from("floor-sprites").createSignedUrl(r.image_path, 60 * 60);
        thumb = s.data?.signedUrl ?? null;
      }
      return { ...r, thumb } as AdminFloorAsset;
    }));
  });

export const updateFloorAsset = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; x: number; y: number; z: number; rotation_y: number; scale: number }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const upd = await supabaseAdmin.from("floor_assets").update({
      x: clamp(data.x, -9, 9),
      y: clamp(data.y, 0, 5),
      z: clamp(data.z, -9, 9),
      rotation_y: data.rotation_y,
      scale: clamp(data.scale, 0.2, 5),
    }).eq("id", data.id);
    if (upd.error) throw upd.error;
    return { ok: true as const };
  });

