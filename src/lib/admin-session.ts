import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

export type AdminSession = { unlocked?: boolean };

export const adminSessionConfig = () => ({
  password: process.env.SESSION_SECRET!,
  name: "admin-gate",
  maxAge: 60 * 60 * 8,
  cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
});

export function pwMatch(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function requireAdmin() {
  const s = await useSession<AdminSession>(adminSessionConfig());
  if (!s.data.unlocked) throw new Error("Unauthorized");
  return s;
}
