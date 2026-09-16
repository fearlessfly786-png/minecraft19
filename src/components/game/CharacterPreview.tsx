'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MD2Character } from 'three/examples/jsm/misc/MD2Character.js';

/**
 * Live 3D costume preview for the CHARACTER lobby panel ("dressing room").
 *
 * A fully self-contained Three.js scene (own canvas + WebGL context, alpha
 * transparent so the panel glass shows through) that loads the SAME Quake 2
 * MD2 hero the in-game lobby showcases. Whatever costume/weapon the player
 * clicks in the rack is applied here LIVE — and simultaneously on the real
 * lobby/game model through the shared apiRef -> loadout flow.
 *
 * Framing guarantees (Tasks 7-9):
 *  - The model is normalized to PREVIEW_HEIGHT and its XZ centroid is baked
 *    onto the turntable axis, so it stays centred at every rotation angle.
 *  - The camera aims at the model's vertical midpoint, centring it in the
 *    container both vertically and horizontally.
 *  - renderer.setSize(w, h) is called WITH style updates so the canvas CSS
 *    size always equals its container at ANY devicePixelRatio (the buffer
 *    still scales with setPixelRatio for crisp HiDPI rendering).
 */

/** World height the previewed hero is normalized to (slightly smaller than
 *  the game's 1.9 so the showcase figure reads as a display-room piece). */
const PREVIEW_HEIGHT = 1.65;

/** Camera framing: aims at the model's vertical midpoint (PREVIEW_HEIGHT/2)
 *  so the figure sits dead-centre at every turntable angle. */
const CAMERA_FOV = 32;
const CAMERA_POS_Y = 1.05;
const CAMERA_DIST = 4.1;

/** Podium radii (disc / amber ring outer edge), matched to the model size. */
const PODIUM_DISC_R = 0.8;
const PODIUM_RING_INNER = 0.8;
const PODIUM_RING_OUTER = 0.87;

/** MD2 config — mirrors the in-game hero exactly (page.tsx loadParts). */
const MODEL_BASE_URL = '/models/md2/ratamahatta/';
const MODEL_BODY = 'ratamahatta.md2';
const MODEL_SKINS = [
  'ratamahatta.png',
  'ctf_b.png',
  'ctf_r.png',
  'dead.png',
  'gearwhore.png',
  'skin_gold.png',
  'skin_toxin.png',
  'skin_shadow.png',
  'skin_frost.png',
  'skin_magma.png',
];
const MODEL_WEAPONS: Array<[string, string]> = [
  ['weapon.md2', 'weapon.png'],
  ['w_shotgun.md2', 'w_shotgun.png'],
  ['w_chaingun.md2', 'w_chaingun.png'],
  ['w_railgun.md2', 'w_railgun.png'],
];
/** Loadout entries above the last mesh weapon map to "unarmed" (-1). */
const MESH_WEAPON_COUNT = MODEL_WEAPONS.length;

/** Slow turntable speed + drag sensitivity (rad/s). */
const AUTO_SPIN_SPEED = 0.5;
const DRAG_SENSITIVITY = 0.012;

interface CharacterPreviewProps {
  /** Equipped skin (index into MODEL_SKINS) — applied live on change. */
  skinIndex: number;
  /** Equipped loadout weapon (index into the 5-entry loadout list; the
   *  trailing Unarmed entry maps to -1 = no mesh). */
  weaponIndex: number;
}

