import * as THREE from "three";
import type { FloorTheme, FloorLayout } from "@/lib/floors.functions";

export type ThemeConfig = {
  bg: number;
  floorColor: number;
  ceilColor: number;
  wallColor: number;
  ambient: { color: number; intensity: number };
  spot: { color: number; intensity: number };
};

export const THEMES: Record<FloorTheme, ThemeConfig> = {
  wood: {
    bg: 0x0a0a10,
    floorColor: 0x8b5a2b,
    ceilColor: 0xf5f5f0,
    wallColor: 0xf2ede4,
    ambient: { color: 0xffffff, intensity: 0.25 },
    spot: { color: 0xfff2d6, intensity: 8 },
  },
  marble: {
    bg: 0x101018,
    floorColor: 0xd8d8d8,
    ceilColor: 0xffffff,
    wallColor: 0xfafafa,
    ambient: { color: 0xffffff, intensity: 0.4 },
    spot: { color: 0xffffff, intensity: 7 },
  },
  dark: {
    bg: 0x050505,
    floorColor: 0x2a1e14,
    ceilColor: 0x1a1a1a,
    wallColor: 0x2b2b2f,
    ambient: { color: 0x333344, intensity: 0.15 },
    spot: { color: 0xffe8b8, intensity: 12 },
  },
  outdoor: {
    bg: 0x87ceeb,
    floorColor: 0x6b6b5a,
    ceilColor: 0xbfe3ff,
    wallColor: 0xdff0ff,
    ambient: { color: 0xffffff, intensity: 0.9 },
    spot: { color: 0xffffff, intensity: 3 },
  },
};

export type Slot = { pos: THREE.Vector3; normal: THREE.Vector3 };

/** Build room + return artwork slots. All slots are on interior walls. */
export function buildLayout(
  group: THREE.Group,
  layout: FloorLayout,
  theme: ThemeConfig,
  slotCount: number,
  textures?: { wallUrl?: string | null; floorUrl?: string | null },
): Slot[] {
  const wallMat = new THREE.MeshStandardMaterial({ color: theme.wallColor, roughness: 0.95 });
  const floorMat = new THREE.MeshStandardMaterial({ color: theme.floorColor, roughness: 0.85 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: theme.ceilColor, roughness: 1 });

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  if (textures?.wallUrl) {
    loader.load(textures.wallUrl, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(3, 1);
      t.colorSpace = THREE.SRGBColorSpace;
      wallMat.color.set(0xffffff);
      wallMat.map = t;
      wallMat.needsUpdate = true;
    });
  }
  if (textures?.floorUrl) {
    loader.load(textures.floorUrl, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(4, 4);
      t.colorSpace = THREE.SRGBColorSpace;
      floorMat.color.set(0xffffff);
      floorMat.map = t;
      floorMat.needsUpdate = true;
    });
  }

  const eye = 1.7;

  if (layout === "rect4") {
    const W = 20, D = 12, H = 4;
    addFloorCeil(group, W, D, H, floorMat, ceilMat);
    addWall(group, W, H, 0, H / 2, -D / 2, 0, wallMat);
    addWall(group, W, H, 0, H / 2, D / 2, Math.PI, wallMat);
    addWall(group, D, H, -W / 2, H / 2, 0, Math.PI / 2, wallMat);
    addWall(group, D, H, W / 2, H / 2, 0, -Math.PI / 2, wallMat);
    addSpots(group, theme, [[-6, 3.8, 0, -6, 1.5, -D / 2], [0, 3.8, 0, 0, 1.5, -D / 2], [6, 3.8, 0, 6, 1.5, -D / 2]]);
    // distribute across all 4 walls
    const walls = [
      { len: W, normal: new THREE.Vector3(0, 0, 1), axis: "x" as const, wall: -D / 2 },
      { len: D, normal: new THREE.Vector3(1, 0, 0), axis: "z" as const, wall: -W / 2 },
      { len: W, normal: new THREE.Vector3(0, 0, -1), axis: "x" as const, wall: D / 2 },
      { len: D, normal: new THREE.Vector3(-1, 0, 0), axis: "z" as const, wall: W / 2 },
    ];
    return distributeAcrossWalls(walls, slotCount, eye);
  }

  if (layout === "corridor") {
    const W = 24, D = 6, H = 4;
    addFloorCeil(group, W, D, H, floorMat, ceilMat);
    addWall(group, W, H, 0, H / 2, -D / 2, 0, wallMat);
    addWall(group, W, H, 0, H / 2, D / 2, Math.PI, wallMat);
    addWall(group, D, H, -W / 2, H / 2, 0, Math.PI / 2, wallMat);
    addWall(group, D, H, W / 2, H / 2, 0, -Math.PI / 2, wallMat);
    addSpots(group, theme, [[-8, 3.8, 0, -8, 1.5, -D / 2], [0, 3.8, 0, 0, 1.5, -D / 2], [8, 3.8, 0, 8, 1.5, -D / 2]]);
    const walls = [
      { len: W, normal: new THREE.Vector3(0, 0, 1), axis: "x" as const, wall: -D / 2 },
      { len: W, normal: new THREE.Vector3(0, 0, -1), axis: "x" as const, wall: D / 2 },
    ];
    return distributeAcrossWalls(walls, slotCount, eye);
  }

  // round: 8-sided polygon
  const sides = 8;
  const R = 8;
  const H = 4;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, sides * 4), floorMat);
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);
  const ceil = new THREE.Mesh(new THREE.CircleGeometry(R, sides * 4), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  group.add(ceil);
  const wallLen = 2 * R * Math.sin(Math.PI / sides);
  const inradius = R * Math.cos(Math.PI / sides);
  const slots: Slot[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 + Math.PI / sides;
    const cx = Math.sin(angle) * inradius;
    const cz = Math.cos(angle) * inradius;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(wallLen, H), wallMat);
    wall.position.set(cx, H / 2, cz);
    wall.lookAt(0, H / 2, 0);
    group.add(wall);
    slots.push({
      pos: new THREE.Vector3(cx, eye, cz),
      normal: new THREE.Vector3(-cx, 0, -cz).normalize(),
    });
  }
  addSpots(group, theme, [[0, 3.8, 0, 0, 1.5, -inradius]]);
  return slots.slice(0, Math.max(slotCount, slots.length));
}

