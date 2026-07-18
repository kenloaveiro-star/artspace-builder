import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { THEMES, buildLayout, type Slot } from "./gallery-layouts";
import type { FloorTheme, FloorLayout } from "@/lib/floors.functions";
import { buildPreset, type PresetId } from "./preset-assets";
import type { FloorAsset } from "@/lib/floor-assets.functions";

export type Artwork = { id: string; title: string; url: string; width: number; height: number };

export type FloorConfig = {
  id: string;
  theme: FloorTheme;
  layout: FloorLayout;
  artworks: Artwork[];
  assets?: FloorAsset[];
};

interface Gallery3DProps {
  floor: FloorConfig;
}

export function Gallery3D({ floor }: Gallery3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const floorGroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const artworkMeshesRef = useRef<THREE.Mesh[]>([]);
  const homeRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 }>({
    pos: new THREE.Vector3(0, 1.6, 6),
    target: new THREE.Vector3(0, 1.5, 0),
  });
  const tweenRef = useRef<{
    active: boolean;
    startTime: number;
    duration: number;
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
  } | null>(null);
  const zoomedRef = useRef<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.copy(homeRef.current.pos);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(homeRef.current.target);
    controls.enableDamping = true;
    controls.minDistance = 0.5;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controlsRef.current = controls;

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
        const mesh = hits[0].object as THREE.Mesh;
        const id = (mesh.userData.id as string) ?? "";
        if (zoomedRef.current === id) {
          zoomTo(homeRef.current.pos, homeRef.current.target, 900);
          zoomedRef.current = null;
        } else {
          zoomToArtwork(mesh);
          zoomedRef.current = id;
        }
      } else if (zoomedRef.current) {
        zoomTo(homeRef.current.pos, homeRef.current.target, 900);
        zoomedRef.current = null;
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const tw = tweenRef.current;
      if (tw && tw.active) {
        const now = performance.now();
        const t = Math.min(1, (now - tw.startTime) / tw.duration);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        camera.position.lerpVectors(tw.fromPos, tw.toPos, e);
        controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e);
        if (t >= 1) tw.active = false;
      }
      controls.update();
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
      controls.dispose();
      disposeGroup(floorGroupRef.current);
      floorGroupRef.current = null;
      artworkMeshesRef.current = [];
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
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
    // clear old ambient/env
    const toRemove: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if ((o as THREE.AmbientLight).isAmbientLight) toRemove.push(o);
    });
    toRemove.forEach((o) => scene.remove(o));

    artworkMeshesRef.current = [];
    zoomedRef.current = null;
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.copy(homeRef.current.pos);
      controlsRef.current.target.copy(homeRef.current.target);
    }

    const theme = THEMES[floor.theme] ?? THEMES.wood;
    scene.background = new THREE.Color(theme.bg);
    scene.add(new THREE.AmbientLight(theme.ambient.color, theme.ambient.intensity));

    const group = new THREE.Group();
    floorGroupRef.current = group;

    const handle = requestAnimationFrame(() => {
      const slots = buildLayout(group, floor.layout, theme, floor.artworks.length);
      floor.artworks.forEach((art, i) => {
        const slot = slots[i % Math.max(slots.length, 1)];
        if (!slot) return;
        addFramedArtwork(group, art, slot, artworkMeshesRef.current);
      });
      (floor.assets ?? []).forEach((a) => addAsset(group, a));
      scene.add(group);
    });

    return () => cancelAnimationFrame(handle);
  }, [floor.id, floor.theme, floor.layout, floor.artworks, floor.assets]);

  function zoomTo(toPos: THREE.Vector3, toTarget: THREE.Vector3, duration = 900) {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    tweenRef.current = {
      active: true, startTime: performance.now(), duration,
      fromPos: cam.position.clone(), toPos: toPos.clone(),
      fromTarget: ctrl.target.clone(), toTarget: toTarget.clone(),
    };
  }

  function zoomToArtwork(mesh: THREE.Mesh) {
    const normal = (mesh.userData.normal as THREE.Vector3).clone();
    const center = (mesh.userData.center as THREE.Vector3).clone();
    const h = (mesh.userData.height as number) ?? 1.4;
    const cam = cameraRef.current;
    if (!cam) return;
    const fov = (cam.fov * Math.PI) / 180;
    const dist = (h / 2) / Math.tan(fov / 2) / 0.8;
    const camPos = center.clone().add(normal.clone().multiplyScalar(dist));
    zoomTo(camPos, center, 900);
  }

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
  // Position on the wall, offset slightly along normal into the room
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
  if (a.kind !== "preset" || !a.preset_id) return;
  const g = buildPreset(a.preset_id as PresetId, a.color ?? undefined);
  g.position.set(a.x, a.y, a.z);
  g.rotation.y = a.rotation_y;
  g.scale.setScalar(a.scale || 1);
  group.add(g);
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
