import { useEffect, useRef } from "react";
import * as THREE from "three";
import { THEMES, buildLayout, type Slot } from "./gallery-layouts";
import type { FloorTheme, FloorLayout } from "@/lib/floors.functions";
import { buildPreset, type PresetId } from "./preset-assets";
import type { FloorAsset } from "@/lib/floor-assets.functions";
import { playerInput, installKeyboardControls } from "@/lib/player-input";
import kidImageUrl from "@/assets/kid-character-back.png";

export type Artwork = { id: string; title: string; url: string; width: number; height: number };

export type FloorConfig = {
  id: string;
  theme: FloorTheme;
  layout: FloorLayout;
  artworks: Artwork[];
  assets?: FloorAsset[];
  wallTextureUrl?: string | null;
  floorTextureUrl?: string | null;
};

interface Gallery3DProps {
  floor: FloorConfig;
}

// Room half-extents per layout — keeps player inside walls.
function bounds(layout: FloorLayout) {
  if (layout === "corridor") return { kind: "rect" as const, hx: 11.2, hz: 2.5 };
  if (layout === "round") return { kind: "round" as const, r: 7.2 };
  return { kind: "rect" as const, hx: 9.3, hz: 5.5 };
}

export function Gallery3D({ floor }: Gallery3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const floorGroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const kidRef = useRef<THREE.Sprite | null>(null);
  const artworkMeshesRef = useRef<THREE.Mesh[]>([]);
  const layoutRef = useRef<FloorLayout>(floor.layout);

  // player state
  const playerRef = useRef({
    pos: new THREE.Vector3(0, 0, 4),
    yaw: Math.PI,
  });
  const autoWalkRef = useRef<{ target: THREE.Vector3; faceYaw: number } | null>(null);
  const zoomRef = useRef<{ camPos: THREE.Vector3; lookAt: THREE.Vector3 } | null>(null);


  useEffect(() => {
    installKeyboardControls();
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Kid sprite (billboard — always faces camera).
    const tex = new THREE.TextureLoader().load(kidImageUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    const kidMat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.05 });
    const kid = new THREE.Sprite(kidMat);
    kid.scale.set(1.5, 1.55, 1);
    scene.add(kid);
    kidRef.current = kid;

    // Click-to-walk on artwork.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const downPos = { x: 0, y: 0, t: 0 };
    const onPointerDown = (e: PointerEvent) => {
      downPos.x = e.clientX; downPos.y = e.clientY; downPos.t = performance.now();
    };
    const onPointerUp = (e: PointerEvent) => {
      const dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
      const dt = performance.now() - downPos.t;
      if (dx * dx + dy * dy > 25 || dt > 400) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(artworkMeshesRef.current, false);
      if (hits.length > 0) {
        // If already zoomed, second click exits zoom.
        if (zoomRef.current) { zoomRef.current = null; return; }
        const mesh = hits[0].object as THREE.Mesh;
        const normal = (mesh.userData.normal as THREE.Vector3).clone();
        const center = (mesh.userData.center as THREE.Vector3).clone();
        const h = (mesh.userData.height as number) || 1.2;
        // Camera flies in front of painting at painting height.
        const dist = Math.max(1.4, h * 1.3);
        const camPos = center.clone().add(normal.clone().multiplyScalar(dist));
        zoomRef.current = { camPos, lookAt: center };
      } else if (zoomRef.current) {
        // Click empty area exits zoom.
        zoomRef.current = null;
      }
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    let raf = 0;
    let last = performance.now();
    const tmpForward = new THREE.Vector3();
    const camOffset = new THREE.Vector3();
    const camTarget = new THREE.Vector3();
    layoutRef.current = floor.layout;


    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const p = playerRef.current;
      const SPEED = 3.2, TURN = 2.4;

      let fwd = playerInput.forward;
      let turn = playerInput.turn;

      // Auto-walk toward clicked artwork.
      const aw = autoWalkRef.current;
      if (aw) {
        const dx = aw.target.x - p.pos.x;
        const dz = aw.target.z - p.pos.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < 0.05) {
          // snap yaw
          let dyaw = aw.faceYaw - p.yaw;
          while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
          while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
          if (Math.abs(dyaw) < 0.05) {
            autoWalkRef.current = null;
          } else {
            p.yaw += Math.sign(dyaw) * Math.min(Math.abs(dyaw), TURN * dt);
          }
          fwd = 0; turn = 0;
        } else {
          const desiredYaw = Math.atan2(dx, dz); // face direction of travel
          let dyaw = desiredYaw - p.yaw;
          while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
          while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
          p.yaw += Math.sign(dyaw) * Math.min(Math.abs(dyaw), TURN * 1.6 * dt);
          fwd = 1;
          turn = 0;
        }
      }

      p.yaw += turn * TURN * dt;
      tmpForward.set(Math.sin(p.yaw), 0, Math.cos(p.yaw));
      p.pos.x += tmpForward.x * fwd * SPEED * dt;
      p.pos.z += tmpForward.z * fwd * SPEED * dt;

      // clamp to room bounds
      const b = bounds(layoutRef.current);
      if (b.kind === "rect") {
        p.pos.x = Math.max(-b.hx, Math.min(b.hx, p.pos.x));
        p.pos.z = Math.max(-b.hz, Math.min(b.hz, p.pos.z));
      } else {
        const r = Math.hypot(p.pos.x, p.pos.z);
        if (r > b.r) {
          p.pos.x *= b.r / r;
          p.pos.z *= b.r / r;
        }
      }

      // place kid
      kid.position.set(p.pos.x, 0.85, p.pos.z);
      // small bob when walking
      if (Math.abs(fwd) > 0.1) {
        kid.position.y = 0.85 + Math.sin(now * 0.012) * 0.04;
      }

      // third-person camera OR zoomed-in on painting
      const z = zoomRef.current;
      if (z) {
        camera.position.x += (z.camPos.x - camera.position.x) * Math.min(1, dt * 4);
        camera.position.y += (z.camPos.y - camera.position.y) * Math.min(1, dt * 4);
        camera.position.z += (z.camPos.z - camera.position.z) * Math.min(1, dt * 4);
        camera.lookAt(z.lookAt);
      } else {
        const behindDist = 3.8;
        const height = 2.1;
        camOffset.set(-Math.sin(p.yaw) * behindDist, height, -Math.cos(p.yaw) * behindDist);
        const desiredCamX = p.pos.x + camOffset.x;
        const desiredCamZ = p.pos.z + camOffset.z;
        camera.position.x += (desiredCamX - camera.position.x) * Math.min(1, dt * 8);
        camera.position.y += (height - camera.position.y) * Math.min(1, dt * 8);
        camera.position.z += (desiredCamZ - camera.position.z) * Math.min(1, dt * 8);
        camTarget.set(p.pos.x, 1.4, p.pos.z);
        camera.lookAt(camTarget);
      }

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      disposeGroup(floorGroupRef.current);
      floorGroupRef.current = null;
      artworkMeshesRef.current = [];
      if (kidRef.current) {
        scene.remove(kidRef.current);
        kidRef.current.material.map?.dispose();
        kidRef.current.material.dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (floorGroupRef.current) {
      scene.remove(floorGroupRef.current);
      disposeGroup(floorGroupRef.current);
      floorGroupRef.current = null;
    }
    const toRemove: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if ((o as THREE.AmbientLight).isAmbientLight) toRemove.push(o);
    });
    toRemove.forEach((o) => scene.remove(o));

    artworkMeshesRef.current = [];
    autoWalkRef.current = null;
    // reset player to safe starting position for new floor
    playerRef.current.pos.set(0, 0, 3);
    playerRef.current.yaw = Math.PI;
    layoutRef.current = floor.layout;

    const theme = THEMES[floor.theme] ?? THEMES.wood;
    scene.background = new THREE.Color(theme.bg);
    scene.add(new THREE.AmbientLight(theme.ambient.color, theme.ambient.intensity));

    const group = new THREE.Group();
    floorGroupRef.current = group;

    const handle = requestAnimationFrame(() => {
      const slots = buildLayout(group, floor.layout, theme, floor.artworks.length, {
        wallUrl: floor.wallTextureUrl, floorUrl: floor.floorTextureUrl,
      });
      floor.artworks.forEach((art, i) => {
        const slot = slots[i % Math.max(slots.length, 1)];
        if (!slot) return;
        addFramedArtwork(group, art, slot, artworkMeshesRef.current);
      });
      (floor.assets ?? []).forEach((a) => addAsset(group, a));
      scene.add(group);
    });

    return () => cancelAnimationFrame(handle);
  }, [floor.id, floor.theme, floor.layout, floor.artworks, floor.assets, floor.wallTextureUrl, floor.floorTextureUrl]);

  return <div ref={containerRef} className="w-full h-full cursor-pointer" />;
}

