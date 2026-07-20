import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { playerInput, installKeyboardControls } from "@/lib/player-input";
import kidImageUrl from "@/assets/kid-character-back.png";

interface Arcade3DProps {
  onOpenArcade: () => void;
}

// A cute, kid-friendly arcade "game center" scene with one playable cabinet.
export function Arcade3D({ onOpenArcade }: Arcade3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nearCabinet, setNearCabinet] = useState(false);
  const onOpenRef = useRef(onOpenArcade);
  useEffect(() => { onOpenRef.current = onOpenArcade; }, [onOpenArcade]);

  useEffect(() => {
    installKeyboardControls();
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1a0a2e");
    scene.fog = new THREE.Fog("#1a0a2e", 12, 26);

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // ===== Cute checkerboard floor =====
    const floorTex = (() => {
      const c = document.createElement("canvas"); c.width = 256; c.height = 256;
      const ctx = c.getContext("2d")!;
      const cols = ["#ff8bd0", "#7dd3fc", "#fde68a", "#c4b5fd"];
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          ctx.fillStyle = cols[(x + y) % cols.length];
          ctx.fillRect(x * 32, y * 32, 32, 32);
        }
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(4, 4);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }),
    );
    floorMesh.rotation.x = -Math.PI / 2;
    scene.add(floorMesh);

    // ===== Walls (cute pastel gradient) =====
    const wallTex = (() => {
      const c = document.createElement("canvas"); c.width = 256; c.height = 256;
      const ctx = c.getContext("2d")!;
      const grd = ctx.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, "#3b1e5e");
      grd.addColorStop(0.5, "#7b3fa5");
      grd.addColorStop(1, "#2a0a4a");
      ctx.fillStyle = grd; ctx.fillRect(0, 0, 256, 256);
      // stars
      ctx.fillStyle = "#fff8c9";
      for (let i = 0; i < 60; i++) {
        const x = Math.random() * 256, y = Math.random() * 256, r = Math.random() * 1.6 + 0.4;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(3, 1);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 });
    const HX = 12, HZ = 12, WH = 6;
    const mkWall = (w: number, h: number) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    const wN = mkWall(HX * 2, WH); wN.position.set(0, WH / 2, -HZ); scene.add(wN);
    const wS = mkWall(HX * 2, WH); wS.position.set(0, WH / 2, HZ); wS.rotation.y = Math.PI; scene.add(wS);
    const wE = mkWall(HZ * 2, WH); wE.position.set(HX, WH / 2, 0); wE.rotation.y = -Math.PI / 2; scene.add(wE);
    const wW = mkWall(HZ * 2, WH); wW.position.set(-HX, WH / 2, 0); wW.rotation.y = Math.PI / 2; scene.add(wW);

    // ===== Lighting: soft ambient + colored neon spots =====
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const neonColors = [0xff5fb0, 0x5fd0ff, 0xffe066, 0xa78bfa];
    neonColors.forEach((col, i) => {
      const p = new THREE.PointLight(col, 1.2, 22, 1.5);
      const angle = (i / neonColors.length) * Math.PI * 2;
      p.position.set(Math.cos(angle) * 8, 5.2, Math.sin(angle) * 8);
      scene.add(p);
    });
    const key = new THREE.DirectionalLight(0xffffff, 0.6);
    key.position.set(4, 8, 6);
    scene.add(key);

    // ===== Arcade cabinet (center) =====
    const cabinet = new THREE.Group();
    cabinet.position.set(0, 0, 0);
    scene.add(cabinet);

    // body
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff5fb0, roughness: 0.4, metalness: 0.2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 1.1), bodyMat);
    body.position.y = 1.1;
    cabinet.add(body);
    // top hat
    const hat = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.35, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x5fd0ff, roughness: 0.4 }),
    );
    hat.position.y = 2.4; cabinet.add(hat);
    // marquee text
    const marqueeTex = (() => {
      const c = document.createElement("canvas"); c.width = 512; c.height = 128;
      const ctx = c.getContext("2d")!;
      const g = ctx.createLinearGradient(0, 0, 512, 0);
      g.addColorStop(0, "#ff6ac1"); g.addColorStop(0.5, "#fde047"); g.addColorStop(1, "#7dd3fc");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = "#1a0a2e";
      ctx.font = "bold 72px system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🎮 ARCADE 🎮", 256, 66);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const marquee = new THREE.Mesh(
      new THREE.PlaneGeometry(1.55, 0.32),
      new THREE.MeshBasicMaterial({ map: marqueeTex }),
    );
    marquee.position.set(0, 2.4, 0.61); cabinet.add(marquee);

    // screen (emissive)
    const screenTex = (() => {
      const c = document.createElement("canvas"); c.width = 512; c.height = 384;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#0a0a20"; ctx.fillRect(0, 0, 512, 384);
      // pixel grid
      ctx.fillStyle = "#7dd3fc";
      for (let i = 0; i < 40; i++) {
        ctx.fillRect(Math.random() * 512, Math.random() * 384, 4, 4);
      }
      ctx.fillStyle = "#fde047";
      ctx.font = "bold 84px system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("PRESS", 256, 140);
      ctx.fillStyle = "#ff6ac1";
      ctx.fillText("START", 256, 240);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.0),
      new THREE.MeshStandardMaterial({
        map: screenTex, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0.9,
      }),
    );
    screen.position.set(0, 1.75, 0.56);
    screen.rotation.x = -0.15;
    screen.userData.arcadeInteract = true;
    cabinet.add(screen);

    // control panel
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.25, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x2a1a4a, roughness: 0.6 }),
    );
    panel.position.set(0, 1.05, 0.5);
    panel.rotation.x = -0.35;
    panel.userData.arcadeInteract = true;
    cabinet.add(panel);
    // joystick
    const stickBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16),
      new THREE.MeshStandardMaterial({ color: 0x111 }),
    );
    stickBase.position.set(-0.35, 1.18, 0.62); cabinet.add(stickBase);
    const stickBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xff3b6b, emissive: 0x662233, emissiveIntensity: 0.4 }),
    );
    stickBall.position.set(-0.35, 1.28, 0.62); cabinet.add(stickBall);
    // buttons
    const btnColors = [0xffdd33, 0x33ddff, 0xff66cc];
    btnColors.forEach((col, i) => {
      const b = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.04, 16),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35 }),
      );
      b.rotation.x = Math.PI / 2;
      b.position.set(0.15 + i * 0.2, 1.2, 0.6);
      cabinet.add(b);
    });

    // ===== Kid sprite =====
    const kidTex = new THREE.TextureLoader().load(kidImageUrl);
    kidTex.colorSpace = THREE.SRGBColorSpace;
    const kid = new THREE.Sprite(new THREE.SpriteMaterial({ map: kidTex, transparent: true, alphaTest: 0.05 }));
    kid.scale.set(1.5, 1.55, 1);
    scene.add(kid);

    // Player state
    const player = { pos: new THREE.Vector3(0, 0, 5), yaw: Math.PI };

    // Pointer picking for cabinet click
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const cabinetTargets: THREE.Object3D[] = [];
    cabinet.traverse((o) => { if (o.userData?.arcadeInteract) cabinetTargets.push(o); });

    const onClick = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(cabinetTargets, false);
      if (hits.length > 0) {
        onOpenRef.current();
      }
    };
    renderer.domElement.addEventListener("pointerup", onClick);

    // ===== Loop =====
    let raf = 0;
    let last = performance.now();
    const camOffset = new THREE.Vector3();
    const camTarget = new THREE.Vector3();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Input (forward/turn model, same as Gallery3D)
      const inp = playerInput;
      const turnSpeed = 2.4;
      const moveSpeed = 3.4;
      player.yaw -= inp.turn * turnSpeed * dt;
      if (Math.abs(inp.forward) > 0.01) {
        const step = inp.forward * moveSpeed * dt;
        player.pos.x += Math.sin(player.yaw) * step;
        player.pos.z += Math.cos(player.yaw) * step;
      }
      // Clamp to room
      player.pos.x = Math.max(-HX + 1, Math.min(HX - 1, player.pos.x));
      player.pos.z = Math.max(-HZ + 1, Math.min(HZ - 1, player.pos.z));
      // Push out of cabinet radius
      const dx = player.pos.x, dz = player.pos.z;
      const distC = Math.sqrt(dx * dx + dz * dz);
      if (distC < 1.6) {
        const nx = dx / (distC || 1), nz = dz / (distC || 1);
        player.pos.x = nx * 1.6; player.pos.z = nz * 1.6;
      }
      kid.position.set(player.pos.x, 0.77, player.pos.z);

      // Third-person camera
      camOffset.set(-Math.sin(player.yaw) * 3.5, 2.4, -Math.cos(player.yaw) * 3.5);
      const desired = player.pos.clone().add(camOffset);
      camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
      camTarget.set(player.pos.x, 1.2, player.pos.z);
      camera.lookAt(camTarget);

      // Proximity prompt
      const near = distC < 3.2;
      setNearCabinet((prev) => (prev === near ? prev : near));

      // Marquee shimmer
      marquee.material.opacity = 0.85 + 0.15 * Math.sin(now * 0.005);
      marquee.material.transparent = true;

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerup", onClick);
      renderer.dispose();
      floorTex.dispose(); wallTex.dispose(); marqueeTex.dispose(); screenTex.dispose(); kidTex.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {nearCabinet && (
        <button
          onClick={onOpenArcade}
          className="pointer-events-auto absolute left-1/2 top-[62%] z-10 -translate-x-1/2 animate-bounce rounded-full border-4 border-yellow-300 bg-gradient-to-b from-pink-400 to-pink-500 px-6 py-3 text-base font-black text-white shadow-2xl"
        >
          🕹️ 按呢度玩遊戲!
        </button>
      )}
    </div>
  );
}
