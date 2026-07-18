import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type AdminSession = { unlocked?: boolean };

const sessionConfig = () => ({
  password: process.env.SESSION_SECRET!,
  name: "admin-gate",
  maxAge: 60 * 60 * 8,
  cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
});

function pwMatch(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

async function requireAdmin() {
  const s = await useSession<AdminSession>(sessionConfig());
  if (!s.data.unlocked) throw new Error("Unauthorized");
  return s;
}

export const unlockAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) throw new Error("ADMIN_PASSWORD not set");
    if (!pwMatch(data.password, expected)) return { ok: false as const };
    const s = await useSession<AdminSession>(sessionConfig());
    await s.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const s = await useSession<AdminSession>(sessionConfig());
  await s.clear();
  return { ok: true as const };
});

export const checkAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const s = await useSession<AdminSession>(sessionConfig());
  return { unlocked: !!s.data.unlocked };
});

export const uploadArtwork = createServerFn({ method: "POST" })
  .inputValidator((d: { title: string; dataUrl: string; width: number; height: number }) => d)
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
      title: data.title, storage_path: path, width: data.width, height: data.height,
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
    .from("artworks").select("id, title, storage_path, width, height, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const items = await Promise.all((data ?? []).map(async (a) => {
    const s = await supabaseAdmin.storage.from("artworks").createSignedUrl(a.storage_path, 60 * 60);
    return { id: a.id, title: a.title, width: a.width, height: a.height, url: s.data?.signedUrl ?? "" };
  }));
  return items;
});