function addFramedArtwork(group: THREE.Group, art: Artwork, slot: Slot, meshOut: THREE.Mesh[]) {
  const maxW = 1.8, maxH = 1.4;
  const ratio = art.width / art.height;
  let w = maxW, h = maxW / ratio;
  if (h > maxH) { h = maxH; w = maxH * ratio; }

  const frameThickness = 0.08, frameDepth = 0.05;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4 });
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(w + frameThickness * 2, h + frameThickness * 2, frameDepth),
    frameMat,
  );
  const wallOffset = slot.normal.clone().multiplyScalar(0.05);
  frame.position.copy(slot.pos).add(wallOffset);
  frame.lookAt(frame.position.clone().add(slot.normal));
  group.add(frame);

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  const tex = loader.load(art.url);
  tex.colorSpace = THREE.SRGBColorSpace;
  const canvasMat = new THREE.MeshBasicMaterial({ map: tex });
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), canvasMat);
  const canvasPos = frame.position.clone().add(slot.normal.clone().multiplyScalar(frameDepth / 2 + 0.001));
  canvas.position.copy(canvasPos);
  canvas.lookAt(canvasPos.clone().add(slot.normal));
  canvas.userData = {
    id: art.id,
    normal: slot.normal.clone(),
    center: canvas.position.clone(),
    height: h,
  };
  group.add(canvas);
  meshOut.push(canvas);
}

