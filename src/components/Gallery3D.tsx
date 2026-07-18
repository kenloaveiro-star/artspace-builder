import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type Artwork = { id: string; title: string; url: string; width: number; height: number };

interface Gallery3DProps {
  floor: 1 | 2;
  artworks: Artwork[];
}

/**
 * 3D 畫廊場景。點擊畫作會鏡頭飛埋去（放大效果），再點空白位或再點畫作會返回原位。
 */
export function Gallery3D({ floor, artworks }: Gallery3DProps) {
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

    scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const downPos = { x: 0, y: 0, t: 0 };

    const onPointerDown = (e: PointerEvent) => {
      downPos.x = e.clientX;
      downPos.y = e.clientY;
      downPos.t = performance.now();
    };
    const onPointerUp = (e: PointerEvent) => {
      // treat as click only if small movement + short time
      const dx = e.clientX - downPos.x;
      const dy = e.clientY - downPos.y;
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
          // toggle: same art -> go home
          zoomTo(homeRef.current.pos, homeRef.current.target, 900);
          zoomedRef.current = null;
        } else {
          zoomToArtwork(mesh);
          zoomedRef.current = id;
        }
      } else if (zoomedRef.current) {
        // click empty -> back
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
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
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
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      rendererRef.current = null;
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
    artworkMeshesRef.current = [];
    zoomedRef.current = null;
    // reset camera to home when floor/artworks change
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.copy(homeRef.current.pos);
      controlsRef.current.target.copy(homeRef.current.target);
    }

    const group = new THREE.Group();
    floorGroupRef.current = group;

    const handle = requestAnimationFrame(() => {
      if (floor === 1) {
        buildFloor1(group, artworks, artworkMeshesRef.current);
      } else {
        buildFloor2(group);
      }
      scene.add(group);
    });

    return () => cancelAnimationFrame(handle);
  }, [floor, artworks]);

  function zoomTo(toPos: THREE.Vector3, toTarget: THREE.Vector3, duration = 900) {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    tweenRef.current = {
      active: true,
      startTime: performance.now(),
      duration,
      fromPos: cam.position.clone(),
      toPos: toPos.clone(),
      fromTarget: ctrl.target.clone(),
      toTarget: toTarget.clone(),
    };
  }

  function zoomToArtwork(mesh: THREE.Mesh) {
    // mesh.userData: {id, normal:Vector3, center:Vector3, height:number}
    const normal = (mesh.userData.normal as THREE.Vector3).clone();
    const center = (mesh.userData.center as THREE.Vector3).clone();
    const h = (mesh.userData.height as number) ?? 1.4;
    const cam = cameraRef.current;
    if (!cam) return;
    // distance so artwork fills ~80% of vertical FOV
    const fov = (cam.fov * Math.PI) / 180;
    const dist = (h / 2) / Math.tan(fov / 2) / 0.8;
    const camPos = center.clone().add(normal.clone().multiplyScalar(dist));
    zoomTo(camPos, center, 900);
  }

  return <div ref={containerRef} className="w-full h-full cursor-pointer" />;
}

// ---------- Floor builders ----------

function buildFloor1(group: THREE.Group, artworks: Artwork[], meshOut: THREE.Mesh[]) {
  const roomW = 20;
  const roomD = 12;
  const roomH = 4;

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85 });
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 1 });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = roomH;
  group.add(ceil);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf2ede4, roughness: 0.95 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), wallMat);
  back.position.set(0, roomH / 2, -roomD / 2);
  group.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMat);
  left.position.set(-roomW / 2, roomH / 2, 0);
  left.rotation.y = Math.PI / 2;
  group.add(left);
  const right = new THREE.Mesh(new THREE.PlaneGeometry(roomD, roomH), wallMat);
  right.position.set(roomW / 2, roomH / 2, 0);
  right.rotation.y = -Math.PI / 2;
  group.add(right);
  const frontMat = new THREE.MeshStandardMaterial({ color: 0xf2ede4, roughness: 0.95 });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomH), frontMat);
  front.position.set(0, roomH / 2, roomD / 2);
  front.rotation.y = Math.PI;
  group.add(front);
  const windowMat = new THREE.MeshBasicMaterial({ color: 0x1a2a55 });
  const nightWindow = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), windowMat);
  nightWindow.position.set(0, 2, roomD / 2 - 0.01);
  nightWindow.rotation.y = Math.PI;
  group.add(nightWindow);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
  const frameGeo = new THREE.BoxGeometry(6.2, 0.1, 0.1);
  const topFrame = new THREE.Mesh(frameGeo, frameMat);
  topFrame.position.set(0, 3.05, roomD / 2 - 0.02);
  const botFrame = new THREE.Mesh(frameGeo, frameMat);
  botFrame.position.set(0, 0.95, roomD / 2 - 0.02);
  group.add(topFrame, botFrame);

  addSpotlight(group, -6, 3.8, 0, -6, 1.5, -roomD / 2);
  addSpotlight(group, 0, 3.8, 0, 0, 1.5, -roomD / 2);
  addSpotlight(group, 6, 3.8, 0, 6, 1.5, -roomD / 2);

  if (artworks.length > 0) {
    const spacing = roomW / (artworks.length + 1);
    artworks.forEach((art, i) => {
      const x = -roomW / 2 + spacing * (i + 1);
      addFramedArtwork(group, art, x, 1.7, -roomD / 2 + 0.05, meshOut);
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
    if (i === 1) { wall.position.z = size / 2; wall.rotation.y = Math.PI; }
    if (i === 2) { wall.position.x = -size / 2; wall.rotation.y = Math.PI / 2; }
    if (i === 3) { wall.position.x = size / 2; wall.rotation.y = -Math.PI / 2; }
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
  meshOut: THREE.Mesh[],
) {
  const maxW = 1.8;
  const maxH = 1.4;
  const ratio = art.width / art.height;
  let w = maxW;
  let h = maxW / ratio;
  if (h > maxH) { h = maxH; w = maxH * ratio; }

  const frameThickness = 0.08;
  const frameDepth = 0.05;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4 });
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(w + frameThickness * 2, h + frameThickness * 2, frameDepth),
    frameMat,
  );
  frame.position.set(x, y, z);
  group.add(frame);

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  const tex = loader.load(art.url);
  tex.colorSpace = THREE.SRGBColorSpace;
  const canvasMat = new THREE.MeshBasicMaterial({ map: tex });
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), canvasMat);
  canvas.position.set(x, y, z + frameDepth / 2 + 0.001);
  // Assumes back wall (normal +Z). Extend when other walls are used.
  canvas.userData = {
    id: art.id,
    normal: new THREE.Vector3(0, 0, 1),
    center: canvas.position.clone(),
    height: h,
  };
  group.add(canvas);
  meshOut.push(canvas);
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