function addFloorCeil(g: THREE.Group, W: number, D: number, H: number, fm: THREE.Material, cm: THREE.Material) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(W, D), fm);
  f.rotation.x = -Math.PI / 2;
  g.add(f);
  const c = new THREE.Mesh(new THREE.PlaneGeometry(W, D), cm);
  c.rotation.x = Math.PI / 2;
  c.position.y = H;
  g.add(c);
}

function addWall(g: THREE.Group, w: number, h: number, x: number, y: number, z: number, ry: number, m: THREE.Material) {
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  wall.position.set(x, y, z);
  wall.rotation.y = ry;
  g.add(wall);
}

function addSpots(g: THREE.Group, t: ThemeConfig, specs: number[][]) {
  for (const [x, y, z, tx, ty, tz] of specs) {
    const s = new THREE.SpotLight(t.spot.color, t.spot.intensity, 15, Math.PI / 6, 0.4, 1);
    s.position.set(x, y, z);
    s.target.position.set(tx, ty, tz);
    g.add(s);
    g.add(s.target);
  }
}

function distributeAcrossWalls(
  walls: { len: number; normal: THREE.Vector3; axis: "x" | "z"; wall: number }[],
  count: number,
  eye: number,
): Slot[] {
  if (count <= 0) return [];
  // Round-robin fill: 1 per wall, then 2, ...
  const perWall: number[] = walls.map(() => 0);
  for (let i = 0; i < count; i++) perWall[i % walls.length]++;
  const slots: Slot[] = [];
  walls.forEach((w, wi) => {
    const n = perWall[wi];
    if (!n) return;
    const spacing = w.len / (n + 1);
    for (let i = 0; i < n; i++) {
      const t = -w.len / 2 + spacing * (i + 1);
      const pos = new THREE.Vector3();
      if (w.axis === "x") {
        pos.set(t, eye, w.wall - 0.05 * Math.sign(w.normal.z || 1) + (w.normal.z > 0 ? 0.05 : -0.05));
        // simpler: place slot right on wall; artwork itself sits slightly in front via normal offset
        pos.set(t, eye, w.wall);
      } else {
        pos.set(w.wall, eye, t);
      }
      slots.push({ pos, normal: w.normal.clone() });
    }
  });
  return slots;
}