function addAsset(group: THREE.Group, a: FloorAsset) {
  if (a.kind === "preset" && a.preset_id) {
    const g = buildPreset(a.preset_id as PresetId, a.color ?? undefined);
    g.position.set(a.x, a.y, a.z);
    g.rotation.y = a.rotation_y;
    g.scale.setScalar(a.scale || 1);
    group.add(g);
    return;
  }
  if (a.kind === "sprite" && a.image_url) {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const tex = loader.load(a.image_url, (t) => {
      const ratio = t.image.width / t.image.height;
      const h = a.scale || 1.4;
      sprite.scale.set(h * ratio, h, 1);
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.05 });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(a.x, a.y, a.z);
    sprite.scale.set(a.scale || 1.4, a.scale || 1.4, 1);
    group.add(sprite);
  }
}

function disposeGroup(group: THREE.Group | null) {
  if (!group) return;
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach(disposeMaterial);
    else if (mat) disposeMaterial(mat);
  });
}

function disposeMaterial(mat: THREE.Material) {
  const anyMat = mat as unknown as Record<string, unknown>;
  for (const key of Object.keys(anyMat)) {
    const value = anyMat[key];
    if (value && (value as THREE.Texture).isTexture) (value as THREE.Texture).dispose();
  }
  mat.dispose();
}
