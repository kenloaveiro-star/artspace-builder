import * as THREE from "three";

// Preset procedural assets — cheap, no external files.
// Each builder returns a THREE.Group centered at origin, footprint roughly 1 unit.
export type PresetId =
  | "tree"
  | "rock"
  | "cloud"
  | "star"
  | "castle"
  | "flower"
  | "mushroom"
  | "crystal";

export const PRESET_IDS: PresetId[] = [
  "tree",
  "rock",
  "cloud",
  "star",
  "castle",
  "flower",
  "mushroom",
  "crystal",
];

export const PRESET_LABELS: Record<PresetId, string> = {
  tree: "🌳 樹",
  rock: "🪨 石",
  cloud: "☁️ 雲",
  star: "⭐ 星",
  castle: "🏰 城堡",
  flower: "🌸 花",
  mushroom: "🍄 蘑菇",
  crystal: "💎 水晶",
};

function mat(color: number, opts: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts });
}

export function buildPreset(id: PresetId, colorHex?: string): THREE.Group {
  const g = new THREE.Group();
  const c = colorHex ? new THREE.Color(colorHex).getHex() : undefined;

  switch (id) {
    case "tree": {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.15, 0.6, 8),
        mat(0x8b5a2b)
      );
      trunk.position.y = 0.3;
      const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 0.9, 8),
        mat(c ?? 0x2e8b57)
      );
      leaves.position.y = 0.95;
      g.add(trunk, leaves);
      break;
    }
    case "rock": {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.4, 0),
        mat(c ?? 0x888888, { flatShading: true })
      );
      rock.position.y = 0.3;
      g.add(rock);
      break;
    }
    case "cloud": {
      const m = mat(c ?? 0xffffff, { roughness: 1 });
      [
        [0, 0, 0, 0.35],
        [0.3, 0.05, 0, 0.28],
        [-0.3, 0.05, 0, 0.28],
        [0.1, 0.2, 0.05, 0.22],
      ].forEach(([x, y, z, r]) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), m);
        s.position.set(x, y + 0.6, z);
        g.add(s);
      });
      break;
    }
    case "star": {
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.35, 0),
        mat(c ?? 0xffd700, { emissive: 0x664400, emissiveIntensity: 0.4 })
      );
      star.position.y = 0.5;
      g.add(star);
      break;
    }
    case "castle": {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.6, 0.8),
        mat(c ?? 0xd9d0c1)
      );
      base.position.y = 0.3;
      g.add(base);
      [-0.3, 0.3].forEach((x) =>
        [-0.3, 0.3].forEach((z) => {
          const tower = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8),
            mat(c ?? 0xd9d0c1)
          );
          tower.position.set(x, 0.45, z);
          const roof = new THREE.Mesh(
            new THREE.ConeGeometry(0.15, 0.25, 8),
            mat(0xb22222)
          );
          roof.position.set(x, 1.02, z);
          g.add(tower, roof);
        })
      );
      break;
    }
    case "flower": {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6),
        mat(0x4caf50)
      );
      stem.position.y = 0.25;
      const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 12, 12),
        mat(0xffeb3b)
      );
      center.position.y = 0.55;
      g.add(stem, center);
      const petalMat = mat(c ?? 0xff69b4);
      for (let i = 0; i < 6; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), petalMat);
        const a = (i / 6) * Math.PI * 2;
        p.position.set(Math.cos(a) * 0.14, 0.55, Math.sin(a) * 0.14);
        g.add(p);
      }
      break;
    }
    case "mushroom": {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, 0.35, 10),
        mat(0xfaf3e0)
      );
      stem.position.y = 0.175;
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        mat(c ?? 0xd7263d)
      );
      cap.position.y = 0.35;
      g.add(stem, cap);
      break;
    }
    case "crystal": {
      const crystal = new THREE.Mesh(
        new THREE.ConeGeometry(0.25, 0.8, 6),
        mat(c ?? 0x66ccff, {
          emissive: 0x224466,
          emissiveIntensity: 0.5,
          metalness: 0.3,
          roughness: 0.2,
        })
      );
      crystal.position.y = 0.4;
      g.add(crystal);
      break;
    }
  }

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
