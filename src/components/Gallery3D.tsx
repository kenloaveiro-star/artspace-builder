import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type Artwork = { id: string; title: string; url: string; width: number; height: number };

interface Gallery3DProps {
  floor: 1 | 2;
  artworks: Artwork[];
}

/**
 * 3D 畫廊場景。單一 mount 建立 renderer/scene/camera，
 * 切換樓層或畫作變更時只 rebuild 內部 group（正確 dispose geometry/material/texture）。
 */
export function Gallery3D({ floor, artworks }: Gallery3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const floorGroupRef = useRef<THREE.Group | null>(null);

  // Mount renderer once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a10);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 1.6, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.5, 0);
    controls.enableDamping = true;
    controls.minDistance = 2;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;

    // Ambient fill
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
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
      controls.dispose();
      disposeGroup(floorGroupRef.current);
      floorGroupRef.current = null;
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, []);

  // (Re)build floor group whenever floor or artworks change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Dispose old floor group
    if (floorGroupRef.current) {
      scene.remove(floorGroupRef.current);
      disposeGroup(floorGroupRef.current);
      floorGroupRef.current = null;
    }

    const group = new THREE.Group();
    floorGroupRef.current = group;

    // requestAnimationFrame per spec: async load next floor
    const handle = requestAnimationFrame(() => {
      if (floor === 1) {
        buildFloor1(group, artworks);
      } else {
        buildFloor2(group);
      }
      scene.add(group);
    });

    return () => cancelAnimationFrame(handle);
  }, [floor, artworks]);

  return <div ref={containerRef} className="w-full h-full" />;
}

// ---------- Floor builders ----------

function buildFloor1(group: THREE.Group, artworks: Artwork[]) {
  const roomW = 20;
  const roomD = 12;
  const roomH = 4;

  // Wood floor
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x8b5a2b,
    roughness: 0.85,
  });
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // Ceiling
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 1 });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = roomH;
  group.add(ceil);

  // Walls (paint white)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf2ede4, roughness: 0.95 });
  // Back wall
  const back = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), wallMat);
  back.position.set(0, roomH / 2, -roomD / 2);
  group.add(back);
  // Left wall
  const left = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMat);
  left.position.set(-roomW / 2, roomH / 2, 0);
  left.rotation.y = Math.PI / 2;
  group.add(left);
  // Right wall
  const right = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMat);
  right.position.set(roomW / 2, roomH / 2, 0);
  right.rotation.y = -Math.PI / 2;
  group.add(right);
  // Front wall with night window
  const frontMat = new THREE.MeshStandardMaterial({ color: 0xf2ede4, roughness: 0.95 });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), frontMat);
  front.position.set(0, roomH / 2, roomD / 2);
  front.rotation.y = Math.PI;
  group.add(front);
  // Night window (glowing dark blue panel)
  const windowMat = new THREE.MeshBasicMaterial({ color: 0x1a2a55 });
  const nightWindow = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), windowMat);
  nightWindow.position.set(0, 2, roomD / 2 - 0.01);
  nightWindow.rotation.y = Math.PI;
  group.add(nightWindow);
  // Window frame
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
  const frameGeo = new THREE.BoxGeometry(6.2, 0.1, 0.1);
  const topFrame = new THREE.Mesh(frameGeo, frameMat);
  topFrame.position.set(0, 3.05, roomD / 2 - 0.02);
  const botFrame = new THREE.Mesh(frameGeo, frameMat);
  botFrame.position.set(0, 0.95, roomD / 2 - 0.02);
  group.add(topFrame, botFrame);

  // Spotlights
  addSpotlight(group, -6, 3.8, 0, -6, 1.5, -roomD / 2);
  addSpotlight(group, 0, 3.8, 0, 0, 1.5, -roomD / 2);
  addSpotlight(group, 6, 3.8, 0, 6, 1.5, -roomD / 2);

  // Artworks along back wall
  if (artworks.length > 0) {
    const spacing = roomW / (artworks.length + 1);
    artworks.forEach((art, i) => {
      const x = -roomW / 2 + spacing * (i + 1);
      addFramedArtwork(group, art, x, 1.7, -roomD / 2 + 0.05);
    });
  }
}

function buildFloor2(group: THREE.Group) {
  const size = 12;
  const h = 4;
  const mat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = h;
  group.add(ceil);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf9f9f9, roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(size, h), wallMat);
    wall.position.y = h / 2;
    if (i === 0) wall.position.z = -size / 2;
    if (i === 1) {
      wall.position.z = size / 2;
      wall.rotation.y = Math.PI;
    }
    if (i === 2) {
      wall.position.x = -size / 2;
      wall.rotation.y = Math.PI / 2;
    }
    if (i === 3) {
      wall.position.x = size / 2;
      wall.rotation.y = -Math.PI / 2;
    }
    group.add(wall);
  }
  group.add(new THREE.AmbientLight(0xffffff, 0.6));
}

function addSpotlight(
  group: THREE.Group,
  x: number, y: number, z: number,
  tx: number, ty: number, tz: number,
) {
  const spot = new THREE.SpotLight(0xfff2d6, 8, 15, Math.PI / 6, 0.4, 1);
  spot.position.set(x, y, z);
  spot.target.position.set(tx, ty, tz);
  group.add(spot);
  group.add(spot.target);
}

function addFramedArtwork(
  group: THREE.Group,
  art: Artwork,
  x: number, y: number, z: number,
) {
  const maxW = 1.8;
  const maxH = 1.4;
  const ratio = art.width / art.height;
  let w = maxW;
  let h = maxW / ratio;
  if (h > maxH) {
    h = maxH;
    w = maxH * ratio;
  }

  // Black frame
  const frameThickness = 0.08;
  const frameDepth = 0.05;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4 });
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(w + frameThickness * 2, h + frameThickness * 2, frameDepth),
    frameMat,
  );
  frame.position.set(x, y, z);
  group.add(frame);

  // Canvas with texture
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  const tex = loader.load(art.url);
  tex.colorSpace = THREE.SRGBColorSpace;
  const canvasMat = new THREE.MeshBasicMaterial({ map: tex });
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), canvasMat);
  canvas.position.set(x, y, z + frameDepth / 2 + 0.001);
  group.add(canvas);
}

// ---------- Dispose helpers ----------

function disposeGroup(group: THREE.Group | null) {
  if (!group) return;
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = (mesh as THREE.Mesh).material as
      | THREE.Material
      | THREE.Material[]
      | undefined;
    if (Array.isArray(mat)) mat.forEach(disposeMaterial);
    else if (mat) disposeMaterial(mat);
  });
}

function disposeMaterial(mat: THREE.Material) {
  const anyMat = mat as unknown as Record<string, unknown>;
  for (const key of Object.keys(anyMat)) {
    const value = anyMat[key];
    if (value && (value as THREE.Texture).isTexture) {
      (value as THREE.Texture).dispose();
    }
  }
  mat.dispose();
}