export default function CharacterPreview({
  skinIndex,
  weaponIndex,
}: CharacterPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mutable bridge between the React props and the imperative Three.js world.
  const characterRef = useRef<MD2Character | null>(null);
  const loadedRef = useRef(false);
  const pendingRef = useRef<{ skin: number; weapon: number }>({
    skin: skinIndex,
    weapon: weaponIndex,
  });
  const spinVelRef = useRef(0);

  /** Apply a loadout to the preview model if it is ready, else park it. */
  const applyLoadout = (skin: number, weapon: number) => {
    const character = characterRef.current;
    if (!character || !loadedRef.current) {
      pendingRef.current = { skin, weapon };
      return;
    }
    character.setSkin(((skin % MODEL_SKINS.length) + MODEL_SKINS.length) % MODEL_SKINS.length);
    character.setWeapon(weapon < MESH_WEAPON_COUNT ? weapon : -1);
  };

  useEffect(() => {
    applyLoadout(skinIndex, weaponIndex);
  }, [skinIndex, weaponIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 50);
    camera.position.set(0, CAMERA_POS_Y, CAMERA_DIST);
    camera.lookAt(0, PREVIEW_HEIGHT / 2, 0);

    // RATFIRE light language: cool key from the front-left, warm amber rim
    // kicking the silhouette from behind-right, soft ambient fill.
    const keyLight = new THREE.DirectionalLight(0xcfe8ff, 2.4);
    keyLight.position.set(-2.2, 3.2, 2.6);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xfbbf24, 1.7);
    rimLight.position.set(2.4, 2.4, -2.8);
    scene.add(rimLight);
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    // Turntable: podium disc + amber ring + the character all spin together.
    const turntable = new THREE.Group();
    scene.add(turntable);

    const podium = new THREE.Mesh(
      new THREE.CircleGeometry(PODIUM_DISC_R, 48),
      new THREE.MeshBasicMaterial({ color: 0x0c0c10 })
    );
    podium.rotation.x = -Math.PI / 2;
    turntable.add(podium);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(PODIUM_RING_INNER, PODIUM_RING_OUTER, 48),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    turntable.add(ring);

    const character = new MD2Character();
    characterRef.current = character;

    /** Bake the raw MD2 figure's XZ centroid onto the rotation axis. The
     *  original Quake model is laterally offset from its own origin
     *  (bbox centre cx≈+1.5, cz≈-5.3), which would make it ORBIT the podium
     *  centre while the turntable spins. The shift is baked into the base
     *  position attribute AND every morph-target frame (MD2 frames are
     *  absolute positions) of the body and all weapon meshes — with the
     *  same delta, so the weapon stays in the hand. Y is untouched. */
    const bakeXZCentroid = (geo: THREE.BufferGeometry, cx: number, cz: number) => {
      const frames: Array<THREE.BufferAttribute | THREE.InterleavedBufferAttribute> = [
        geo.attributes.position as THREE.BufferAttribute,
        ...((geo.morphAttributes.position ?? []) as unknown as Array<THREE.BufferAttribute>),
      ];
      for (const attr of frames) {
        if (!attr || !(attr.array instanceof Float32Array)) continue;
        const arr = attr.array as Float32Array;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i] -= cx;
          arr[i + 2] -= cz;
        }
        attr.needsUpdate = true;
      }
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
    };

    character.onLoadComplete = () => {
      const body = character.meshBody;
      if (!body) return;

      const positionAttr = body.geometry.attributes
        .position as THREE.BufferAttribute;
      const bbox = new THREE.Box3().setFromBufferAttribute(positionAttr);
      const cx = (bbox.max.x + bbox.min.x) / 2;
      const cz = (bbox.max.z + bbox.min.z) / 2;

      bakeXZCentroid(body.geometry, cx, cz);
      for (const weapon of character.weapons) {
        if (weapon) bakeXZCentroid(weapon.geometry, cx, cz);
      }

      // Normalize the raw Quake-scale model to the showcase height.
      const rawHeight = bbox.max.y - bbox.min.y;
      const s = PREVIEW_HEIGHT / rawHeight;
      body.scale.setScalar(s);
      for (const weapon of character.weapons) weapon.scale.setScalar(s);
      character.scale = s;
      character.root.position.y = -s * bbox.min.y;

      character.setAnimation('stand');
      loadedRef.current = true;
      applyLoadout(pendingRef.current.skin, pendingRef.current.weapon);
    };

    character.loadParts({
      baseUrl: MODEL_BASE_URL,
      body: MODEL_BODY,
      skins: MODEL_SKINS,
      weapons: MODEL_WEAPONS,
    });
    turntable.add(character.root);

    // ===== responsive sizing: canvas CSS size == container at any dpr =====
    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h); // updateStyle ENABLED — the Task 9 fix
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    // ===== pointer drag to spin + gentle auto turntable =====
    let dragging = false;
    let lastX = 0;
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      container.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      lastX = event.clientX;
      turntable.rotation.y += dx * DRAG_SENSITIVITY;
      spinVelRef.current = dx * DRAG_SENSITIVITY * 60;
    };
    const endDrag = () => {
      dragging = false;
    };
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', endDrag);
    container.addEventListener('pointerleave', endDrag);

    // ===== render loop =====
    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.1);
      if (!dragging) {
        // drag flick decays into the idle auto-spin
        spinVelRef.current *= Math.pow(0.02, dt);
        const extra =
          Math.abs(spinVelRef.current) > 0.02 ? spinVelRef.current * dt : 0;
        turntable.rotation.y += AUTO_SPIN_SPEED * dt + extra;
      }
      character.mixer?.update(dt);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', endDrag);
      container.removeEventListener('pointerleave', endDrag);

      // Full teardown so open/close never leaks WebGL contexts.
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
      character.skinsBody?.forEach((t) => t?.dispose());
      character.skinsWeapon?.forEach((t) => t?.dispose());
      character.mixer?.stopAllAction();
      characterRef.current = null;
      loadedRef.current = false;
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      aria-hidden="true"
    />
  );
}
