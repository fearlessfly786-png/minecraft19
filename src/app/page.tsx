'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  Activity,
  Anchor,
  Ban,
  Bot,
  Check,
  Clover,
  Coins,
  Cpu,
  Crown,
  Dices,
  Eye,
  EyeOff,
  Flame,
  Gem,
  Globe,
  Hand,
  HeartPulse,
  Images,
  LoaderCircle,
  Lock,
  Maximize,
  Mic,
  MicOff,
  Minimize,
  Package,
  PawPrint,
  Play,
  Plus,
  Radar,
  Rocket,
  Send,
  Shield,
  ShieldOff,
  Store,
  Sun,
  Sword,
  Target,
  UserRound,
  Volume2,
  VolumeX,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import * as THREE from 'three';
import { MD2Character } from 'three/examples/jsm/misc/MD2Character.js';
import {
  createTerrainChunks,
  type TerrainChunksHandle,
} from '@/game/terrainChunks';
import { createBirdFlock, type BirdFlock } from '@/game/gpgpuSkyBirds';
import { createSkyClouds, type SkyCloudsHandle } from '@/game/skyClouds';
import { createRain, type RainHandle } from '@/game/rainSystem';
import { createIceRain, type IceRainHandle } from '@/game/iceRainSystem';
import { createSnowRain, type SnowRainHandle } from '@/game/snowRainSystem';
import {
  createFootprintSystem,
  type FootprintHandle,
} from '@/game/footprintSystem';
import {
  WINTER_ZONES,
  winterFactorWorld,
  iceFactorWorld,
} from '@/game/winterBiomes';
import {
  DESERT_ZONES,
  desertFactorWorld,
} from '@/game/desertBiomes';
import {
  redFactorWorld,
  mesaFactorWorld,
  volcanoFactorWorld,
} from '@/game/extraBiomes';
import {
  nearestVolcanoWorld,
  handVolcanoInfo,
} from '@/game/volcanoTerrain';
import {
  createVolcanoPlume,
  type VolcanoPlumeHandle,
} from '@/game/volcanoPlume';
import { createSkyText, type SkyTextHandle } from '@/game/skyText';
import { createEmbers, type EmbersHandle } from '@/game/embers';
import { createBulletSystem } from '@/game/bulletSystem';
import { createJeepProp } from '@/game/jeepProp';
import { createPetDrone, type PetDroneOrdnance, type PetRocketTracker } from '@/game/petDrone';
import { createDroneAi, type DroneAiTargetView } from '@/game/droneAi';
import {
  createVoiceControl,
  type VoiceCommand,
} from '@/game/voiceControl';
import {
  createGroundWater,
  type GroundWaterHandle,
} from '@/game/groundWater';
import {
  createLootChests,
  type LootChestsHandle,
} from '@/game/lootChests';
import {
  createAtmosphereVfx,
  type AtmosphereVfxHandle,
} from '@/game/atmosphereVfx';
import HealthBar, { type HealthBarHandle } from '@/components/game/HealthBar';
import Minimap, {
  type MinimapBridge,
  type MinimapHandle,
} from '@/components/game/Minimap';
import TouchControls, {
  type TouchGameApi,
} from '@/components/game/TouchControls';
import CharacterPreview from '@/components/game/CharacterPreview';
import { getGameAudio, type GameAudioHandle } from '@/game/audio';

/** Mesh augmented by MD2Character at runtime with the active animation action. */
interface ActionMesh extends THREE.Mesh {
  activeAction?: THREE.AnimationAction;
}

/** GitHub brand mark (octicon "mark-github" path) for the export button. */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/** Rotating status lines shown while the GitHub export request is in flight. */
const GH_STEPS = [
  'Authenticating…',
  'Creating repository…',
  'Uploading source files…',
  'Creating commit…',
  'Working — large uploads can take a minute…',
];

/** Debug handle exposed on window for tooling/verification (renders nothing). */
interface PlayerDebugInfo {
  loaded: boolean;
  animation: string;
  moving: boolean;
  airborne: boolean;
  x: number;
  y: number;
  z: number;
  charMinY: number;
  charMaxY: number;
  timeOfDay: number;
  stamina: number;
  exhausted: boolean;
  sprint: boolean;
  touchMove: boolean;
  phase: GamePhase;
}

/** Loadout mirror pushed to React so the LOBBY pickers can highlight the
 *  currently equipped skin/weapon. The in-game view itself is UI-free. */
interface LoadoutState {
  skinIndex: number;
  weaponIndex: number;
}

/** Direct pet-drone orders the PET panel issues (same brain as voice). */
type DroneOrderKind = 'COME' | 'PATROL' | 'GUARD' | 'HOLD' | 'CEASEFIRE';

/** Commands the React dashboard can send into the game loop. */
interface GameApi {
  setSkin(index: number): void;
  setWeapon(index: number): void;
  applyDamage(amount: number): void;
  respawn(): void;
  droneDirective(kind: DroneOrderKind): void;
}

/** Voxel blocks are 100 world units — the world itself is ENDLESS: terrain
 *  streams in as chunks around the player and unloads behind them. */
const BLOCK = 100;
/** Grid origin offset. The legacy fixed map spanned grid 0..127, i.e. world
 *  x = (gridX - 64) * BLOCK; keeping the offset keeps the spawn area's
 *  terrain pixel-identical to the old map. */
const GRID_OFFSET = 64;

/** Character tuning (world units / seconds). */
const CHAR_HEIGHT = 190; // ~1.9 blocks tall
const WALK_SPEED = 360;
const RUN_SPEED = 620; // mobile RUN toggle sprint speed
const BACK_SPEED = 220;
const TURN_SPEED = 2.4; // rad/s
const JUMP_SPEED = 620;
const GRAVITY = 1800;
const RUN_SOUND_VOLUME = 0.35;
const SNOW_WALK_SFX = '/sounds/snow-walk-loop.mp3'; // user-provided snow crunch
const SNOW_WALK_VOLUME = 0.5; // loop volume at full snow coverage
const TIRE_SCREECH_SFX = '/sounds/tire-screech-loop.mp3'; // user-provided drift screech
const TIRE_SCREECH_VOLUME = 0.6; // loop volume while the jeep slides

/** Health tuning (stamina is unlimited — running never slows the player). */
const MAX_HEALTH = 100;
const MAX_STAMINA = 100;
const FALL_DAMAGE_MIN_SPEED = 800; // landing speed (units/s) where damage starts
const FALL_DAMAGE_SCALE = 0.06;
const HEALTH_REGEN_DELAY = 5; // seconds after damage before regen kicks in
const HEALTH_REGEN_RATE = 5; // per second
const RESPAWN_DELAY = 2.4; // seconds between death and respawn

/** Third-person camera tuning. */
const CAM_DIST = 320;
const JEEP_CAM_DIST = 430; // chase camera sits farther back while driving
const CAM_HEIGHT = 170; // default elevation, expressed as pitch via CAM_DEFAULT_PITCH
const CAM_MIN_DIST = 140;
const CAM_MAX_DIST = 900;
const CAM_DEFAULT_PITCH = Math.atan2(CAM_HEIGHT, CAM_DIST);
const CAM_MIN_PITCH = -0.85; // camera drops low, letting you look up at the sky
const CAM_MAX_PITCH = 1.25; // near top-down
const LOOK_HEIGHT = 100;
const CAM_MIN_CLEARANCE = 70;

/** Day/night cycle tuning. */
const CYCLE_SECONDS = 160; // real seconds for a full 24h cycle (~80s day / 80s night)
const DAY_START_HOUR = 9; // hour the game boots at (mid-morning)

/** The single daily rain shower, in in-game hours: clouds build 13.5->14.2,
 *  pour until 16.4, clear by 17.2 — exactly one storm per 24h cycle. */
const RAIN_WINDOW = { buildFrom: 13.5, fullAt: 14.2, clearFrom: 16.4, clearBy: 17.2 };

function rainIntensityFromHour(hour: number): number {
  const w = RAIN_WINDOW;
  if (hour < w.buildFrom || hour > w.clearBy) return 0;
  const rampUp = THREE.MathUtils.smoothstep(hour, w.buildFrom, w.fullAt);
  const rampDown = 1 - THREE.MathUtils.smoothstep(hour, w.clearFrom, w.clearBy);
  return rampUp * rampDown;
}

const SUNRISE_HOUR = 6; // hour 6 = sun on the east horizon
const SKY_DAY = new THREE.Color(0xbfd1e5);
const SKY_NIGHT = new THREE.Color(0x070b18);
const SKY_SUNSET = new THREE.Color(0xf2984f);
const STORM_SKY = new THREE.Color(0x59636e); // wet grey sky while rain pours
const WINTER_SKY = new THREE.Color(0xd7e7f2); // pale icy sky over snow biomes
const DESERT_SKY = new THREE.Color(0xa9c9e2); // hazy warm-BLUE desert vault —
const RED_SKY = new THREE.Color(0xcf9460); // dusty rust haze over the red dunes
const MESA_SKY = new THREE.Color(0xdbc4a0); // pale warm badlands vault
const VOLCANO_SKY = new THREE.Color(0x39281f); // dark smoky ash ceiling
const EMBER_GLOW_SKY = new THREE.Color(0x8a3414); // live-crater ember cast
// deserts keep a clear blue sky (per the reference screenshot); only a
// faint dusty cast separates them from the temperate grasslands
const SUNLIGHT_HIGH = new THREE.Color(0xfff3e2);
const SUNLIGHT_LOW = new THREE.Color(0xff9a55);
const MOONLIGHT = new THREE.Color(0xa7b8e0);
const AMBIENT_DAY = new THREE.Color(0xeeeeee);
const AMBIENT_NIGHT = new THREE.Color(0x46527a);
const AMBIENT_DAY_I = 3;
const AMBIENT_NIGHT_I = 1.1;
const SUN_LIGHT_MAX = 12;
const MOON_LIGHT_MAX = 2.4;
const SUN_TINT_NOON = new THREE.Color(0xffffff);
const SUN_TINT_SET = new THREE.Color(0xff8038);
const STAR_COUNT = 1300;
const STAR_BRIGHT_COUNT = 90;
const STAR_RADIUS = 8800; // inside camera.far, beyond the world edge

/** Aerial fog: FogExp2 base density; thickens a little at dawn/dusk. */
const FOG_DENSITY = 0.00011;

/** One-shot animation bindings: key code -> clip name. */
const ACTION_KEYS: Record<string, string> = {
  KeyF: 'attack',
  Digit1: 'wave',
  Digit2: 'taunt',
  Digit3: 'salute',
  Digit4: 'point',
  Digit5: 'flip',
  Numpad5: 'flip',
};

/** Body skins (order matches loadParts config) with swatch colors for the UI. */
const SKINS: Array<{ name: string; color: string }> = [
  { name: 'Ratamahatta', color: '#b45309' },
  { name: 'Blue CTF', color: '#60a5fa' },
  { name: 'Red CTF', color: '#f87171' },
  { name: 'Dead', color: '#a1a1aa' },
  { name: 'Gearwhore', color: '#a3b18a' },
  { name: 'Goldlord', color: '#d4a017' },
  { name: 'Toxin', color: '#84cc16' },
  { name: 'Shadow', color: '#3f3f46' },
  { name: 'Frostbite', color: '#7dd3fc' },
  { name: 'Magma', color: '#ea580c' },
];

/** Weapon loadouts backed by real MD2 weapon meshes; null model = unarmed.
 *  The last entry must stay unarmed (applyWeapon maps it to "hide all"). */
const WEAPONS: Array<{
  name: string;
  model: string | null;
  icon: LucideIcon;
}> = [
  { name: 'Blade', model: 'weapon.md2', icon: Sword },
  { name: 'Shotgun', model: 'w_shotgun.md2', icon: Target },
  { name: 'Chaingun', model: 'w_chaingun.md2', icon: Zap },
  { name: 'Railgun', model: 'w_railgun.md2', icon: Rocket },
  { name: 'Unarmed', model: null, icon: Ban },
];

/** Drawing a gun (Shotgun/Chaingun/Railgun) plays the reload cue; the Blade
 *  and Unarmed entries stay silent on switch. */
const isGunWeapon = (index: number) =>
  index >= 1 && index < WEAPONS.length - 1;

/** Player identity shown on the lobby dashboard. */
const PLAYER_NAME = 'RATLORD_99';
const PLAYER_COINS = 160;
const PLAYER_GEMS = 0;

type GamePhase = 'lobby' | 'playing';

/** Lobby showcase camera + turntable tuning. */
const LOBBY_DIST = 430;
const LOBBY_PITCH = 0.1;
const LOBBY_TURN_SPEED = 0.45; // rad/s auto-rotation
const LOBBY_BLEND_TIME = 1.3; // s, camera sweep from lobby into gameplay

/** Lobby side menu — every entry opens its fullscreen command panel. */
const LOBBY_MENU: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: 'store', label: 'Store', icon: Store },
  { id: 'luck', label: 'Luck Royale', icon: Clover },
  { id: 'character', label: 'Character', icon: UserRound },
  { id: 'vault', label: 'Vault', icon: Package },
  { id: 'pet', label: 'Pet', icon: PawPrint },
  { id: 'collection', label: 'Collection', icon: Images },
  { id: 'weapons', label: 'Weapons', icon: Sword },
];

/** Fullscreen lobby panels — every side-menu entry owns one. */
type LobbyPanelId =
  | 'store'
  | 'luck'
  | 'character'
  | 'vault'
  | 'pet'
  | 'collection'
  | 'weapons';

const LOADOUT_DEFAULT: LoadoutState = { skinIndex: 0, weaponIndex: 0 };

/** Shared chrome for the seven fullscreen panels. */
const PANEL_META: Record<
  LobbyPanelId,
  { title: string; tagline: string; icon: LucideIcon }
> = {
  store: { title: 'Store', tagline: 'Spend coins · power up', icon: Store },
  luck: {
    title: 'Luck Royale',
    tagline: 'Spin for coins, gems & skins',
    icon: Clover,
  },
  character: {
    title: 'Character',
    tagline: 'Dressing room · live preview',
    icon: UserRound,
  },
  vault: { title: 'Vault', tagline: 'Balances · owned gear', icon: Package },
  pet: {
    title: 'Pet',
    tagline: 'BUZZ combat drone control',
    icon: PawPrint,
  },
  collection: {
    title: 'Collection',
    tagline: 'World atlas · systems online',
    icon: Images,
  },
  weapons: {
    title: 'Weapons',
    tagline: 'Live loadout rack',
    icon: Sword,
  },
};

/** Which economy source unlocks each exclusive skin (indices >= 5). */
const SKIN_SOURCES: Record<
  number,
  { id: string; source: 'store' | 'luck' }
> = {
  5: { id: 'goldlord', source: 'store' },
  6: { id: 'toxin', source: 'luck' },
  7: { id: 'shadow', source: 'luck' },
  8: { id: 'frostbite', source: 'luck' },
  9: { id: 'magma', source: 'store' },
};

/** Store catalogue: coin-priced items. Skins auto-equip on purchase; gear
 *  entries are consumables (Gem Pouch is repeatable by design). */
const STORE_ITEMS: Array<{
  id: string;
  name: string;
  blurb: string;
  price: number;
  icon: LucideIcon;
  accent: string;
  kind: 'skin' | 'gear';
  skinIndex?: number;
}> = [
  {
    id: 'goldlord',
    name: 'Goldlord Skin',
    blurb: 'Solid-gold bragging rights',
    price: 120,
    icon: Crown,
    accent: 'text-amber-300',
    kind: 'skin',
    skinIndex: 5,
  },
  {
    id: 'magma',
    name: 'Magma Skin',
    blurb: 'Lava-forged surface plating',
    price: 90,
    icon: Flame,
    accent: 'text-orange-400',
    kind: 'skin',
    skinIndex: 9,
  },
  {
    id: 'gems',
    name: 'Gem Pouch',
    blurb: '+10 gems banked instantly',
    price: 60,
    icon: Gem,
    accent: 'text-emerald-300',
    kind: 'gear',
  },
  {
    id: 'patch',
    name: 'Hull Patch',
    blurb: 'Restores BUZZ to mint condition',
    price: 40,
    icon: Wrench,
    accent: 'text-sky-300',
    kind: 'gear',
  },
  {
    id: 'medkit',
    name: 'Field Medkit',
    blurb: 'Patches you up on pickup',
    price: 30,
    icon: HeartPulse,
    accent: 'text-rose-300',
    kind: 'gear',
  },
];

/** Luck Royale wheel: 8 wedges, weighted random payouts (skins included). */
const LUCK_SEGMENTS: Array<{
  id: string;
  label: string;
  color: string;
  fg: 'dark' | 'light';
  weight: number;
  payout: {
    coins?: number;
    gems?: number;
    skinId?: string;
    skinIndex?: number;
    jackpot?: boolean;
  };
}> = [
  { id: 'c30', label: '30 Coins', color: '#ca8a04', fg: 'dark', weight: 24, payout: { coins: 30 } },
  { id: 'g5', label: '5 Gems', color: '#0f766e', fg: 'light', weight: 20, payout: { gems: 5 } },
  { id: 'c80', label: '80 Coins', color: '#ea580c', fg: 'dark', weight: 16, payout: { coins: 80 } },
  { id: 'toxin', label: 'Toxin', color: '#65a30d', fg: 'dark', weight: 10, payout: { skinId: 'toxin', skinIndex: 6 } },
  { id: 'g10', label: '10 Gems', color: '#059669', fg: 'light', weight: 12, payout: { gems: 10 } },
  { id: 'c120', label: '120 Coins', color: '#b45309', fg: 'dark', weight: 8, payout: { coins: 120 } },
  { id: 'shadow', label: 'Shadow', color: '#27272a', fg: 'light', weight: 6, payout: { skinId: 'shadow', skinIndex: 7 } },
  { id: 'jackpot', label: 'Jackpot', color: '#f59e0b', fg: 'dark', weight: 4, payout: { coins: 250, skinId: 'frostbite', skinIndex: 8, jackpot: true } },
];

const LUCK_COST = { coins: 50, gems: 10 } as const;

/** Role tag per WEAPONS entry (same order). */
const WEAPON_ROLES = [
  'Melee',
  'Close range',
  'Sustained',
  'Marksman',
  'Bare hands',
];

/** Direct orders the PET panel can issue to BUZZ's combat brain. */
const PET_ORDERS: Array<{
  kind: DroneOrderKind;
  label: string;
  call: string;
  icon: LucideIcon;
}> = [
  { kind: 'COME', label: 'Come', call: 'On my way', icon: Hand },
  { kind: 'PATROL', label: 'Patrol', call: 'Patrolling', icon: Radar },
  { kind: 'GUARD', label: 'Guard', call: 'Guarding you', icon: Shield },
  { kind: 'HOLD', label: 'Hold', call: 'Holding position', icon: Anchor },
  { kind: 'CEASEFIRE', label: 'Ceasefire', call: 'Guns cold', icon: ShieldOff },
];

/** Collection atlas: every biome the endless world streams through. */
const WORLD_BIOMES: Array<{
  name: string;
  tag: string;
  gradient: string;
}> = [
  { name: 'Grasslands', tag: 'Spawn · rolling hills', gradient: 'from-lime-500 to-emerald-700' },
  { name: 'Winter Reach', tag: 'Snow · frozen lakes', gradient: 'from-sky-200 to-sky-500' },
  { name: 'Dune Sea', tag: 'Desert · heat haze', gradient: 'from-amber-300 to-orange-600' },
  { name: 'Red Dunes', tag: 'Rust canyon trails', gradient: 'from-orange-700 to-red-900' },
  { name: 'Mesa Flats', tag: 'Badlands plateaus', gradient: 'from-yellow-600 to-amber-800' },
  { name: 'Volcano Core', tag: 'Ash · live crater', gradient: 'from-zinc-700 to-orange-950' },
];

/** Collection systems-online cards. */
const SYSTEM_CARDS: Array<{ name: string; note: string; icon: LucideIcon }> = [
  { name: 'Terrain Engine', note: 'Endless streaming chunks', icon: Cpu },
  { name: 'Drone AI', note: 'BUZZ combat brain', icon: Radar },
  { name: 'Voice Link', note: 'ASR + LLM radio', icon: Mic },
  { name: 'Day / Night', note: '24h cycle + storms', icon: Sun },
];

// ==================== mobile MAXIMIZE (fullscreen) helpers ====================
// On phones the game must own the WHOLE screen: the browser top bar, tab
// strip and address bar are dropped via the Fullscreen API (requested from
// the first tap and from the START tap — both are valid user gestures).
// iOS Safari has no element fullscreen in-browser, so there the same
// result comes from the standalone meta tags + the web app manifest
// (Add to Home Screen -> launches with zero browser chrome).

interface FsDebug {
  attempts: number;
  entered: boolean;
  lastError: string | null;
}

/** Debug/verification surface on window.__fsDebug. */
function fsDbg(): FsDebug {
  const w = window as unknown as { __fsDebug?: FsDebug };
  if (!w.__fsDebug) w.__fsDebug = { attempts: 0, entered: false, lastError: null };
  return w.__fsDebug;
}

/** True while a fullscreen request is in flight — a document can only have
 *  ONE pending request; a second concurrent one gets rejected with
 *  "Permissions check failed", so concurrent callers (first-tap listener +
 *  START handler fire on the same tap) must be deduped. */
let fsPending = false;

/** True when the game already runs without browser chrome (installed /
 *  Add-to-Home-Screen mode) — no fullscreen request needed there. */
function runningStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    nav.standalone === true
  );
}

// ==================== quality tier (mobile performance) ====================
// Phones were HANGING: full devicePixelRatio (3x) fill rate + MSAA + a
// 2048² shadow pass over the whole voxel terrain + 120,000 rain streaks
// + heavy FBM clouds at 60fps is far beyond a mobile GPU. LOW_SPEC cuts
// that workload roughly in half across the board on touch-first devices
// (?hi=1 opts back into the full-fat desktop look).

/** Same detection philosophy as the touch HUD: mobile user agent, or a
 *  coarse (touch-first) pointer with touch support. `?hi=1` overrides. */
function detectLowSpecDevice(): boolean {
  if (new URLSearchParams(window.location.search).get('hi') === '1') {
    return false;
  }
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
  const mobileUa =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
      navigator.userAgent
    );
  return mobileUa || (coarse && hasTouch);
}

/** Mobile render-scale cap — above ~1.5 the extra pixels are invisible at
 *  arm's length but cost a phone GPU multiples of its frame budget. */
const LOW_DPR_CAP = 1.5;
/** Desktop still gets the crisp look, just not unbounded DPR. */
const HIGH_DPR_CAP = 2;
/** Mobile frame cap (~30fps): every skipped beat is CPU AND GPU time the
 *  phone gets back; the timer bridges the gap so game time stays exact. */
const LOW_FRAME_INTERVAL_MS = 1000 / 30 - 2;

/**
 * The three.js minecraft terrain demo (webgl_geometry_minecraft) combined with
 * the ratamahatta MD2 character (webgl_loader_md2), driven by keyboard + touch
 * controls:
 *
 *   W / S or Up / Down ... walk forward / backward  -> run animation
 *   A / D or Left / Right ............ turn         -> idle animation when still
 *   Space ............................ jump
 *   F ................................ attack (shot + reload per swing); a
 *                                      textured FMJ bullet leaves the gun
 *                                      nozzle with muzzle fire, sparks and
 *                                      smoke (guns only — not Blade/Unarmed)
 *   1 / 2 / 3 / 4 / 5 ................ wave / taunt / salute / point / flip
 *                                      (5's roar is trimmed to end with it)
 *   Q / E ............................ previous / next skin
 *   X ................................ cycle weapon loadout
 *   Esc .............................. back to the lobby
 *
 *   Mouse drag ....................... orbit the camera around the character
 *   Mouse wheel ...................... zoom in / out
 *
 *   Touch (mobile ONLY) .............. virtual joystick walks + turns, icon
 *                                      buttons FIRE (hold) / JUMP / ROAR /
 *                                      RUN toggle / WEAPON / SKIN / LOBBY;
 *                                      drag orbits the camera, pinch zooms.
 *                                      The whole touch HUD is hidden on
 *                                      desktop (?touch=1 force-overrides).
 *
 *   Mobile MAXIMIZE .................. the first tap on a phone (and the
 *                                      START tap) requests fullscreen so
 *                                      the browser top bar + tabs vanish
 *                                      and the game fills the whole
 *                                      screen; the expand button top-right
 *                                      toggles it anytime, and Add to
 *                                      Home Screen launches it with zero
 *                                      browser chrome (manifest +
 *                                      standalone meta tags).
 *
 *   Running NEVER drains stamina or slows down (unlimited sprint), falls
 *   hurt, health regens after a grace period, and death respawns you at
 *   the map origin — all simulated invisibly: the in-game view is pure 3D
 *   with zero HUD, panels or overlays of any kind.
 *
 *   LOOT CHESTS: rare wooden/gold crates are scattered across the endless
 *   terrain (deterministic per region — see src/game/lootChests.ts) and
 *   pop open automatically when you walk into them, bursting coins (rare
 *   chests also drop gems) that are banked into the HUD balance — lobby
 *   header AND the in-game pill — while the chest sinks into the ground.
 *   Opened chests stay looted for the whole session.
 *
 *   MINIMAP: a north-up top-down map of the streamed world (top-left,
 *   CIRCULAR dial, see src/components/game/Minimap.tsx) scrolls smoothly
 *   with the player, painting the same height field the terrain meshes
 *   use, with gold dots marking live, unopened chests and an amber arrow
 *   for your heading; the dragon health bar hangs directly beneath it.
 *
 *   ATMOSPHERE VFX: the drama layer on top of the storm + night + dawn
 *   systems (see src/game/atmosphereVfx.ts) — forked LIGHTNING bolts
 *   strike around you during heavy rain (camera-facing quad chains, a
 *   point-light pop, a whole-screen white flash and a distance-delayed
 *   synthesized thunder rumble) while SHEET LIGHTNING flickers INSIDE
 *   the cloud deck between strikes — every flash blooms the storm cell
 *   through the cloud shapes from within (skyClouds.applyFlash) — and
 *   SHOOTING STARS streak across the night sky (rare ones leave a
 *   sparkling tail), low MORNING MIST banks settle into valley floors at
 *   dawn and burn off as the sun climbs, soft GOD RAYS fan out of the
 *   sun disc at dawn/dusk, and running/landing kicks up FOOTSTEP DUST
 *   scaled to the impact of the landing.
 *
 *   A real-time day/night cycle plays in the background (a full 24h cycle
 *   every CYCLE_SECONDS real seconds): the sun arcs overhead and sets in
 *   orange, then a cratered moon rises among a field of stars while cool
 *   moonlight takes over the shadows until dawn breaks again.
 *
 * Flow: the page boots into a Free-Fire-style LOBBY dashboard (character
 * showcase + menu chrome). Dragging spins the character, the CHARACTER /
 * WEAPONS menu entries open live loadout pickers, and START sweeps the
 * camera around the character into third-person gameplay. Esc returns to
 * the lobby. Enter also works as START.
 */
export default function MinecraftGamePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<GameApi | null>(null);
  /** Imperative per-frame push into the dragon health bar HUD. */
  const healthBarRef = useRef<HealthBarHandle | null>(null);
  // driving HUD (jeep): written directly from the game loop every frame so
  // the speed readout never triggers a React re-render
  const driveHudRef = useRef<HTMLDivElement | null>(null);
  const driveSpeedRef = useRef<HTMLSpanElement | null>(null);
  const driveHudModeRef = useRef<HTMLSpanElement | null>(null);
  /** BUZZ combat chip: AI state + hull — written from the game loop
   *  straight into the DOM (zero React re-renders, like the health bar). */
  const droneHudRef = useRef<HTMLSpanElement | null>(null);
  /** BUZZ voice-link chip lines: link state, last heard text, BUZZ's
   *  reply — written straight from callbacks/loop (zero re-renders). */
  const voiceHudStateRef = useRef<HTMLSpanElement | null>(null);
  const voiceHudHeardRef = useRef<HTMLSpanElement | null>(null);
  const voiceHudReplyRef = useRef<HTMLSpanElement | null>(null);
  /** Live mic-level bar inside the voice chip (transform-only writes). */
  const voiceMeterRef = useRef<HTMLDivElement | null>(null);
  /** Mic toggle handle the button + V key press through (the control
   *  itself lives inside the game effect where the drone objects are). */
  const voiceToggleRef = useRef<(() => void) | null>(null);
  /** Typed-chat handle + input — the always-open channel to BUZZ: typed
   *  text rides the SAME LLM brain as the mic, so the player can reach him
   *  even while the speech (ASR) channel is rate-limited. */
  const voiceInjectRef = useRef<((text: string) => void) | null>(null);
  const voiceTextRef = useRef<HTMLInputElement | null>(null);
  /** Mirrors the link state for the mic button icon (changes rarely). */
  const [voiceOn, setVoiceOn] = useState(false);
  const hudBridgeRef = useRef<{
    publish?: (state: LoadoutState) => void;
    enterLobby?: () => void;
    lootToast?: (message: string) => void;
  }>({});
  /** Live balance mirrors: loot chests bank coins/gems into these. */
  const [coins, setCoins] = useState(PLAYER_COINS);
  const [gems, setGems] = useState(PLAYER_GEMS);
  /** Imperative per-frame push into the exploration minimap HUD. */
  const minimapRef = useRef<MinimapHandle | null>(null);
  /** Game-side data providers for the minimap (terrain + chest markers). */
  const mapBridgeRef = useRef<MinimapBridge>({});
  const [loadout, setLoadout] = useState<LoadoutState>(LOADOUT_DEFAULT);
  const [phase, setPhase] = useState<GamePhase>('lobby');
  /** Mirrors phase into the render loop (the loop reads refs, not state). */
  const phaseRef = useRef<GamePhase>('lobby');
  /** Imperative bridge the mobile touch HUD drives the game loop through. */
  const touchApiRef = useRef<TouchGameApi | null>(null);
  /** Touch controls render ONLY on touch devices (or ?touch=1 override). */
  const [isTouch, setIsTouch] = useState(false);
  const [lobbyPanel, setLobbyPanel] = useState<LobbyPanelId | null>(null);
  /** Economy: items bought in the Store / won in Luck Royale. */
  const [owned, setOwned] = useState<Record<string, boolean>>({});
  /** Luck Royale wheel state (rotation persists between spins). */
  const [luckSpinning, setLuckSpinning] = useState(false);
  const [luckRotation, setLuckRotation] = useState(0);
  const [luckResult, setLuckResult] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // ============ game audio (Web Audio singleton, see src/game/audio.ts) ============
  const soundRef = useRef<GameAudioHandle | null>(null);
  const [muted, setMuted] = useState(false);

  // GitHub export panel ("push the whole game source to a GitHub repo")
  const [ghOpen, setGhOpen] = useState(false);
  const [ghToken, setGhToken] = useState('');
  const [ghRepo, setGhRepo] = useState('');
  const [ghShowToken, setGhShowToken] = useState(false);
  const [ghStatus, setGhStatus] = useState<
    'idle' | 'working' | 'success' | 'error'
  >('idle');
  const [ghStep, setGhStep] = useState('');
  const [ghError, setGhError] = useState('');
  const [ghUrl, setGhUrl] = useState('');
  const [ghFiles, setGhFiles] = useState(0);

  /** True while the game fills the whole screen (browser bars hidden). */
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** Mirrors isTouch into callbacks that must never re-bind per render. */
  const isTouchRef = useRef(false);
  /** Guards the one-shot automatic fullscreen attempt on first touch. */
  const immersiveTriedRef = useRef(false);

  /** Request fullscreen on the document (mobile browsers hide their whole
   *  top bar + tab UI). Must be called from a user gesture; silently gives
   *  up where unsupported (iOS Safari in-browser) — standalone meta tags
   *  cover that case instead. */
  const enterImmersive = useCallback(() => {
    if (fsPending || document.fullscreenElement || runningStandalone()) return;
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const dbg = fsDbg();
    dbg.attempts += 1;
    try {
      const request =
        root.requestFullscreen?.bind(root) ??
        root.webkitRequestFullscreen?.bind(root);
      if (!request) {
        dbg.lastError = 'unsupported';
        return;
      }
      fsPending = true;
      void Promise.resolve(request({ navigationUI: 'hide' }))
        .then(() => {
          dbg.entered = true;
          dbg.lastError = null;
        })
        .catch((err: unknown) => {
          dbg.lastError = err instanceof Error ? err.message : String(err);
        })
        .finally(() => {
          fsPending = false;
        });
    } catch (err) {
      fsPending = false;
      dbg.lastError = err instanceof Error ? err.message : String(err);
    }
  }, []);

  const exitImmersive = useCallback(() => {
    const doc = document as Document & { webkitExitFullscreen?: () => void };
    if (doc.fullscreenElement) void doc.exitFullscreen().catch(() => {});
    else doc.webkitExitFullscreen?.();
  }, []);

  /** The visible top-right button — toggles fullscreen on any device. */
  const toggleImmersive = useCallback(() => {
    if (document.fullscreenElement) exitImmersive();
    else enterImmersive();
  }, [enterImmersive, exitImmersive]);

  /** One-shot automatic attempt: the FIRST tap on a phone (lobby included)
   *  maximizes the game even before START is pressed. */
  const attemptImmersiveOnce = useCallback(() => {
    if (immersiveTriedRef.current || document.fullscreenElement) return;
    immersiveTriedRef.current = true;
    enterImmersive();
  }, [enterImmersive]);

  /** START: leave the lobby and sweep the camera into third-person gameplay. */
  const enterGame = useCallback(() => {
    phaseRef.current = 'playing';
    setPhase('playing');
    setLobbyPanel(null);
    setGhOpen(false);
    // mobile MAXIMIZE: the START tap doubles as the fullscreen gesture —
    // drop the browser top bar/tabs so the game owns the whole screen
    if (isTouchRef.current) enterImmersive();
    // user gesture: wake the (otherwise suspended) AudioContext here
    void getGameAudio().then((sfx) => {
      soundRef.current = sfx;
      sfx.resume();
    });
  }, [enterImmersive]);

  /** Back to the lobby showcase (Esc key). */
  const enterLobby = useCallback(() => {
    phaseRef.current = 'lobby';
    setPhase('lobby');
  }, []);

  /** Mute/unmute every sound (speaker button + the M key). */
  const toggleMute = useCallback(() => {
    void getGameAudio().then((sfx) => {
      soundRef.current = sfx;
      sfx.resume(); // this click is also a valid gesture
      const next = !sfx.isMuted();
      sfx.setMuted(next);
      setMuted(next);
    });
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  /** A skin is usable when it is one of the base five or has been unlocked
   *  through the Store / Luck Royale. */
  const skinUnlocked = useCallback(
    (index: number) => {
      const source = SKIN_SOURCES[index];
      return !source || !!owned[source.id];
    },
    [owned]
  );

  /** Buy a Store item: deduct coins, grant the skin (auto-equip) or consumable. */
  const buyStoreItem = useCallback(
    (itemId: string) => {
      const item = STORE_ITEMS.find((entry) => entry.id === itemId);
      if (!item) return;
      if (item.kind === 'skin' && owned[item.id]) {
        showToast('Already owned');
        return;
      }
      if (coins < item.price) {
        showToast('Not enough coins');
        return;
      }
      setCoins((value) => value - item.price);
      if (item.kind === 'skin') {
        setOwned((value) => ({ ...value, [item.id]: true }));
        if (typeof item.skinIndex === 'number') {
          apiRef.current?.setSkin(item.skinIndex);
        }
        showToast(`${item.name} unlocked`);
      } else if (item.id === 'gems') {
        setGems((value) => value + 10);
        showToast('+10 gems banked');
      } else {
        showToast(`${item.name} purchased`);
      }
    },
    [coins, owned, showToast]
  );

  /** Luck Royale: pay the entry cost, pick a weighted random wedge, spin the
 *  wheel so the pointer lands exactly on it, then bank the payout. */
  const spinLuck = useCallback(
    (mode: 'coins' | 'gems') => {
      if (luckSpinning) return;
      if (mode === 'coins' ? coins < LUCK_COST.coins : gems < LUCK_COST.gems) {
        showToast(mode === 'coins' ? 'Not enough coins' : 'Not enough gems');
        return;
      }
      if (mode === 'coins') setCoins((value) => value - LUCK_COST.coins);
      else setGems((value) => value - LUCK_COST.gems);

      const totalWeight = LUCK_SEGMENTS.reduce(
        (sum, segment) => sum + segment.weight,
        0
      );
      let roll = Math.random() * totalWeight;
      let picked = LUCK_SEGMENTS[LUCK_SEGMENTS.length - 1];
      for (const segment of LUCK_SEGMENTS) {
        roll -= segment.weight;
        if (roll <= 0) {
          picked = segment;
          break;
        }
      }

      const segAngle = 360 / LUCK_SEGMENTS.length;
      const mid =
        LUCK_SEGMENTS.indexOf(picked) * segAngle + segAngle / 2;
      setLuckResult('');
      setLuckSpinning(true);
      setLuckRotation((current) => {
        const currentMod = ((current % 360) + 360) % 360;
        const target = (360 - mid) % 360;
        const delta = ((target - currentMod + 360) % 360) + 360 * 5;
        return current + delta;
      });

      const payout = picked.payout;
      const winCoins = payout.coins ?? 0;
      const winGems = payout.gems ?? 0;
      const winSkinId = payout.skinId;
      const winSkinIndex = payout.skinIndex ?? 0;
      const jackpot = !!payout.jackpot;
      window.setTimeout(() => {
        if (winCoins) setCoins((value) => value + winCoins);
        if (winGems) setGems((value) => value + winGems);
        if (winSkinId) setOwned((value) => ({ ...value, [winSkinId]: true }));
        setLuckResult(
          jackpot
            ? `JACKPOT — ${winCoins} coins + ${SKINS[winSkinIndex].name} skin!`
            : winSkinId
              ? `${SKINS[winSkinIndex].name} skin unlocked!`
              : winCoins
                ? `+${winCoins} coins`
                : `+${winGems} gems`
        );
        setLuckSpinning(false);
      }, 4300);
    },
    [coins, gems, luckSpinning, showToast]
  );

  // Create the Web Audio graph up front (context stays suspended until the
  // first user gesture — the START click resumes it) and mirror the persisted
  // mute preference onto the speaker button. Also surfaced as window.__sfx.
  useEffect(() => {
    let cancelled = false;
    void getGameAudio().then((sfx) => {
      if (cancelled) return;
      soundRef.current = sfx;
      setMuted(sfx.isMuted());
      (window as unknown as { __sfx?: GameAudioHandle }).__sfx = sfx;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ============ touch device detection (mobile controls visibility) ============
  // The virtual joystick + icon buttons exist only where a touchscreen is
  // the primary pointer: mobile user agents, or a coarse (touch-first)
  // pointer that also reports touch support. `?touch=1` force-overrides so
  // desktop tooling can verify the HUD.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('touch') === '1') {
      setIsTouch(true);
      return;
    }
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const hasTouch =
      'ontouchstart' in window ||
      (navigator.maxTouchPoints ?? 0) > 0 ||
      ((navigator as Navigator & { msMaxTouchPoints?: number })
        .msMaxTouchPoints ?? 0) > 0;
    const mobileUa =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
        navigator.userAgent
      );
    setIsTouch(mobileUa || (coarse && hasTouch));
  }, []);

  // Auto-MAXIMIZE on the first touch of a mobile session: ANY tap (lobby
  // buttons included) counts as the user gesture the Fullscreen API needs.
  // The isTouchRef mirrors the flag for gesture callbacks above.
  useEffect(() => {
    if (!isTouch) return;
    isTouchRef.current = true;
    const onFirstTap = () => attemptImmersiveOnce();
    window.addEventListener('pointerdown', onFirstTap, {
      once: true,
      capture: true,
    });
    return () => {
      window.removeEventListener('pointerdown', onFirstTap, {
        capture: true,
      } as EventListenerOptions);
    };
  }, [isTouch, attemptImmersiveOnce]);

  // Mirror the real fullscreen state onto the expand button + __fsDebug.
  useEffect(() => {
    const sync = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      fsDbg().entered = active;
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    sync();
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  /** Left menu: every entry opens its fullscreen command panel (toggle). */
  const handleMenuClick = useCallback((id: string) => {
    setLobbyPanel((current) => (current === id ? null : (id as LobbyPanelId)));
  }, []);

  /** Push the entire game source to the caller's GitHub account. */
  const saveToGithub = useCallback(async () => {
    const tokenValue = ghToken.trim();
    const repoValue = ghRepo.trim();
    if (!tokenValue || !repoValue || ghStatus === 'working') return;
    setGhStatus('working');
    setGhError('');
    setGhUrl('');
    setGhStep(GH_STEPS[0]);
    let stepIndex = 0;
    const stepTimer = window.setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, GH_STEPS.length - 1);
      setGhStep(GH_STEPS[stepIndex]);
    }, 4000);
    try {
      const res = await fetch('/api/github/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenValue, repo: repoValue }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        url?: string;
        files?: number;
      };
      if (!res.ok || !data.ok || !data.url) {
        throw new Error(data.error || `GitHub request failed (${res.status}).`);
      }
      setGhUrl(data.url);
      setGhFiles(data.files ?? 0);
      setGhStatus('success');
    } catch (error) {
      setGhError(
        error instanceof Error ? error.message : 'Unexpected network error.'
      );
      setGhStatus('error');
    } finally {
      window.clearInterval(stepTimer);
    }
  }, [ghToken, ghRepo, ghStatus]);

  // Esc closes the GitHub export panel
  useEffect(() => {
    if (!ghOpen) return;
    function onPanelKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setGhOpen(false);
    }
    window.addEventListener('keydown', onPanelKeyDown);
    return () => window.removeEventListener('keydown', onPanelKeyDown);
  }, [ghOpen]);

  // Esc closes the fullscreen lobby panel
  useEffect(() => {
    if (!lobbyPanel) return;
    function onPanelKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setLobbyPanel(null);
    }
    window.addEventListener('keydown', onPanelKeyDown);
    return () => window.removeEventListener('keydown', onPanelKeyDown);
  }, [lobbyPanel]);

  // wire the bridge the game loop communicates through
  useEffect(() => {
    hudBridgeRef.current.publish = setLoadout;
    hudBridgeRef.current.enterLobby = enterLobby;
    hudBridgeRef.current.lootToast = showToast;
    return () => {
      hudBridgeRef.current.publish = undefined;
      hudBridgeRef.current.enterLobby = undefined;
      hudBridgeRef.current.lootToast = undefined;
    };
  }, [enterLobby, showToast]);

  // Enter also deploys from the lobby — but never while typing in a text
  // field (e.g. the GitHub export panel inputs).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Enter' || phaseRef.current !== 'lobby') return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      enterGame();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enterGame]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ================= quality tier (mobile LOW to stop the hang) ==========
    const LOW_SPEC = detectLowSpecDevice();

    // ================= camera / scene =================
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1,
      20000
    );

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd1e5);
    // atmospheric haze; the colour is re-synced to the sky every frame
    scene.fog = new THREE.FogExp2(0xbfd1e5, FOG_DENSITY);

    // ============ infinite terrain (streamed voxel chunks) =============
    // Deterministic perlin height field, streamed as merged voxel chunks
    // around the player: new terrain materialises ahead of you while the
    // chunks behind you are disposed (see src/game/terrainChunks.ts). The
    // seed is drawn once per session like the old generator's z offset; the
    // loot-chest layout is salted with the same value.
    const terrainSeed = Math.random() * 100;
    const terrain: TerrainChunksHandle = createTerrainChunks(scene, {
      block: BLOCK,
      gridOffset: GRID_OFFSET,
      chunkBlocks: 16,
      viewRadius: LOW_SPEC ? 4 : 6,
      seedZ: terrainSeed,
      lowSpec: LOW_SPEC,
    });
    terrain.ensureAround(0, 0, 3, true); // spawn chunks meshed immediately
    (window as unknown as { __terrain?: object }).__terrain = {
      stats: terrain.stats,
      heightAt: terrain.surfaceYAt,
      pos: () => ({ x: pos.x, y: pos.y, z: pos.z }),
    };

    /** Terrain surface height (top of the block) at a world-space position. */
    function surfaceYAt(worldX: number, worldZ: number): number {
      return terrain.surfaceYAt(worldX, worldZ);
    }

    // ---- flat-spawn finder: the player AND the jeep must always start on
    // level ground. Candidate centres spiral out from (cx, cz); a candidate
    // wins when the terrain across its whole disc (centre + two sampled
    // rings) varies by no more than `tol` world units — one terrain block is
    // 100 units, so a tiny spread really is a plane. The flattest candidate
    // seen is always remembered, so the search never fails: it just walks
    // farther out when the immediate area is sloped.
    function findFlatSpot(
      cx: number,
      cz: number,
      discRadius: number,
      tol: number,
      searchRadius: number
    ): { x: number; z: number; y: number } {
      const rings: Array<[number, number]> = [
        [0, 1],
        [discRadius * 0.5, 8],
        [discRadius, 12],
      ];
      const spreadAt = (x: number, z: number) => {
        let min = Infinity;
        let max = -Infinity;
        for (const [r, n] of rings) {
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const h = surfaceYAt(x + Math.cos(a) * r, z + Math.sin(a) * r);
            if (h < min) min = h;
            if (h > max) max = h;
          }
        }
        return max - min;
      };
      let bestX = cx;
      let bestZ = cz;
      let bestSpread = Infinity;
      const step = Math.max(60, discRadius * 0.9);
      search: for (let r = 0; r <= searchRadius; r += step) {
        const n =
          r === 0 ? 1 : Math.max(8, Math.round((Math.PI * 2 * r) / step));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + r * 0.37; // twisted spiral
          const x = cx + Math.cos(a) * r;
          const z = cz + Math.sin(a) * r;
          const spread = spreadAt(x, z);
          if (spread < bestSpread) {
            bestSpread = spread;
            bestX = x;
            bestZ = z;
            if (bestSpread <= tol) break search;
          }
        }
      }
      return { x: bestX, z: bestZ, y: surfaceYAt(bestX, bestZ) };
    }

    // the player's home patch: a level disc big enough for the character and
    // the follow camera. Found once per session — the terrain seed is
    // per-session too, so this exact spot stays flat for every respawn.
    const spawnFlat = findFlatSpot(0, 0, 70, 4, 2400);
    terrain.ensureAround(spawnFlat.x, spawnFlat.z, 3, true);

    const timer = new THREE.Timer();
    timer.connect(document);

    let renderer: THREE.WebGLRenderer;

    const ambientLight = new THREE.AmbientLight(0xeeeeee, 3);
    scene.add(ambientLight);

    // Day/night cycle: the sun orbits the world once per CYCLE_SECONDS and
    // the moon rides the opposite side of the sky. ONE directional light
    // plays both roles — warm bright sunlight by day, dim blue moonlight by
    // night, with real shadows in both phases — crossfading through a
    // near-zero intensity at dusk/dawn so the direction swap is invisible.
    // The light travels with the player so the shadow camera only needs to
    // cover the area around the character.
    const SUN_DISTANCE = 2600;
    const sunDir = new THREE.Vector3();
    const moonDir = new THREE.Vector3();
    let timeHour = DAY_START_HOUR; // 0..24, advances in the render loop

    function sunAngleFromHour(hour: number): number {
      // 6h = sunrise (east horizon), 12h = zenith, 18h = sunset (west)
      return ((hour - SUNRISE_HOUR) / 24) * Math.PI * 2;
    }

    function updateSunMoonDirections() {
      const a = sunAngleFromHour(timeHour);
      sunDir.set(Math.cos(a), Math.sin(a), 0.35).normalize();
      // Moon rides the opposite arc but keeps the same z-tilt as the sun,
      // so it rises in front of the default camera view instead of behind it.
      moonDir.set(-Math.cos(a), -Math.sin(a), 0.35).normalize();
    }

    updateSunMoonDirections();

    const directionalLight = new THREE.DirectionalLight(0xffffff, 12);
    directionalLight.position.copy(sunDir).multiplyScalar(SUN_DISTANCE);
    directionalLight.castShadow = true;
    // mobile: 1024² shadow map — a quarter of the shadow-pass pixels, still
    // clean at the capped render scale (normalBias 3 hides the chunkier texels)
    directionalLight.shadow.mapSize.set(
      LOW_SPEC ? 1024 : 2048,
      LOW_SPEC ? 1024 : 2048
    );
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 8000;
    directionalLight.shadow.camera.left = -900;
    directionalLight.shadow.camera.right = 900;
    directionalLight.shadow.camera.top = 900;
    directionalLight.shadow.camera.bottom = -900;
    directionalLight.shadow.camera.updateProjectionMatrix();
    directionalLight.shadow.bias = -0.0004;
    directionalLight.shadow.normalBias = 3;
    scene.add(directionalLight);
    scene.add(directionalLight.target);

    // ================= sun & moon discs in the sky =================
    // The realistic circular sun keeps its runtime-generated radial-gradient
    // glow; it now rides the moving sun direction and dips below the horizon
    // at dusk, warming to deep orange as it sets. A canvas-painted moon
    // (shaded disc + craters + soft halo) rides the opposite direction and
    // rises as the sun sets. Both re-anchor to the camera every frame so
    // they read as infinitely far away.
    const SUN_VISUAL_DISTANCE = 15000; // inside camera.far (20000)

    function createSunTexture(): THREE.CanvasTexture {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2D canvas not supported');

      const gradient = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2
      );
      gradient.addColorStop(0, 'rgba(255, 255, 248, 1)'); // white-hot center
      gradient.addColorStop(0.1, 'rgba(255, 252, 235, 1)'); // bright core
      gradient.addColorStop(0.18, 'rgba(255, 240, 180, 0.95)'); // disc edge
      gradient.addColorStop(0.3, 'rgba(255, 214, 120, 0.5)'); // inner glow
      gradient.addColorStop(0.55, 'rgba(255, 196, 100, 0.16)'); // halo falloff
      gradient.addColorStop(1, 'rgba(255, 185, 90, 0)'); // fades into sky

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    const sunTexture = createSunTexture();
    const sunMaterial = new THREE.MeshBasicMaterial({
      map: sunTexture,
      transparent: true,
      depthWrite: false,
      fog: false, // the sun reads as infinitely far, beyond the haze
    });
    const sunMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(4200, 4200),
      sunMaterial
    );
    sunMesh.position.copy(sunDir).multiplyScalar(SUN_VISUAL_DISTANCE);
    scene.add(sunMesh);

    // --- moon: pale shaded disc with craters, melting into a soft halo ---
    function createMoonTexture(): THREE.CanvasTexture {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2D canvas not supported');

      const r = size / 2;

      // outer glow halo + limb softening, drawn behind the solid disc
      const halo = ctx.createRadialGradient(r, r, 0, r, r, r);
      halo.addColorStop(0, 'rgba(255, 254, 244, 0.98)');
      halo.addColorStop(0.3, 'rgba(248, 243, 224, 0.95)');
      halo.addColorStop(0.42, 'rgba(232, 226, 203, 0.82)'); // disc edge
      halo.addColorStop(0.5, 'rgba(214, 216, 205, 0.35)'); // limb
      halo.addColorStop(0.6, 'rgba(190, 200, 210, 0.12)'); // inner halo
      halo.addColorStop(1, 'rgba(170, 190, 210, 0)'); // fades to sky
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, size, size);

      // disc interior: offset highlight (lit from the upper left)
      ctx.save();
      ctx.beginPath();
      ctx.arc(r, r, r * 0.42, 0, Math.PI * 2);
      ctx.clip();
      const body = ctx.createRadialGradient(
        r * 0.78,
        r * 0.72,
        r * 0.05,
        r,
        r,
        r * 0.48
      );
      body.addColorStop(0, 'rgba(255, 254, 246, 0.95)');
      body.addColorStop(0.6, 'rgba(242, 237, 216, 0.92)');
      body.addColorStop(1, 'rgba(203, 197, 174, 0.9)');
      ctx.fillStyle = body;
      ctx.fillRect(0, 0, size, size);

      // craters: fixed layout so the moon always looks the same
      const craters: Array<[number, number, number]> = [
        [0.4, 0.36, 0.1],
        [0.62, 0.5, 0.14],
        [0.45, 0.66, 0.09],
        [0.68, 0.7, 0.07],
        [0.3, 0.56, 0.06],
        [0.58, 0.28, 0.05],
        [0.74, 0.42, 0.075],
        [0.38, 0.48, 0.045],
        [0.52, 0.58, 0.035],
      ];
      for (const [cx, cy, cr] of craters) {
        const px = r + (cx - 0.5) * r * 0.72;
        const py = r + (cy - 0.5) * r * 0.72;
        const pr = cr * r;
        const craterGrad = ctx.createRadialGradient(
          px - pr * 0.25,
          py - pr * 0.25,
          pr * 0.1,
          px,
          py,
          pr
        );
        craterGrad.addColorStop(0, 'rgba(168, 162, 138, 0.55)');
        craterGrad.addColorStop(0.7, 'rgba(178, 172, 148, 0.4)');
        craterGrad.addColorStop(1, 'rgba(200, 195, 170, 0)');
        ctx.fillStyle = craterGrad;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    const moonTexture = createMoonTexture();
    const moonMaterial = new THREE.MeshBasicMaterial({
      map: moonTexture,
      transparent: true,
      depthWrite: false,
      fog: false, // the moon reads as infinitely far, beyond the haze
    });
    const moonMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2600, 2600),
      moonMaterial
    );
    moonMesh.position.copy(moonDir).multiplyScalar(SUN_VISUAL_DISTANCE);
    scene.add(moonMesh);

    // --- stars: a dim field + sparse bright stars on a camera-following
    //     sphere; additive round sprites that fade in with the night ---
    function createStarSprite(): THREE.CanvasTexture {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2D canvas not supported');

      const gradient = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.85)');
      gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.22)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    const starSprite = createStarSprite();

    /** Uniform random directions on the sphere (y > -0.2), radius STAR_RADIUS. */
    function makeStarPositions(count: number): Float32Array {
      const arr = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        let x = 0;
        let y = 0;
        let z = 0;
        do {
          x = Math.random() * 2 - 1;
          y = Math.random() * 2 - 1;
          z = Math.random() * 2 - 1;
        } while (x * x + y * y + z * z > 1 || y < -0.2);
        const len = Math.sqrt(x * x + y * y + z * z) || 1;
        arr[i * 3] = (x / len) * STAR_RADIUS;
        arr[i * 3 + 1] = (y / len) * STAR_RADIUS;
        arr[i * 3 + 2] = (z / len) * STAR_RADIUS;
      }
      return arr;
    }

    /** Slightly varied star tints (warm/cool whites) with random brightness. */
    function makeStarColors(count: number): Float32Array {
      const tints = [
        [1, 1, 1],
        [1, 0.94, 0.82],
        [0.82, 0.89, 1],
        [1, 0.85, 0.68],
      ];
      const arr = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const tint = tints[(Math.random() * tints.length) | 0];
        const b = 0.4 + Math.random() * 0.6;
        arr[i * 3] = tint[0] * b;
        arr[i * 3 + 1] = tint[1] * b;
        arr[i * 3 + 2] = tint[2] * b;
      }
      return arr;
    }

    function createStars(count: number, pointSize: number): THREE.Points {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(makeStarPositions(count), 3)
      );
      geometry.setAttribute(
        'color',
        new THREE.BufferAttribute(makeStarColors(count), 3)
      );
      const material = new THREE.PointsMaterial({
        map: starSprite,
        size: pointSize,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        fog: false, // stars sit beyond the haze; don't wash them out
      });
      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false; // the sphere follows the camera; never cull
      points.renderOrder = 1; // drawn before the cloud layers composite over
      scene.add(points);
      return points;
    }

    const starsField = createStars(STAR_COUNT, 52);
    const starsBright = createStars(STAR_BRIGHT_COUNT, 120);
    starsField.add(starsBright); // share position + slow rotation

    // ================= procedural clouds (slow drift + morph) ============
    // Two world-anchored FBM layers — a low foggy cumulus deck and a high
    // cirrus veil — that drift very slowly and continuously change shape;
    // tinted by the day/night cycle and blended into the sky at the horizon.
    // Mobile LOW tier drops FBM octaves (5/4 -> 3/3): a huge fill-rate save
    // over the huge sky area, with only a subtle softening of the shapes.
    const clouds: SkyCloudsHandle = createSkyClouds(scene, {
      lowQuality: LOW_SPEC,
    });
    (window as unknown as { __clouds?: object }).__clouds = {
      layers: 2,
      setCoverage: (v: number) => clouds.setCoverage(v),
      stats: () => clouds.stats(),
    };

    // Whole-terrain rain: one uniform GPU-animated field whose 12,800-unit
    // seed box wraps around the player (so rain follows you across the
    // endless world at constant density), plus a LIGHT 440-streak bump that
    // follows the player out to a 350-unit radius so the rain around the
    // camera feels slightly fuller. page.tsx schedules exactly one shower
    // per in-game day (see rainIntensityFromHour) and updateSky dims the
    // sun/fog/sky while it pours. The shower is GREEN-LAND ONLY: the
    // winter/ice biome factors damp it to zero across the snow border, so
    // water rain never falls inside the frozen countries (they have their
    // own weather — snowfall + glacier sleet). Mobile LOW tier thins the
    // far field (170k -> 56k streaks): the shower reads identically but
    // sheds far fewer vertices + MBs of buffers.
    const rain: RainHandle = createRain(
      scene,
      LOW_SPEC ? { farDrops: 56000 } : undefined
    );
    let rainIntensity = 0; // 0..1, daily storm DAMPED to zero over snow/ice
    (window as unknown as { __rain?: object }).__rain = {
      intensity: () => rainIntensity,
      window: RAIN_WINDOW,
      counts: rain.counts,
      audioMuted: rain.audioMuted,
      audioGain: rain.audioGain,
    };

    // Winter-biome glacier sleet: pale ice streaks pour from the cloud deck
    // only over the blue glacier HEARTS (iceFactor) with their own icy audio
    // bed, fading in/out across the ice rim — independent of the once-per-day
    // water storm.
    const iceRain: IceRainHandle = createIceRain(
      scene,
      LOW_SPEC ? { farDrops: 27000 } : undefined
    );
    let iceIntensity = 0; // 0..1, the player's glacier-heart factor
    (window as unknown as { __iceRain?: object }).__iceRain = {
      intensity: () => iceIntensity,
      counts: iceRain.counts,
      audioMuted: iceRain.audioMuted,
      audioGain: iceRain.audioGain,
    };

    // Winter-biome SNOWFALL: across the snow countries the sky sheds soft
    // white FLAKES that drift down ~10x slower than any rain and sway on
    // the wind — nothing like the water storm's fast streaks or the glacier
    // hearts' harsh sleet. Fades in/out across the biome's soft border.
    // Desktop: 300k crystals; mobile LOW tier thins to 100k. flakes are
    // born at the mid of the cloud band and land ON the terrain (the real
    // surface height feeds the snow system's ground heightmap).
    const snowRain: SnowRainHandle = createSnowRain(scene, {
      farFlakes: LOW_SPEC ? 100000 : undefined,
      heightAt: surfaceYAt,
    });
    let winterIntensity = 0; // 0..1, the player's winter-biome factor
    (window as unknown as { __snowRain?: object }).__snowRain = {
      intensity: () => winterIntensity,
      counts: snowRain.counts,
      audioMuted: snowRain.audioMuted,
      audioGain: snowRain.audioGain,
    };
    // debug/exploration handle (same family as __terrain/__rain/__atmos):
    // live biome factor + a safe snap-teleport used to visit the zones
    (window as unknown as { __winter?: object }).__winter = {
      factor: () => winterIntensity,
      zones: WINTER_ZONES,
      debugTeleport(x: number, z: number) {
        pos.set(x, surfaceYAt(x, z), z);
        vy = 0;
        airborne = false;
        terrain.ensureAround(x, z, 2, true); // ground under the boots, now
      },
    };

    // DESERT-biome exploration handle — the exact __winter mirror for the
    // dune countries: live sand factor + snap-teleport so the hot zones
    // are as easy to visit as the frozen ones
    let desertIntensity = 0; // 0..1, the player's desert-biome factor
    (window as unknown as { __desert?: object }).__desert = {
      factor: () => desertIntensity,
      zones: DESERT_ZONES,
      debugTeleport(x: number, z: number) {
        pos.set(x, surfaceYAt(x, z), z);
        vy = 0;
        airborne = false;
        terrain.ensureAround(x, z, 2, true); // ground under the boots, now
      },
    };

    // RED DESERT / BADLANDS / VOLCANO — the three extra climate factors,
    // mirroring desertIntensity; each drives its own sky tint + dry
    // weather gate, and the volcano also drives the ember swarm
    let redIntensity = 0; // 0..1, the player's red-desert factor
    let mesaIntensity = 0; // 0..1, the player's badlands factor
    let volcanoIntensity = 0; // 0..1, the player's volcano factor

    // 3D SKY ZONE SIGN: when the player settles into a new biome, its
    // name rises into the sky as giant 3D block letters (the voxel-font
    // sign — see src/game/skyText.ts). A short stability window stops
    // the wobbled biome borders from double-triggering while straddling.
    const skyText: SkyTextHandle = createSkyText(scene);
    const ZONE_SIGNS: Record<string, { label: string; color: number }> = {
      volcano: { label: 'VOLCANO', color: 0xff6a2a },
      badlands: { label: 'BADLANDS', color: 0xd89058 },
      reddesert: { label: 'RED DESERT', color: 0xe07840 },
      desert: { label: 'DESERT ZONE', color: 0xe8c26a },
      winter: { label: 'WINTER ZONE', color: 0xcfe6ff },
      grass: { label: 'GRASSLANDS', color: 0x9fe06a },
    };
    let currentZoneId = ''; // empty -> GRASSLANDS signs itself on deploy
    let pendingZoneId = '';
    let zoneStableT = 0;
    // effect-scope mirrors of the frame loop's hot-gated winter factors
    // (the voice context reads these — the loop-locals are block-scoped)
    let winterFxVal = 0;
    let iceFxVal = 0;

    // VOLCANO EMBERS: the ash country's own weather — glowing sparks
    // rising off the ground, fading with the volcano factor
    const embers: EmbersHandle = createEmbers(scene, LOW_SPEC ? 90 : 240);
    (window as unknown as { __embers?: object }).__embers = {
      intensity: () => volcanoIntensity,
    };

    // VOLCANO ASH PLUME: the stratovolcanoes smoke — a dense ash column
    // with molten sparks anchored over the nearest crater, fading in as
    // the player closes in (see src/game/volcanoPlume.ts)
    const plume: VolcanoPlumeHandle = createVolcanoPlume(scene, {
      block: BLOCK,
      gridOffset: GRID_OFFSET,
      heightAt: surfaceYAt,
      lowSpec: LOW_SPEC,
    });
    // live crater-glow weight (0 far, 1 on the rim) — drives the warm
    // ember cast updateSky breathes into the vault near a live volcano
    let volcanoGlow = 0;

    // zone exploration handle: live factors for the three extra biomes,
    // the current sky-sign zone, a manual announce (verification), and
    // volcano helpers (teleport to each stratovolcano's vantage point,
    // the crater rim or the caldera floor + live nearest-volcano readout)
    (window as unknown as { __zones?: object }).__zones = {
      red: () => redIntensity,
      mesa: () => mesaIntensity,
      volcano: () => volcanoIntensity,
      current: () => currentZoneId,
      announce: (id: string) => {
        const sign = ZONE_SIGNS[id];
        if (sign) skyText.show(sign.label, sign.color);
      },
      volcanoNear: () =>
        nearestVolcanoWorld(pos.x, pos.z, BLOCK, GRID_OFFSET),
      plume: () => plume.debug(),
      volcanoes: () =>
        [0, 1, 2, 3].map((i) => handVolcanoInfo(i, BLOCK, GRID_OFFSET)),
      tpVolcano: (i: number, where?: 'view' | 'rim' | 'pool') => {
        const info = handVolcanoInfo(i, BLOCK, GRID_OFFSET);
        let tx = info.viewX;
        let tz = info.viewZ;
        if (where === 'rim') {
          // standing on the crater rim, spawn-facing side
          const off = (info.craterRBlocks + 2.5) * BLOCK;
          tx = info.x - Math.sign(info.x) * off;
          tz = info.z - Math.sign(info.z) * off;
        } else if (where === 'pool') {
          // hovering over the caldera lava lake
          tx = info.x;
          tz = info.z;
        }
        pos.set(tx, surfaceYAt(tx, tz) + 40, tz);
        vy = 0;
        airborne = false;
        terrain.ensureAround(tx, tz, 3, true);
      },
    };

    // SNOW FOOTPRINTS: wherever the player actually WALKS across the snow
    // countries, each boot press stamps the user-provided CHROMAKEY sole
    // EMBLEM (public/textures/footprint-sole-chromakey-2.png — the
    // hexagonal circuit-board shield with an eye) in its own colours, the
    // SAME artwork day and night. Rotated to the walking direction, one
    // per footstep-sound beat, and each one still slowly fades away over
    // ~40s: walk on and the snow cleans itself up behind you.
    const footprints: FootprintHandle = createFootprintSystem(scene, {
      block: BLOCK,
      gridOffset: GRID_OFFSET,
      heightAt: surfaceYAt,
      lowSpec: LOW_SPEC,
    });
    (window as unknown as { __footprints?: object }).__footprints = {
      stats: footprints.stats,
      clear: footprints.clear,
      fastForward: footprints.debugFastForward,
    };

    // Puddles left on the terrain after each shower: as the player explores
    // the endless world, regions are scanned for flat plateau cells and
    // seeded with lobed, feather-edged water puddles that fill while it
    // rains (rippling, sky-mirroring) and dry out slowly afterwards.
    const water: GroundWaterHandle = createGroundWater(scene, {
      block: BLOCK,
      gridOffset: GRID_OFFSET,
      heightAt: terrain.blockHeight,
    });
    (window as unknown as { __water?: object }).__water = {
      stats: water.stats,
      wet: () => water.wet(),
      nearest: (x: number, z: number) => water.nearest(x, z),
    };

    // ========== atmosphere drama VFX (storm + night + dawn) ============
    // Lightning during heavy rain, shooting stars at night and
    // footstep/landing dust — one pooled module (see
    // src/game/atmosphereVfx.ts) driven by the same day/night + rain
    // state the sky renderer just consumed.
    const atmos: AtmosphereVfxHandle = createAtmosphereVfx(scene, {
      lowSpec: LOW_SPEC,
      heightAt: surfaceYAt,
      onThunder: (delay) => {
        void getGameAudio().then((sfx) => sfx.thunder(delay));
      },
    });
    (window as unknown as { __atmos?: object }).__atmos = {
      stats: atmos.stats,
      strike: () => atmos.debugStrike(),
      meteor: () => atmos.debugMeteor(),
      sheet: () => atmos.debugSheet(),
    };

    // ========= drivable map vehicle: armored jeep (photo replica) =========
    // Hand-built replica of the reference jeep photos parked near the spawn
    // plaza. Walk up and press E to take the wheel: W/S throttle, A/D
    // steer, Space handbrake, E again to step out. The exhaust smokes more
    // the faster you go.
    const jeep = createJeepProp(scene, {
      lowSpec: LOW_SPEC,
      heightAt: surfaceYAt,
    });
    // park near the player's flat spawn (same relative offset as before),
    // but ON its own level disc — all four wheels rest on plane terrain
    const jeepFlat = findFlatSpot(
      spawnFlat.x + 300,
      spawnFlat.z - 240,
      140,
      8,
      2000
    );
    // sit exactly on the surface under the center — wheels may tuck slightly
    // into a slope but the jeep never floats
    const jeepY = surfaceYAt(jeepFlat.x, jeepFlat.z);
    jeep.place(jeepFlat.x, jeepFlat.z, jeepY, -0.55);
    (window as unknown as { __jeep?: object }).__jeep = {
      pos: () => jeep.group.position.clone(),
      stats: jeep.stats,
      collide: jeep.collide,
      enter: enterJeep,
      exit: exitJeep,
      suspension: jeep.suspension,
      state: () => ({
        driving,
        nearJeep,
        speed: Math.round(driveSpeed),
        drifting: driveDrift,
      }),
    };

    // ========= pet drone: "BUZZ" the AUTONOMOUS AI quadcopter =========
    // Hand-built micro-detail drone (carbon/panel/hazard procedural
    // textures) that lives with the player: damped-spring formation
    // flight, velocity banking, spinning props with blur discs, aviation
    // nav/strobe lights and headlights that come on at night.
    //
    // It is also an AUTONOMOUS AI GUNSHIP (droneAi.ts — no chat, no
    // operator): BUZZ scans the threat view on its own, engages whatever
    // it finds (attack orbit, chin-gun bursts, cadence-gated HOMING
    // rockets — no lock ritual), breaks off after each kill and always
    // returns to formation on its own. With the world currently
    // hostile-free the brain rests in PATROL: pure formation flight.
    // Manual orders (G / touch STRAFE streams at the facing point, H /
    // touch MISSILE drops a rocket) still work as a direct override — the
    // AI simply stands down its trigger while you hold one. BUZZ's ammo
    // is flown by the pooled bullet system below — this box is filled in
    // right after `bullets` is created.
    const droneOrdnance: PetDroneOrdnance = {
      fireBullet: () => undefined,
      fireRocket: () => undefined,
    };
    /** Where BUZZ aims: the ground point ~430 units ahead of the facing
     *  (player yaw on foot, jeep heading while driving) — manual orders. */
    const droneAim = new THREE.Vector3();
    /** Where BUZZ's nose slews while parked on an AI target (the
     *  designated threat's chest — fed to petDrone as `combatTarget`). */
    const droneCombatAim = new THREE.Vector3();
    let lastKillAt = -10; // BUZZ holds fire briefly after each kill
    let lastDroneHud = ''; // cached chip text (skip identical DOM writes)
    /** BUZZ hull integrity 0..100 — enemy rounds chew it, formation time
     *  repairs it; below 30 the AI brain flies home on its own. */
    let buzzHull = 100;
    /** Touch STRAFE hold state (the keyboard uses the `keys` set). */
    let droneGunHeld = false;
    /** The autonomous combat brain — decides, the drone executes. */
    const droneAi = createDroneAi();
    const petDrone = createPetDrone(scene, {
      lowSpec: LOW_SPEC,
      heightAt: surfaceYAt,
      ordnance: droneOrdnance,
    });
    (window as unknown as { __petDrone?: object }).__petDrone = {
      pos: () => petDrone.group.position.clone(),
      stats: petDrone.stats,
      group: petDrone.group,
      fireGun: () => petDrone.fireGun(droneAim),
      missile: () => petDrone.launchMissile(droneAim),
      missiles: () => petDrone.missilesLoaded(),
      ai: () => droneAi.snapshot(),
      // full live API — lets automated verification freeze/inspect the
      // drone deterministically (e.g. swap update for a still close-up)
      raw: petDrone,
    };

    // --- driving state (input handlers + frame loop read these) ---
    const JEEP_ENTER_RANGE = 150; // walk this close to grab the wheel
    let driving = false; // mounted and in control of the jeep
    let nearJeep = false; // close enough to press E and enter
    let driveSpeed = 0; // last frame's signed jeep speed (HUD + debug)
    let driveDrift = false; // last frame's drift flag (debug surface)
    let driveHudMode: 'hidden' | 'drive' | 'enter' = 'hidden';
    const jeepInput = { throttle: 0, steer: 0, brake: false };

    /** Hop in: hide the character, snap the chase camera, cough a start puff. */
    function enterJeep(): void {
      if (
        driving ||
        phaseRef.current !== 'playing' ||
        deathTimer > 0 ||
        !loaded
      ) {
        return;
      }
      driving = true;
      attackHeld = false;
      setRunSound(false);
      setSnowWalkSound(false);
      character.root.visible = false;
      camYawOffset = 0;
      camPitch = CAM_DEFAULT_PITCH;
      camDistTarget = JEEP_CAM_DIST;
      pos.set(
        jeep.group.position.x,
        jeep.group.position.y + 24,
        jeep.group.position.z
      );
      yaw = jeep.group.rotation.y;
      jeep.smokeBurst(LOW_SPEC ? 3 : 5); // engine cough on ignition
      // the user's car-ignition SFX (mixkit #1535): key turn + starter crank
      // + engine catch — fires on EVERY mount path (E key, touch button,
      // debug handle) since they all land here; routed through the master
      // gain so the speaker mute toggle silences it like every other cue
      void getGameAudio().then((sfx) => sfx.ignition());
    }

    /** Step out on the driver's side and put the character back. */
    function exitJeep(): void {
      if (!driving) return;
      driving = false;
      driveDrift = false; // stale drift flag must not echo into re-entries
      setScreechSound(false); // sliding stopped the moment you stepped out
      const h = jeep.group.rotation.y;
      const cos = Math.cos(h);
      const sin = Math.sin(h);
      const lx = -140; // driver side (local -X), just outside the body
      const lz = -30;
      pos.x = jeep.group.position.x + lx * cos + lz * sin;
      pos.z = jeep.group.position.z - lx * sin + lz * cos;
      pos.y = surfaceYAt(pos.x, pos.z);
      yaw = h;
      vy = 0;
      airborne = false;
      character.root.visible = true;
      camYawOffset = 0;
      camDistTarget = CAM_DIST;
      // if the step-down landed inside the footprint, get pushed clear
      const push = jeep.collide(pos.x, pos.z, 22);
      if (push) {
        pos.x = push.x;
        pos.z = push.z;
      }
    }

    // ============== loot chests (region-seeded, auto-open) =============
    // Rare wooden/gold crates scattered across the endless terrain by the
    // same deterministic region trick as the puddles: walking into one pops
    // it open (desktop + mobile alike), bursting coins — rare chests also
    // drop gems — that are banked into the HUD balance while the chest
    // sinks away. Opened chests stay looted for the whole session.
    const chests: LootChestsHandle = createLootChests(scene, {
      block: BLOCK,
      gridOffset: GRID_OFFSET,
      heightAt: terrain.blockHeight,
      seedZ: terrainSeed,
      lowSpec: LOW_SPEC,
      onLoot: (loot) => {
        setCoins((value) => value + loot.coins);
        if (loot.gems > 0) setGems((value) => value + loot.gems);
        hudBridgeRef.current.lootToast?.(
          loot.gems > 0
            ? `+${loot.coins} coins · +${loot.gems} ${loot.gems === 1 ? 'gem' : 'gems'}`
            : `+${loot.coins} coins`
        );
        void getGameAudio().then((sfx) => sfx.pickup());
      },
    });
    mapBridgeRef.current.heightAt = terrain.blockHeight;
    mapBridgeRef.current.getMarkers = chests.mapMarkers;
    (window as unknown as { __chests?: object }).__chests = {
      stats: chests.stats,
      list: chests.mapMarkers,
      nearest: (x: number, z: number) => chests.nearest(x, z),
    };

    // debug/verification teleport (window.__cheats.tp): moves the player to
    // a world position, meshes the ground under their feet, snaps camera
    // window.__cheats.yaw(v): sets the player/camera facing (radians) so
    // automated browser verification can frame shots deterministically
    // window.__cheats.pitch(v): orbit pitch (rad; -0.85 low looking up,
    // +1.25 near top-down) · window.__cheats.dist(v): orbit distance
    (window as unknown as {
      __cheats?: {
        tp(x: number, z: number): void;
        yaw(v: number): void;
        pitch(v: number): void;
        dist(v: number): void;
      };
    }).__cheats = {
      tp: (x: number, z: number) => {
        pos.set(x, surfaceYAt(x, z), z);
        vy = 0;
        airborne = false;
        terrain.ensureAround(x, z, 1, true);
        updateCamera(true, 0);
      },
      yaw: (v: number) => {
        yaw = v;
        camYawOffset = 0; // frame the facing exactly (no orbit residue)
        updateCamera(true, 0);
      },
      pitch: (v: number) => {
        camPitch = Math.min(CAM_MAX_PITCH, Math.max(CAM_MIN_PITCH, v));
        updateCamera(true, 0);
      },
      dist: (v: number) => {
        camDistTarget = Math.min(CAM_MAX_DIST, Math.max(CAM_MIN_DIST, v));
        updateCamera(false, 0);
      },
    };

    // ========== the world is hostile-free ==========
    // The enemy squad (and its lock-on mechanism) was removed by request:
    // BUZZ is a pure companion drone again — it follows the player through
    // the Tasks 11-13 formation flight, streams its chin gun with G /
    // touch STRAFE and drops rockets with H / touch MISSILE on demand.
    // The autonomous brain stays wired but scans an empty threat view, so
    // it rests in PATROL until targets are ever re-introduced.

    // ============== bullets + gun VFX (fired from the weapon muzzle) =======
    // Pooled FMJ rounds with a copper/brass jacket texture, tracer streaks,
    // muzzle flash quads, spark bursts and smoke puffs. Phones run smaller
    // pools + fewer particles (LOW_SPEC). `__bullets` is a tooling surface:
    // fire() spawns a shot from the current muzzle, setSlowmo() slows the
    // round for screenshots, stats() reports pool activity.
    const bullets = createBulletSystem(scene, {
      lowSpec: LOW_SPEC,
      heightAt: surfaceYAt,
      onBoom: () => {
        // rocket detonation — the synthesized rumble doubles as the boom
        void getGameAudio().then((sfx) => sfx.thunder(0.02));
      },
      // AIR COMBAT: rounds + rockets chew into flying combatants —
      // BUZZ's own airframe and the player's body. Damage routing happens
      // per combatant kind.
      airHitTest: (p) => {
        if (petDrone.group.position.distanceToSquared(p) < 55 * 55) {
          return { kind: 'pet', id: 0 };
        }
        const dx = p.x - pos.x;
        const dz = p.z - pos.z;
        if (
          dx * dx + dz * dz < 30 * 30 &&
          p.y > pos.y - 12 &&
          p.y < pos.y + CHAR_HEIGHT + 12
        ) {
          return { kind: 'player', id: 0 };
        }
        return null;
      },
      onAirHit: (info) => {
        if (info.kind === 'pet') {
          buzzHull = Math.max(0, buzzHull - 4);
        } else {
          applyDamage(7); // stray rounds sting — the health bar reacts
        }
      },
      // BUZZ's hull takes blast damage when a rocket air-bursts next to him
      onAirBlast: (p) => {
        const d = petDrone.group.position.distanceTo(p);
        if (d < 260) buzzHull = Math.max(0, buzzHull - 55 * (1 - d / 260));
      },
    });
    (window as unknown as { __bullets?: object }).__bullets = {
      fire: () => spawnShot(),
      rocket: () => spawnRocket(),
      boom: () => bullets.detonate(),
      stats: bullets.stats,
      setSlowmo: bullets.setSlowmo,
    };
    // BUZZ's gun/missiles fly through the SAME pooled system as the
    // player's rounds (tracers, rocket trail, detonation, boom audio)
    droneOrdnance.fireBullet = (origin, dir) => bullets.fireFrom(origin, dir);
    droneOrdnance.fireRocket = (origin, dir) => bullets.fireRocket(origin, dir);
    droneOrdnance.fireHomingRocket = (origin, dir, tracker) =>
      bullets.fireHomingRocket(origin, dir, tracker);

    // ----- threat view: the world currently has no hostiles — the brain
    // scans, finds nothing, and rests in PATROL (formation flight). Feed
    // live targets in here to re-arm autonomous combat. ---
    const threats: DroneAiTargetView = {
      nearestAlive: () => null,
      isAlive: () => false,
      posOf: () => null,
    };
    /** Honest target count for the voice brain's telemetry (kept in sync
     *  by whatever feeds `threats`; zero while the world is hostile-free). */
    const threatStats = { alive: 0 };

    /**
     * Homing tracker onto one designated threat — samples the threat view
     * directly (works for ANY target source fed into `threats`; a null
     * position releases the guidance and the rocket flies straight).
     */
    const tmpTracker = new THREE.Vector3();
    function makeThreatTracker(id: number): PetRocketTracker {
      let last: { x: number; y: number; z: number } | null = null;
      let lastT = 0;
      const vel = new THREE.Vector3();
      const sample = new THREE.Vector3();
      return {
        getPos() {
          const p = threats.posOf(id);
          if (!p) return null;
          const nowS = performance.now() / 1000;
          sample.set(p.x, p.y, p.z);
          if (last) {
            const dts = Math.max(1e-3, nowS - lastT);
            vel.lerp(
              tmpTracker.set(
                (sample.x - last.x) / dts,
                (sample.y - last.y) / dts,
                (sample.z - last.z) / dts
              ),
              0.3
            );
          }
          last = { x: sample.x, y: sample.y, z: sample.z };
          lastT = nowS;
          return sample;
        },
        getVel: () => vel,
      };
    }

    // ================= MD2 character (ratamahatta + weapon) =================
    const character = new MD2Character();

    let loaded = false;
    let currentAnim = 'stand';
    let oneShot: string | null = null;
    /** True while KeyF (or the touch FIRE button) is held — keeps the attack
     *  clip looping. */
    let attackHeld = false;
    /** Mobile virtual joystick vector: x turns, y walks (analog -1..1). */
    const touchMoveVec = { x: 0, y: 0, active: false };
    /** Mobile RUN toggle — sprint speed while the joystick walks forward. */
    let sprintMode = false;
    /** Delay between the shot and its chained reload cue, derived from the
     *  REAL attack-clip duration once the MD2 model loads (0.8s clip -> 0.32s
     *  delay, so the reload clicks finish inside the shooting animation). */
    let reloadCueDelay = 0.32;
    /** How much of the monster-roar file one 5-press may play — the flip
     *  clip's real duration, measured at load (default 1.2s at 10 fps). */
    let flipCueDuration = 1.2;
    let airborne = false;
    let vy = 0;
    /** Vertical offset lifting the model so its feet rest exactly on the ground. */
    let footOffset = 0;
    /** Footstep cadence accumulator — running kicks up dust puffs (atmos). */
    let footAccum = 0;
    /** Alternating foot side for the dust trail: +1 right, -1 left — each
     *  step flips it so the puffs form a natural two-track footprint line. */
    let footSide = 1;

    const pos = new THREE.Vector3(spawnFlat.x, spawnFlat.y, spawnFlat.z);
    let yaw = 0;

    function playAnim(name: string, once: boolean, hold = false) {
      currentAnim = name;
      character.setAnimation(name);

      if (once) {
        oneShot = name;
        const meshes: Array<ActionMesh | null> = [
          character.meshBody as ActionMesh | null,
          character.meshWeapon as ActionMesh | null,
        ];
        for (const mesh of meshes) {
          const action = mesh?.activeAction;
          if (action) {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = hold;
          }
        }
      }
    }

    function onAnimFinished() {
      oneShot = null;
      // Hold-to-fire: seamlessly restart the attack clip while F stays held.
      // Every attack animation carries the full fire cycle (shot + quick
      // reload inside its own duration), restarts included — and every
      // restart also launches a fresh bullet from the muzzle.
      if (attackHeld && loaded && !airborne && deathTimer <= 0) {
        playAnim('attack', true);
        soundRef.current?.shootThenReload(reloadCueDelay);
        spawnShot();
      }
    }

    character.onLoadComplete = () => {
      (window as unknown as { __char?: MD2Character }).__char = character;
      const body = character.meshBody;
      if (body) {
        // Normalize the raw Quake-scale model to ~CHAR_HEIGHT world units.
        const bbox = new THREE.Box3().setFromBufferAttribute(
          body.geometry.attributes.position as THREE.BufferAttribute
        );
        const rawHeight = bbox.max.y - bbox.min.y;
        const s = CHAR_HEIGHT / rawHeight;

        body.scale.setScalar(s);
        for (const weapon of character.weapons) weapon.scale.setScalar(s);
        footOffset = -s * bbox.min.y;
        character.root.position.y = pos.y + footOffset;
        character.scale = s;
      }

      character.setAnimation('stand');
      applyWeapon(0);
      applySkin(0);
      character.mixer?.addEventListener('finished', onAnimFinished);

      // Measure the real attack clip so both gun cues (shot + reload) fit
      // inside ONE shooting animation: reload starts at 40% of the clip,
      // which leaves its ~0.41s of clicks to end right at the clip's end.
      const attackClip = (
        character.meshBody?.geometry as unknown as {
          animations?: THREE.AnimationClip[];
        }
      ).animations?.find((clip) => clip.name === 'attack');
      if (attackClip) {
        reloadCueDelay = Math.min(
          0.5,
          Math.max(0.2, attackClip.duration * 0.4)
        );
      }

      // Same measurement for the 5-key roar: the sound must start with the
      // flip animation and END with it, so it plays exactly clip-length.
      const flipClip = (
        character.meshBody?.geometry as unknown as {
          animations?: THREE.AnimationClip[];
        }
      ).animations?.find((clip) => clip.name === 'flip');
      if (flipClip) {
        flipCueDuration = flipClip.duration;
      }

      loaded = true;
    };

    character.loadParts({
      baseUrl: '/models/md2/ratamahatta/',
      body: 'ratamahatta.md2',
      skins: [
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
      ],
      weapons: [
        ['weapon.md2', 'weapon.png'],
        ['w_shotgun.md2', 'w_shotgun.png'],
        ['w_chaingun.md2', 'w_chaingun.png'],
        ['w_railgun.md2', 'w_railgun.png'],
      ],
    });

    scene.add(character.root);

    // ================= vitals & loadout =================
    let skinIndex = 0;
    let weaponIndex = 0;
    let health = MAX_HEALTH;
    let stamina = MAX_STAMINA; // unlimited sprint: pinned to max, debug only
    let lastDamageAt = -1e9;
    let elapsed = 0;
    let deathTimer = 0; // > 0 while the death sequence plays
    let publishedSkin = -1; // loadout mirror change detection
    let publishedWeapon = -1;
    const spawnPos = new THREE.Vector3(spawnFlat.x, spawnFlat.y, spawnFlat.z);

    function applySkin(index: number) {
      skinIndex = ((index % SKINS.length) + SKINS.length) % SKINS.length;
      character.setSkin(skinIndex);
    }

    /** Equips a loadout by index. Weapon meshes map 1:1 onto the loadout
     *  entries that have a model; the trailing Unarmed entry maps to -1,
     *  which makes the addon hide every weapon mesh. */
    function applyWeapon(index: number) {
      weaponIndex =
        ((index % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
      character.setWeapon(weaponIndex < WEAPONS.length - 1 ? weaponIndex : -1);
      // drawing a gun plays the reload cue (boot-time Blade apply stays silent)
      if (isGunWeapon(weaponIndex)) soundRef.current?.reload();
    }

    function applyDamage(amount: number) {
      if (deathTimer > 0) return;
      health = Math.max(0, health - amount);
      lastDamageAt = elapsed;

      if (health <= 0) {
        deathTimer = RESPAWN_DELAY;
        playAnim('death', true, true); // hold the final death pose
        keys.clear();
      } else if (!airborne) {
        playAnim('pain', true);
      }
    }

    function respawn() {
      if (driving) exitJeep(); // never respawn attached to a distant jeep
      pos.copy(spawnPos);
      // respawn teleports across the endless world — mesh the ground under
      // your feet immediately so you never drop through the void
      terrain.ensureAround(spawnPos.x, spawnPos.z, 1, true);
      vy = 0;
      airborne = false;
      yaw = 0;
      health = MAX_HEALTH;
      stamina = MAX_STAMINA;
      deathTimer = 0;
      camYawOffset = 0;
      playAnim('stand', false);
      updateCamera(true, 0); // snap the camera behind the respawned player
    }

    // ============ shared gameplay actions (keyboard + touch HUD) ============
    // The same gated primitives serve the physical keyboard AND the mobile
    // touch buttons, so both input paths behave identically (same animation
    // gates, same sounds, same hold-to-fire loop).
    function actionFire() {
      if (
        phaseRef.current !== 'playing' ||
        !loaded ||
        airborne ||
        deathTimer > 0
      ) {
        return;
      }
      attackHeld = true;
      playAnim('attack', true);
      soundRef.current?.shootThenReload(reloadCueDelay);
      spawnShot();
    }

    /** F key: launch a rocket bomb from the gun nozzle (one per press). */
    function actionRocket() {
      if (
        driving ||
        phaseRef.current !== 'playing' ||
        !loaded ||
        airborne ||
        deathTimer > 0
      ) {
        return;
      }
      playAnim('attack', true);
      soundRef.current?.shootThenReload(reloadCueDelay);
      spawnRocket();
    }

    // ========== one shot = bullet out of the gun nozzle + muzzle VFX ========
    // Fired at the exact moment an attack clip (re)starts — the same instant
    // the shot cue plays — so the round always leaves the barrel in sync.
    // Muzzle position: the active weapon mesh's world bbox, pushed to its
    // front face along the character's facing direction (sin/cos of yaw).
    const shotBox = new THREE.Box3();
    const shotForward = new THREE.Vector3();
    const shotCenter = new THREE.Vector3();
    const shotSize = new THREE.Vector3();
    const shotMuzzle = new THREE.Vector3();

    /** Nozzle world position for the active gun weapon (null when the
     *  current weapon has no muzzle — Blade / Unarmed). */
    function muzzleWorld(out: THREE.Vector3): THREE.Vector3 | null {
      if (!isGunWeapon(weaponIndex)) return null; // Blade / Unarmed: no muzzle
      const weapon = character.weapons[weaponIndex] ?? character.meshWeapon;
      if (!weapon) return null;
      weapon.updateWorldMatrix(true, false);
      shotBox.setFromObject(weapon);
      const forward = shotForward.set(Math.sin(yaw), 0, Math.cos(yaw));
      shotBox.getSize(shotSize);
      shotBox.getCenter(shotCenter);
      const halfAlongFacing =
        (Math.abs(forward.x) * shotSize.x + Math.abs(forward.z) * shotSize.z) /
        2;
      return out.copy(shotCenter).addScaledVector(forward, halfAlongFacing + 3);
    }

    function spawnShot() {
      const muzzle = muzzleWorld(shotMuzzle);
      if (!muzzle) return;
      bullets.fireFrom(muzzle.clone(), shotForward.clone().normalize());
    }

    /** F key: the converted bullet — a big ROCKET BOMB. NEVER fails to fire:
     *  uses the active weapon's muzzle (gun OR the held blade's tip) and, if
     *  even that is missing (Unarmed), launches from the character's
     *  shoulder along their facing — so pressing F always shows the rocket. */
    function spawnRocket() {
      let muzzle = muzzleWorld(shotMuzzle);
      if (!muzzle) {
        // no gun: try the held weapon mesh's bbox anyway (e.g. the Blade)
        const held = character.weapons[weaponIndex] ?? character.meshWeapon;
        const forward = shotForward.set(Math.sin(yaw), 0, Math.cos(yaw));
        if (held) {
          held.updateWorldMatrix(true, false);
          shotBox.setFromObject(held);
          shotBox.getSize(shotSize);
          shotBox.getCenter(shotCenter);
          const half =
            (Math.abs(forward.x) * shotSize.x +
              Math.abs(forward.z) * shotSize.z) /
            2;
          muzzle = shotMuzzle
            .copy(shotCenter)
            .addScaledVector(forward, half + 10);
        } else {
          muzzle = shotMuzzle
            .copy(pos)
            .addScaledVector(forward, 46)
            .setY(pos.y + 90);
        }
      }
      bullets.fireRocket(muzzle.clone(), shotForward.clone().normalize());
    }

    function actionJump() {
      if (
        driving ||
        phaseRef.current !== 'playing' ||
        !loaded ||
        airborne ||
        deathTimer > 0
      ) {
        return;
      }
      airborne = true;
      vy = JUMP_SPEED;
      playAnim('jump', true);
      soundRef.current?.jump();
    }

    function actionRoar() {
      if (
        phaseRef.current !== 'playing' ||
        !loaded ||
        airborne ||
        deathTimer > 0
      ) {
        return;
      }
      playAnim('flip', true);
      soundRef.current?.roar(flipCueDuration);
    }

    apiRef.current = {
      setSkin: applySkin,
      setWeapon: applyWeapon,
      applyDamage,
      respawn,
      droneDirective: (kind) => {
        const nowS = performance.now() / 1000;
        const dronePos = petDrone.group.position;
        switch (kind) {
          case 'COME':
            droneAi.setDirective({ kind: 'COME' }, nowS, pos, dronePos);
            break;
          case 'PATROL':
            droneAi.setDirective({ kind: 'PATROL' }, nowS, pos, dronePos);
            break;
          case 'GUARD':
            droneAi.setDirective({ kind: 'GUARD' }, nowS, pos, dronePos);
            break;
          case 'HOLD':
            droneAi.setDirective({ kind: 'HOLD' }, nowS, pos, dronePos);
            break;
          case 'CEASEFIRE':
            droneAi.setDirective({ kind: 'CEASEFIRE' }, nowS, pos, dronePos);
            break;
        }
      },
    };
    (window as unknown as { __gameApi?: GameApi }).__gameApi = apiRef.current;

    // Imperative handle for the mobile touch controls (rendered only on
    // touch devices). Also on window as __touchApi for tooling/verification.
    touchApiRef.current = {
      move: (x, y) => {
        if (phaseRef.current !== 'playing') return;
        touchMoveVec.x = x;
        touchMoveVec.y = y;
        touchMoveVec.active = true;
      },
      moveEnd: () => {
        touchMoveVec.x = 0;
        touchMoveVec.y = 0;
        touchMoveVec.active = false;
      },
      fireDown: () => actionFire(),
      fireUp: () => {
        attackHeld = false;
      },
      jump: () => actionJump(),
      roar: () => actionRoar(),
      setRun: (on) => {
        sprintMode = on;
      },
      cycleWeapon: () => {
        if (loaded && phaseRef.current === 'playing') {
          applyWeapon(weaponIndex + 1);
        }
      },
      cycleSkin: (dir) => {
        if (loaded && phaseRef.current === 'playing') {
          applySkin(skinIndex + dir);
        }
      },
      exitToLobby: () => {
        if (phaseRef.current === 'playing' && deathTimer <= 0) {
          hudBridgeRef.current.enterLobby?.();
        }
      },
      enterVehicle: () => {
        if (driving) {
          exitJeep();
        } else if (nearJeep) {
          enterJeep();
        }
      },
      droneGunDown: () => {
        droneGunHeld = true;
      },
      droneGunUp: () => {
        droneGunHeld = false;
      },
      droneMissile: () => {
        if (phaseRef.current === 'playing' && deathTimer <= 0) {
          petDrone.launchMissile(droneAim);
        }
      },
    };
    (window as unknown as { __touchApi?: TouchGameApi }).__touchApi =
      touchApiRef.current;

    // ========= BUZZ VOICE LINK — "say it, BUZZ does it" =========
    // Continuous ears: the mic streams through an adaptive energy VAD;
    // each spoken segment is WAV-encoded and posted to /api/voice/asr
    // (speech → text), the text goes to /api/voice/command (the LLM
    // understands it and answers with ONE order — or a CHAIN for
    // "come here then attack" — plus a radio reply) and
    // applyVoiceCommand() executes those orders on the drone brain.
    // BUZZ's reply is also SPOKEN OUT LOUD through /api/voice/tts with a
    // band-pass radio filter. V / the mic button toggle the ears;
    // __voice.inject(text) feeds a transcript straight into the command
    // brain (debug/testing path, no mic needed).
    let voiceState: 'off' | 'listening' | 'thinking' = 'off';
    let voiceHeard = 'Press V to talk — or type to BUZZ';
    let voiceReply = '';
    let lastVoiceState = '';
    let lastVoiceHeard = '\u0000';
    let lastVoiceReply = '\u0000';
    let lastVoiceLevel = -1; // cached meter fill (skip identical writes)
    /** Scratch for camera-direction probes (SCOUT relative orders). */
    const voiceDirTmp = new THREE.Vector3();
    /** Scratch aim for immediate FIRE orders. */
    const voiceAimTmp = new THREE.Vector3();
    /** BUZZ speed estimate for the chat brain: last sampled drone position
     *  + timestamp (telemetry is built once per spoken command). */
    const voiceVelPos = new THREE.Vector3();
    let voiceVelT = -1;
    /** Game-unit → radio-meter conversion (the HUD's convention). */
    const toM = (u: number): number => Math.round(u * 0.09);

    /** Execute one parsed voice order on the drone brain (droneAi.ts). */
    function applyVoiceCommand(cmd: VoiceCommand): void {
      const nowS = performance.now() / 1000;
      const p = cmd.params as {
        dir?: string;
        weapon?: string;
        dist?: number;
        fast?: boolean;
      };
      const playerPos = pos;
      const dronePos = petDrone.group.position;
      switch (cmd.intent) {
        case 'come':
          droneAi.setDirective({ kind: 'COME' }, nowS, playerPos, dronePos);
          break;
        case 'follow':
        case 'patrol':
          droneAi.setDirective({ kind: 'PATROL' }, nowS, playerPos, dronePos);
          break;
        case 'hold':
          droneAi.setDirective({ kind: 'HOLD' }, nowS, playerPos, dronePos);
          break;
        case 'guard':
          droneAi.setDirective({ kind: 'GUARD' }, nowS, playerPos, dronePos);
          break;
        case 'ceasefire':
          droneAi.setDirective({ kind: 'CEASEFIRE' }, nowS, playerPos, dronePos);
          break;
        case 'orbit':
          // fast rate = the "spin/dance for me" trick lap
          droneAi.setDirective(
            { kind: 'ORBIT', rate: p.fast ? 2.35 : undefined },
            nowS,
            playerPos,
            dronePos
          );
          break;
        case 'rise':
          droneAi.setDirective({ kind: 'RISE' }, nowS, playerPos, dronePos);
          break;
        case 'descend':
          droneAi.setDirective({ kind: 'DESCEND' }, nowS, playerPos, dronePos);
          break;
        case 'scout': {
          // direction is relative to the CAMERA — works on foot AND driving
          camera.getWorldDirection(voiceDirTmp);
          let dx = voiceDirTmp.x;
          let dz = voiceDirTmp.z;
          const len = Math.hypot(dx, dz) || 1;
          dx /= len;
          dz /= len;
          if (p.dir === 'left') {
            const t = dx;
            dx = dz;
            dz = -t;
          } else if (p.dir === 'right') {
            const t = dx;
            dx = -dz;
            dz = t;
          } else if (p.dir === 'back') {
            dx = -dx;
            dz = -dz;
          }
          droneAi.setDirective(
            {
              kind: 'SCOUT',
              dirX: dx,
              dirZ: dz,
              dist: typeof p.dist === 'number' ? p.dist : undefined,
            },
            nowS,
            playerPos,
            dronePos
          );
          break;
        }
        case 'attack': {
          const weapon =
            p.weapon === 'gun' || p.weapon === 'rockets' ? p.weapon : 'any';
          droneAi.setDirective(
            { kind: 'ATTACK', weapon },
            nowS,
            playerPos,
            dronePos
          );
          break;
        }
        case 'fire': {
          // immediate shot, no maneuvering: a HOMING rocket onto the
          // nearest threat when a tube is loaded, else the chin gun;
          // with no threats the rocket lands on the facing ground point
          const tgt = threats.nearestAlive(petDrone.group.position, 1300);
          if (tgt) voiceAimTmp.set(tgt.pos.x, tgt.topY, tgt.pos.z);
          if (p.weapon === 'gun') {
            petDrone.fireGun(tgt ? voiceAimTmp : droneAim);
          } else if (petDrone.missilesLoaded() > 0) {
            const launched = tgt
              ? petDrone.launchMissile(voiceAimTmp, {
                  tracker: makeThreatTracker(tgt.id),
                })
              : petDrone.launchMissile(droneAim);
            if (!launched) petDrone.fireGun(tgt ? voiceAimTmp : droneAim);
          } else {
            // tubes dry → the gun still answers
            petDrone.fireGun(tgt ? voiceAimTmp : droneAim);
          }
          break;
        }
        case 'resupply':
          petDrone.resupply(); // wing pods visibly re-arm
          break;
        case 'status':
          // the chat brain now OWNS the spoken status — its reply carries
          // the full picture from live telemetry (hull/fuel, rockets, mode,
          // position, targets), so no chip-style override here anymore
          break;
        default:
          break; // greet / chat / report / speak / unknown — the reply already
          // carries BUZZ's line
      }
    }

    // ----- BUZZ TALKS: fetch TTS for a reply line and play it through a
    // band-pass "radio" filter; silent no-op on mute or any failure (the
    // HUD chip always shows the line either way). One line at a time. ----
    let radioCtx: AudioContext | null = null;
    let radioBusy = false;
    async function speakReply(text: string): Promise<void> {
      if (!text || radioBusy) return;
      if (soundRef.current?.isMuted()) return;
      try {
        const res = await fetch('/api/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) return;
        const raw = await res.arrayBuffer();
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AC) return;
        if (!radioCtx) radioCtx = new AC();
        if (radioCtx.state === 'suspended')
          await radioCtx.resume().catch(() => undefined);
        const decoded = await radioCtx.decodeAudioData(raw);
        radioBusy = true;
        // ECHO GUARD: this line is about to come out of the speakers —
        // shut the mic's VAD gate for the clip's duration (+0.9s tail) so
        // BUZZ never hears himself and answers his own voice in a loop
        voice.inhibit(decoded.duration + 0.9);
        const src = radioCtx.createBufferSource();
        src.buffer = decoded;
        // radio color, tuned for BUZZ's DEEP MALE voice (F0 ≈ 122 Hz):
        // keep the low body a 320 Hz highpass would strip away, center the
        // band on the low mids — still reads as comms audio, but male
        const hp = radioCtx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 170;
        const bp = radioCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 950;
        bp.Q.value = 0.5;
        const gain = radioCtx.createGain();
        gain.gain.value = 0.9;
        src.connect(hp);
        hp.connect(bp);
        bp.connect(gain);
        gain.connect(radioCtx.destination);
        src.onended = () => {
          radioBusy = false;
        };
        src.start();
      } catch {
        radioBusy = false; // text chip already carries the line
      }
    }

    const voice = createVoiceControl({
      onState: (s) => {
        voiceState = s;
        setVoiceOn(s !== 'off');
      },
      onSpeechStart: () => {
        // INSTANT feedback while the audio is still being captured —
        // the player sees the ears caught the words long before ASR ends
        voiceHeard = 'Hearing you…';
      },
      onHeard: (t) => {
        voiceHeard = `You: "${t}"`;
      },
      onReply: (t, cmd) => {
        voiceReply = t;
        // LOOP BREAKER: a pure "unknown" answer (the brain could not map
        // what it heard — usually BUZZ's own echo or room noise) is shown
        // in the chip but NEVER spoken. Speaking it is what fed the old
        // endless "say again — did not copy" self-hearing loop.
        const effective =
          cmd.commands && cmd.commands.length > 0 ? cmd.commands : [cmd];
        if (!effective.every((c) => c.intent === 'unknown')) {
          void speakReply(t); // BUZZ answers out loud too
        }
      },
      onError: (m) => {
        voiceReply = m;
      },
      onCommand: (cmd) => {
        // the brain may answer with a CHAIN ("come here then attack") —
        // execute every order in order
        const chain = cmd.commands;
        if (chain && chain.length > 0) {
          for (const c of chain) applyVoiceCommand(c);
        } else {
          applyVoiceCommand(cmd);
        }
      },
      buildContext: () => {
        // FULL drone telemetry — the chat brain answers ANY question about
        // BUZZ from this ("how much fuel do you have", "where are you",
        // "how many enemies", "what zone is this"), so hand it everything:
        // identity, mode, hull/fuel, ammo, position, speed, sensors, the
        // player and the world around them.
        const st = droneAi.snapshot();
        const dronePos = petDrone.group.position;
        const nowMs = performance.now();
        let speedMps = 0;
        if (voiceVelT > 0) {
          const dtS = (nowMs - voiceVelT) / 1000;
          if (dtS > 0.05) {
            speedMps = toM(voiceVelPos.distanceTo(dronePos)) / dtS;
          }
        }
        voiceVelPos.copy(dronePos);
        voiceVelT = nowMs;
        const altAgl = Math.max(
          0,
          toM(dronePos.y - surfaceYAt(dronePos.x, dronePos.z))
        );
        const nearTgt = threats.nearestAlive(dronePos, 1500);
        const weather =
          rainIntensity > 0.15
            ? 'rain'
            : volcanoIntensity > 0.4
              ? 'volcano ash'
              : mesaIntensity > 0.4
                ? 'badlands haze'
                : redIntensity > 0.4
                  ? 'red-desert heat'
                  : desertIntensity > 0.4
                    ? 'desert'
                    : winterFxVal > 0.4
                      ? 'snow'
                      : iceFxVal > 0.4
                        ? 'ice'
                        : 'clear';
        return {
          drone: {
            callsign: 'BUZZ',
            model: 'AH-9 combat quadcopter gunship',
            role: 'autonomous escort + close air support',
            mode: st.state, // PATROL | ENGAGE | RTB
            currentOrder: st.directive ?? 'autonomous escort',
            combatPhase: st.phase, // move | fire
            queuedOrders: st.queued,
            hullPercent: Math.round(buzzHull),
            // hull IS the fuel/battery gauge on this airframe — one readout
            fuelPercent: Math.round(buzzHull),
            hullWord:
              buzzHull >= 70 ? 'green' : buzzHull >= 30 ? 'amber' : 'red',
            rocketsLoaded: petDrone.missilesLoaded(),
            gunReady: true,
            secondsToNextRocket: st.nextMissileIn,
            distanceToPlayerM: toM(dronePos.distanceTo(pos)),
            altitudeAboveGroundM: altAgl,
            speedMps: Math.round(speedMps),
            sensorRangeM: toM(1500),
            maxRangeFromPlayerM: toM(2400),
          },
          player: {
            healthPercent: Math.round((health / MAX_HEALTH) * 100),
            zone: currentZoneId,
            drivingJeep: driving,
          },
          world: {
            targetsAlive: threatStats.alive,
            nearestTargetM: nearTgt
              ? toM(nearTgt.pos.distanceTo(dronePos))
              : null,
            nearestTargetIsAir: nearTgt ? nearTgt.air : null,
            weather,
            timeOfDay: timeHour.toFixed(1),
          },
        };
      },
    });
    voiceToggleRef.current = () => {
      if (phaseRef.current === 'playing') voice.toggle();
    };
    // typed chat — same brain, no mic needed (works even with the ears off)
    voiceInjectRef.current = (t: string) => {
      if (phaseRef.current === 'playing') void voice.inject(t);
    };
    (window as unknown as { __voice?: object }).__voice = {
      toggle: () => voiceToggleRef.current?.(),
      inject: (t: string) => voice.inject(t),
      status: () => voice.status(),
      meter: () => voice.meter(),
      say: (t: string) => speakReply(t),
    };

    // ================= input =================
    const keys = new Set<string>();

    /** Normalize to a stable code; falls back to event.key when code is empty
     *  (some automation tools and non-standard keyboards send no code). */
    function resolveCode(event: KeyboardEvent): string {
      if (event.code) return event.code;
      const key = event.key.toLowerCase();
      switch (key) {
        case 'w':
          return 'KeyW';
        case 'a':
          return 'KeyA';
        case 's':
          return 'KeyS';
        case 'd':
          return 'KeyD';
        case 'arrowup':
          return 'ArrowUp';
        case 'arrowdown':
          return 'ArrowDown';
        case 'arrowleft':
          return 'ArrowLeft';
        case 'arrowright':
          return 'ArrowRight';
        case ' ':
          return 'Space';
        case 'f':
          return 'KeyF';
        case 'g':
          return 'KeyG';
        case 'h':
          return 'KeyH';
        case 'v':
          return 'KeyV';
        case 'q':
          return 'KeyQ';
        case 'e':
          return 'KeyE';
        case 'x':
          return 'KeyX';
        case 'escape':
          return 'Escape';
        default:
          return /^[1-5]$/.test(key) ? 'Digit' + key : '';
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      // typing in a HUD field (typed chat to BUZZ) is NEVER gameplay —
      // "v", "wasd", space etc. while writing a message must not fire
      // game keys or toggle the mic
      const tgt = event.target as HTMLElement | null;
      if (
        tgt &&
        (tgt.tagName === 'INPUT' ||
          tgt.tagName === 'TEXTAREA' ||
          tgt.isContentEditable)
      ) {
        return;
      }
      const code = resolveCode(event);
      if (!code) return;

      if (code === 'Escape') {
        // Esc returns to the lobby (disabled during the death sequence)
        if (
          !event.repeat &&
          phaseRef.current === 'playing' &&
          deathTimer <= 0
        ) {
          hudBridgeRef.current.enterLobby?.();
        }
        return;
      }

      // all gameplay input is ignored while the lobby is showing
      if (phaseRef.current !== 'playing') return;

      if (
        code === 'Space' ||
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight'
      ) {
        event.preventDefault();
      }

      if (code === 'KeyQ' && !event.repeat && loaded && !driving) {
        applySkin(skinIndex - 1);
      } else if (code === 'KeyE' && !event.repeat && loaded) {
        // near the jeep E mounts it; while mounted E steps out; farther
        // away it keeps cycling skins exactly as before
        if (driving) {
          exitJeep();
        } else if (nearJeep) {
          enterJeep();
        } else {
          applySkin(skinIndex + 1);
        }
      } else if (code === 'KeyX' && !event.repeat && loaded && !driving) {
        applyWeapon(weaponIndex + 1);
      } else if (code === 'Space') {
        // the uploaded jump SFX plays with every real jump (same gate as the
        // jump animation: grounded, alive, not repeated keydown). While
        // driving, Space is the handbrake and still lands in `keys`.
        if (!event.repeat && !driving) actionJump();
      } else if (code === 'KeyF') {
        // F = ROCKET BOMB: one big finned rocket out of the nozzle per press
        // (launch flash, flame + smoke trail, huge detonation). The classic
        // gun stays on the touch HUD's fire button.
        if (!event.repeat && !driving) actionRocket();
      } else if (code === 'KeyH' && !event.repeat) {
        // H = BUZZ airstrike: the pet drone drops one of its wing-pod
        // missiles onto the ground point you're facing (works on foot AND
        // while driving — air support never leaves you)
        if (deathTimer <= 0) petDrone.launchMissile(droneAim);
      } else if (code === 'KeyV' && !event.repeat) {
        // V = BUZZ VOICE LINK: toggle the always-on ears (mic on/off);
        // what you say is understood by the LLM command brain and flown
        // by the drone (see the VOICE LINK block above)
        voiceToggleRef.current?.();
      } else if (code === 'Digit5' || code === 'Numpad5') {
        // the monster roar rides WITH the flip animation and is trimmed to
        // the clip's measured length so it ends exactly when the flip does
        if (!event.repeat && !driving) actionRoar();
      } else if (
        ACTION_KEYS[code] &&
        !event.repeat &&
        loaded &&
        !airborne &&
        !driving &&
        deathTimer <= 0
      ) {
        playAnim(ACTION_KEYS[code], true);
      }

      if (code === 'KeyM' && !event.repeat) toggleMute();

      keys.add(code);
    }

    function onKeyUp(event: KeyboardEvent) {
      const code = resolveCode(event);
      if (code === 'KeyF') attackHeld = false;
      if (code) keys.delete(code);
    }

    function onBlur() {
      keys.clear();
      attackHeld = false;
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    // ================= running sound (GRASS surface) =================
    // The grass-land half of the two-surface footstep pair: loops while the
    // character actually walks or runs on GREEN ground (moving + grounded);
    // pauses on idle, jumps, one-shot emotes, death, lobby and driving, and
    // its volume fades OUT across the snow line (mirrored by the snow-walk
    // crunch fading IN) so deep snow never mixes forest steps with crunch.
    const runSound = new Audio('/sounds/running-forest.wav');
    runSound.loop = true;
    runSound.volume = RUN_SOUND_VOLUME;
    runSound.preload = 'auto';
    let runSoundActive = false;

    function setRunSound(active: boolean) {
      if (active === runSoundActive) return;
      runSoundActive = active;

      if (active) {
        runSound.currentTime = 0;
        runSound.play().catch(() => {
          // Autoplay is rejected until the first user gesture; clear the flag
          // so the loop retries automatically on later frames.
          runSoundActive = false;
        });
      } else {
        runSound.pause();
      }
    }

    // ================= snow-walk sound =================
    // The user-provided snow crunch: loops only while the character
    // actually walks or runs OVER SNOW — the winter-biome factor under the
    // boots scales the volume (fade-in across the soft snow line), and it
    // pauses on idle, jumps, lobby, driving and death. The mute toggle
    // silences it exactly like the running loop.
    const snowWalkSound = new Audio(SNOW_WALK_SFX);
    snowWalkSound.loop = true;
    snowWalkSound.volume = 0;
    snowWalkSound.preload = 'auto';
    let snowWalkSoundActive = false;

    function setSnowWalkSound(active: boolean) {
      if (active === snowWalkSoundActive) return;
      snowWalkSoundActive = active;

      if (active) {
        // resume the loop where it left off — no jarring restart on brief
        // grass <-> snow flickers at the biome border
        snowWalkSound.play().catch(() => {
          // Autoplay is rejected until the first user gesture; clear the
          // flag so the loop retries automatically on later frames.
          snowWalkSoundActive = false;
        });
      } else {
        snowWalkSound.pause();
      }
    }

    // ================= tire-screech sound =================
    // The user-provided tyre screech: loops ONLY while the jeep is actually
    // sliding — the very same `drifting` state that draws the skid marks
    // and tire smoke (sudden turns / Space-handbrake slides above the
    // grip threshold: speed > 110 and sideways slip > 60 u/s). The mute
    // toggle silences it exactly like the running loop.
    const screechSound = new Audio(TIRE_SCREECH_SFX);
    screechSound.loop = true;
    screechSound.volume = 0;
    screechSound.preload = 'auto';
    let screechSoundActive = false;

    function setScreechSound(active: boolean) {
      if (active === screechSoundActive) return;
      screechSoundActive = active;

      if (active) {
        // resume where it left off — a long drift that briefly regains
        // grip (hysteresis) continues the same screech instead of a restart
        screechSound.play().catch(() => {
          // Autoplay is rejected until the first user gesture; clear the
          // flag so the loop retries automatically on later frames.
          screechSoundActive = false;
        });
      } else {
        screechSound.pause();
      }
    }

    // ================= debug handle (invisible) =================
    const debug: PlayerDebugInfo = {
      loaded: false,
      animation: 'stand',
      moving: false,
      airborne: false,
      x: 0,
      y: 0,
      z: 0,
      charMinY: 0,
      charMaxY: 0,
      timeOfDay: DAY_START_HOUR,
      stamina: MAX_STAMINA,
      exhausted: false,
      sprint: false,
      touchMove: false,
      phase: 'lobby',
    };
    (window as unknown as { __player?: PlayerDebugInfo }).__player = debug;
    (window as unknown as { __runSound?: HTMLAudioElement }).__runSound =
      runSound;
    (window as unknown as {
      __snowWalkSound?: HTMLAudioElement;
    }).__snowWalkSound = snowWalkSound;
    (window as unknown as {
      __tireScreech?: HTMLAudioElement;
    }).__tireScreech = screechSound;
    (window as unknown as {
      __dayNight?: {
        hour(): number;
        setHour(hour: number): void;
        sunHeight(): number;
        sunDir(): number[];
        moonDir(): number[];
        aim(dx: number, dy: number, dz: number): void;
      };
    }).__dayNight = {
      hour: () => timeHour,
      setHour: (hour: number) => {
        timeHour = ((hour % 24) + 24) % 24;
      },
      sunHeight: () => sunDir.y,
      sunDir: () => {
        updateSunMoonDirections();
        return sunDir.toArray();
      },
      moonDir: () => {
        updateSunMoonDirections();
        return moonDir.toArray();
      },
      // point the orbit camera along a world-space direction (debug/verification)
      aim: (dx: number, dy: number, dz: number) => {
        const horiz = Math.sqrt(dx * dx + dz * dz) || 1e-6;
        camYawOffset = Math.atan2(dx, dz) - yaw;
        camPitch = THREE.MathUtils.clamp(
          -Math.atan2(dy, horiz),
          CAM_MIN_PITCH,
          CAM_MAX_PITCH
        );
        camIgnoreClearance = true;
        updateCamera(true, 0);
      },
    };

    // ================= renderer =================
    // THE mobile hang fix: full devicePixelRatio (3x on phones) + MSAA is a
    // brutal fill-rate bill, so LOW_SPEC drops antialias and caps the render
    // scale at 1.5 — at arm's length the extra pixels were never visible;
    // desktop keeps the crisp 2x + MSAA look either way.
    renderer = new THREE.WebGLRenderer({
      antialias: !LOW_SPEC,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        LOW_SPEC ? LOW_DPR_CAP : HIGH_DPR_CAP
      )
    );
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);

    // performance surface for tooling / verification (window.__perf)
    (window as unknown as { __perf?: object }).__perf = {
      lowSpec: LOW_SPEC,
      dpr: window.devicePixelRatio,
      pixelRatio: renderer.getPixelRatio(),
      antialias: !LOW_SPEC,
      shadowMapSize: LOW_SPEC ? 1024 : 2048,
      frameCapFps: LOW_SPEC ? 30 : 0,
      farDrops: rain.counts.far,
      cloudsQuality: LOW_SPEC ? 'low' : 'high',
      triangles: () => renderer.info.render.triangles,
      drawCalls: () => renderer.info.render.calls,
    };

    // ================= GPGPU birds (three.js webgl_gpgpu_birds_gltf) =================
    // Parrot loners: rare birds on fast straight courses roaming the whole
    // 12,800-unit map at altitude 2000 (26 drawn of 1024 simulated, 2.5%).
    // Exposes window.__parrots = { ready, simulated, rendered }.
    // (The flamingo V-formation squadron was removed per request.)
    const parrots: BirdFlock = createBirdFlock(scene, renderer);

    // place camera behind the character right away
    const camDesired = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();

    // --- mouse-controlled orbit / zoom state ---
    let camYawOffset = 0; // orbit angle around the character (rad)
    let camPitch = LOBBY_PITCH; // starts in the lobby showcase framing
    let camDist = LOBBY_DIST;
    let camDistTarget = LOBBY_DIST;
    let orbitDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    // --- lobby <-> gameplay camera blending ---
    // 1 = lobby showcase (camera in front of the character), 0 = gameplay
    // rig (camera behind). START tweens this to 0, sweeping the camera
    // around the character instead of hard cutting.
    let lobbyBlend = 1;
    let lastPhase: GamePhase = phaseRef.current;
    /** Debug aim() bypasses the terrain-clearance clamp so the camera can
     *  look up at the sky across hills; reset on every phase change. */
    let camIgnoreClearance = false;

    /** Active pointers on the canvas — one finger orbits, two fingers
     *  pinch-zoom (the touch counterpart of the mouse wheel). */
    const activePointers = new Map<number, { x: number; y: number }>();
    let pinchLastDist = 0;

    function onPointerDown(event: PointerEvent) {
      activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      if (activePointers.size === 1) {
        orbitDragging = true;
        lastPointerX = event.clientX;
        lastPointerY = event.clientY;
        try {
          renderer.domElement.setPointerCapture(event.pointerId);
        } catch {
          // stale/synthetic pointer ids can't be captured; orbit still works
        }
        renderer.domElement.style.cursor = 'grabbing';
      } else {
        // second finger: orbit hands over to pinch zoom
        orbitDragging = false;
        const points = [...activePointers.values()];
        pinchLastDist = Math.hypot(
          points[0].x - points[1].x,
          points[0].y - points[1].y
        );
      }
    }

    function onPointerMove(event: PointerEvent) {
      if (!activePointers.has(event.pointerId)) return;
      activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      // --- pinch zoom (two fingers) ---
      if (activePointers.size >= 2) {
        const points = [...activePointers.values()];
        const dist = Math.hypot(
          points[0].x - points[1].x,
          points[0].y - points[1].y
        );
        if (pinchLastDist > 0 && phaseRef.current === 'playing' && dist > 0) {
          camDistTarget = Math.min(
            CAM_MAX_DIST,
            Math.max(
              CAM_MIN_DIST,
              camDistTarget + (pinchLastDist - dist) * 1.4
            )
          );
        }
        pinchLastDist = dist;
        return;
      }

      // --- single-pointer orbit ---
      if (!orbitDragging) return;

      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;

      // in the lobby the drag spins the character's showcase turntable
      if (phaseRef.current === 'lobby') {
        yaw -= dx * 0.008;
        return;
      }

      camYawOffset -= dx * 0.005;
      camPitch = Math.min(
        CAM_MAX_PITCH,
        Math.max(CAM_MIN_PITCH, camPitch + dy * 0.005)
      );
    }

    function onPointerUp(event: PointerEvent) {
      activePointers.delete(event.pointerId);
      if (activePointers.size < 2) pinchLastDist = 0;

      if (activePointers.size === 1) {
        // one finger remains after a pinch: resume orbiting from its spot
        const [remaining] = [...activePointers.values()];
        orbitDragging = true;
        lastPointerX = remaining.x;
        lastPointerY = remaining.y;
        return;
      }

      if (activePointers.size === 0) {
        orbitDragging = false;
        renderer.domElement.style.cursor = 'grab';
      }
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      if (phaseRef.current === 'lobby') return; // no zoom in the lobby
      camDistTarget = Math.min(
        CAM_MAX_DIST,
        Math.max(CAM_MIN_DIST, camDistTarget + event.deltaY * 0.5)
      );
    }

    function updateCamera(immediate: boolean, dt: number) {
      // smooth zoom easing
      camDist += (camDistTarget - camDist) * Math.min(1, 10 * dt);

      // Blend the lobby framing (in front of the character, angle + PI) into
      // the gameplay rig (behind, angle + camYawOffset) with smoothstep, so
      // START sweeps the camera around the character instead of cutting.
      const blendT = 1 - lobbyBlend;
      const blendEase = blendT * blendT * (3 - 2 * blendT);
      const angleOffset = Math.PI * (1 - blendEase) + camYawOffset * blendEase;
      const pitch = LOBBY_PITCH + (camPitch - LOBBY_PITCH) * blendEase;
      const dist = LOBBY_DIST + (camDist - LOBBY_DIST) * blendEase;

      const angle = yaw + angleOffset;
      const sinA = Math.sin(angle);
      const cosA = Math.cos(angle);
      const horizontal = dist * Math.cos(pitch);
      const vertical = dist * Math.sin(pitch);

      camDesired.set(
        pos.x - sinA * horizontal,
        pos.y + LOOK_HEIGHT + vertical,
        pos.z - cosA * horizontal
      );

      if (immediate) {
        camera.position.copy(camDesired);
      } else {
        camera.position.lerp(camDesired, 1 - Math.exp(-6 * dt));
      }

      if (!camIgnoreClearance) {
        const minY =
          surfaceYAt(camera.position.x, camera.position.z) + CAM_MIN_CLEARANCE;
        if (camera.position.y < minY) camera.position.y = minY;
      }

      lookTarget.set(pos.x, pos.y + LOOK_HEIGHT, pos.z);
      camera.lookAt(lookTarget);
    }

    // ================= day/night sky driver =================
    // One directional light plays both sun and moon: warm bright daylight,
    // crossfaded through dusk into dim blue moonlight (real shadows in both
    // phases). The sky blends night -> day with an orange horizon band at
    // dawn/dusk; the sun/moon discs and star field re-anchor to the camera
    // every frame. Called once per frame AFTER the camera update.
    const skyColor = new THREE.Color();
    const tmpColorA = new THREE.Color();
    const tmpColorB = new THREE.Color();
    scene.background = skyColor; // mutated in place each frame

    function updateSky(
      dt: number,
      stormIntensity: number,
      winterIntensity: number,
      desertIntensity: number,
      redIntensity: number,
      mesaIntensity: number,
      volcanoIntensity: number,
      volcanoGlow: number
    ) {
      updateSunMoonDirections();

      const sunUp = THREE.MathUtils.smoothstep(sunDir.y, -0.04, 0.16);
      const moonUp = THREE.MathUtils.smoothstep(moonDir.y, -0.04, 0.16);
      // 1 when the sun sits on the horizon (dawn/dusk), 0 at high day/deep night
      const horizonGlow =
        1 - THREE.MathUtils.smoothstep(Math.abs(sunDir.y), 0.02, 0.3);

      // --- directional light: sun by day, moon by night ---
      const wSun = sunUp * sunUp;
      const wMoon = moonUp;
      const wSum = wSun + wMoon;
      const lightDir = wSun >= wMoon ? sunDir : moonDir;
      directionalLight.position
        .copy(pos)
        .addScaledVector(lightDir, SUN_DISTANCE);
      directionalLight.target.position.copy(pos);
      directionalLight.intensity =
        (wSun * SUN_LIGHT_MAX + wMoon * MOON_LIGHT_MAX) *
        (1 - 0.55 * stormIntensity); // storm clouds blot out the light
      if (wSum > 1e-3) {
        tmpColorA
          .copy(SUNLIGHT_LOW)
          .lerp(SUNLIGHT_HIGH, THREE.MathUtils.clamp(sunDir.y / 0.45, 0, 1))
          .multiplyScalar(wSun);
        tmpColorB.copy(MOONLIGHT).multiplyScalar(wMoon);
        tmpColorA.add(tmpColorB).multiplyScalar(1 / wSum);
        directionalLight.color.copy(tmpColorA);
      }

      // --- ambient: dims and cools off at night ---
      ambientLight.color.copy(AMBIENT_NIGHT).lerp(AMBIENT_DAY, sunUp);
      ambientLight.intensity =
        (AMBIENT_NIGHT_I + (AMBIENT_DAY_I - AMBIENT_NIGHT_I) * sunUp) *
        (1 - 0.28 * stormIntensity);

      // --- sky: night -> day, tinted orange around the horizon crossings ---
      skyColor.copy(SKY_NIGHT).lerp(SKY_DAY, sunUp);
      skyColor.lerp(SKY_SUNSET, horizonGlow * (0.3 + 0.5 * sunUp));
      skyColor.lerp(STORM_SKY, 0.55 * stormIntensity); // wet grey ceiling
      // winter biomes bleach the vault toward a pale icy blue (mostly by
      // day — at night the snow just sits under the usual moonlight)
      skyColor.lerp(WINTER_SKY, winterIntensity * 0.5 * (0.25 + 0.75 * sunUp));
      // desert biomes keep the vault BLUE (reference desert: clear sky over
      // the dunes) — just a light dusty haze cast, day-weighted like winter
      skyColor.lerp(DESERT_SKY, desertIntensity * 0.3 * (0.25 + 0.75 * sunUp));
      // red desert: dusty rust haze; badlands: pale warm terracotta vault;
      // volcano: dark smoky ash ceiling that leans even darker at night
      // (the rising embers glow against it)
      skyColor.lerp(RED_SKY, redIntensity * 0.38 * (0.25 + 0.75 * sunUp));
      skyColor.lerp(MESA_SKY, mesaIntensity * 0.3 * (0.25 + 0.75 * sunUp));
      skyColor.lerp(
        VOLCANO_SKY,
        volcanoIntensity * (0.55 + 0.2 * (1 - sunUp))
      );
      // standing near a live crater: the caldera glow breathes a warm
      // ember cast into the vault — strongest at night, when the lava
      // owns the light
      skyColor.lerp(
        EMBER_GLOW_SKY,
        volcanoGlow * (0.32 + 0.4 * (1 - sunUp))
      );

      // --- sun disc: follows the real orbit, warming orange as it sets ---
      sunMesh.position
        .copy(camera.position)
        .addScaledVector(sunDir, SUN_VISUAL_DISTANCE);
      sunMesh.lookAt(camera.position);
      sunMaterial.opacity =
        THREE.MathUtils.smoothstep(sunDir.y, -0.09, 0.03) *
        (1 - 0.85 * stormIntensity);
      sunMaterial.color
        .copy(SUN_TINT_SET)
        .lerp(SUN_TINT_NOON, 1 - horizonGlow * 0.85);

      // --- moon disc: rides the opposite side of the sky ---
      moonMesh.position
        .copy(camera.position)
        .addScaledVector(moonDir, SUN_VISUAL_DISTANCE);
      moonMesh.lookAt(camera.position);
      moonMaterial.opacity =
        THREE.MathUtils.smoothstep(moonDir.y, -0.09, 0.03) *
        (1 - 0.85 * stormIntensity);

      // --- stars: fade in at night, drift very slowly ---
      starsField.position.copy(camera.position);
      starsField.rotation.y += dt * 0.005;
      (starsField.material as THREE.PointsMaterial).opacity =
        moonUp * 0.95 * (1 - stormIntensity);
      (starsBright.material as THREE.PointsMaterial).opacity =
        moonUp * 0.95 * (1 - stormIntensity);

      // --- fog: tint with the sky, thickens at dawn/dusk and in rain ---
      const fog = scene.fog as THREE.FogExp2 | null;
      if (fog) {
        fog.color.copy(skyColor);
        fog.density =
          FOG_DENSITY *
          (1 +
            0.45 * horizonGlow +
            1.15 * stormIntensity +
            0.4 * winterIntensity +
            0.1 * desertIntensity +
            0.2 * redIntensity +
            0.08 * mesaIntensity +
            0.55 * volcanoIntensity +
            0.3 * volcanoGlow);
      }

      // --- clouds: drift + structure morph + day/night tint ---
      clouds.update({
        dt,
        cameraPos: camera.position,
        skyColor,
        lightDir, // rim shading follows the active sun/moon light
        sunUp,
        horizonGlow,
        lightColor: directionalLight.color,
        storm: stormIntensity, // rain cells darken + thicken the deck
        winter: winterIntensity, // frozen biomes bleach the deck icy white
        hot: Math.max(
          desertIntensity,
          redIntensity,
          mesaIntensity
        ), // dusty bake
        ash: volcanoIntensity, // volcano smokes the deck dark
      });
    }

    updateCamera(true, 0);
    updateSky(0, 0, 0, 0, 0, 0, 0, 0);

    renderer.domElement.style.cursor = 'grab';
    // touch screens: the canvas owns its gestures (no browser scroll/pinch
    // interference while dragging the camera)
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener('resize', onWindowResize);

    // ================= animation loop =================
    /** Last frame's rAF timestamp — drives the mobile ~30fps frame cap. */
    let lastRenderTime = 0;

    function animate(time?: DOMHighResTimeStamp) {
      // mobile frame cap: the loop still fires at the display rate but we
      // only render every ~33ms — every skipped beat returns CPU AND GPU
      // time to the phone. Skipped frames are NOT simulated: timer deltas
      // simply bridge the gap, so game time (day cycle, physics, tweens)
      // stays wall-clock exact. Desktop is untouched (uncapped).
      if (LOW_SPEC && time !== undefined) {
        if (lastRenderTime !== 0 && time - lastRenderTime < LOW_FRAME_INTERVAL_MS) {
          return;
        }
        lastRenderTime = time;
      }
      timer.update();
      // real wall seconds (mild cap for tab switches) — resources like
      // stamina use this so they behave identically at ANY framerate
      const wallDt = Math.min(timer.getDelta(), 2);
      // physics/animation delta, clamped so a hitch can't teleport anything
      const dt = Math.min(wallDt, 0.1);
      elapsed += dt;

      // --- lobby <-> gameplay phase transitions ---
      if (phaseRef.current !== lastPhase) {
        lastPhase = phaseRef.current;
        keys.clear();
        touchMoveVec.active = false;
        touchMoveVec.x = 0;
        touchMoveVec.y = 0;

        if (driving) exitJeep(); // leaving gameplay always drops you out
        if (phaseRef.current === 'playing') {
          // deploy: gameplay orbit defaults; the camera sweeps via lobbyBlend
          camYawOffset = 0;
          camPitch = CAM_DEFAULT_PITCH;
          camDistTarget = CAM_DIST;
          camIgnoreClearance = false;
        } else {
          // back to the showcase: hard cut to the frontal framing
          camYawOffset = 0;
          camPitch = LOBBY_PITCH;
          camDistTarget = LOBBY_DIST;
          lobbyBlend = 1;
          setRunSound(false);
          setSnowWalkSound(false);
          oneShot = null;
          attackHeld = false;
        }
      }

      const inLobby = phaseRef.current === 'lobby';

      // lobby turntable: idle character slowly rotates for the showcase
      if (inLobby && deathTimer <= 0) yaw += LOBBY_TURN_SPEED * dt;

      // tween the camera from the lobby framing into the gameplay rig
      if (!inLobby && lobbyBlend > 0) {
        lobbyBlend = Math.max(0, lobbyBlend - dt / LOBBY_BLEND_TIME);
      }

      // --- movement input (keyboard + mobile joystick) ---
      const controlsLocked = deathTimer > 0 || inLobby;
      let moveInput = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) moveInput += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) moveInput -= 1;
      // virtual joystick: analog forward/back while the keys are idle
      if (touchMoveVec.active && moveInput === 0) {
        moveInput = THREE.MathUtils.clamp(touchMoveVec.y, -1, 1);
      }

      let turnInput = controlsLocked
        ? 0
        : (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) -
          (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
      if (!controlsLocked && touchMoveVec.active) {
        turnInput += -touchMoveVec.x; // stick right = turn right
      }

      // driving: the same WASD/joystick input steers the jeep instead of
      // turning the on-foot character; the camera rig orbits pos/yaw, so
      // both are parked onto the vehicle every frame
      if (driving) {
        if (controlsLocked) {
          exitJeep(); // death or lobby while mounted — bail out safely
        } else {
          jeepInput.throttle = moveInput;
          jeepInput.steer = THREE.MathUtils.clamp(turnInput, -1, 1);
          jeepInput.brake = keys.has('Space');
          const st = jeep.updateDrive(dt, jeepInput);
          driveSpeed = st.speed;
          driveDrift = st.drifting;
          pos.set(
            jeep.group.position.x,
            jeep.group.position.y + 24,
            jeep.group.position.z
          );
          yaw = st.heading;
        }
      } else {
        yaw += turnInput * TURN_SPEED * dt;
      }

      const moving = moveInput !== 0 && !controlsLocked && !driving;

      if (moving && loaded) {
        // unlimited sprint: full speed forever, no stamina cost; the mobile
        // RUN toggle pushes past walk speed (the keyboard has no modifier)
        const speed =
          moveInput > 0 ? (sprintMode ? RUN_SPEED : WALK_SPEED) : BACK_SPEED;
        pos.x += Math.sin(yaw) * speed * dt * moveInput;
        pos.z += Math.cos(yaw) * speed * dt * moveInput;
        // no world-edge clamp any more — the terrain streams in forever
      }

      // --- jeep proximity: close enough to grab the wheel with E? ---
      if (!driving) {
        const jdx = jeep.group.position.x - pos.x;
        const jdz = jeep.group.position.z - pos.z;
        nearJeep =
          phaseRef.current === 'playing' &&
          deathTimer <= 0 &&
          jdx * jdx + jdz * jdz < JEEP_ENTER_RANGE * JEEP_ENTER_RANGE;
      }

      // --- static prop collision: the jeep is solid while on foot ---
      // push the player capsule out of the jeep's oriented footprint so it
      // can't be walked through (also resolves being spawned inside it)
      if (!driving) {
        const jeepPush = jeep.collide(pos.x, pos.z, 22);
        if (jeepPush) {
          pos.x = jeepPush.x;
          pos.z = jeepPush.z;
        }
      }

      // --- footstep dust (alternating left/right foot puffs behind) ---
      if (moving && !airborne && deathTimer <= 0) {
        footAccum += dt;
        if (footAccum >= (sprintMode ? 0.21 : 0.28)) {
          footAccum = 0;
          footSide = -footSide; // swap feet every step
          // plant the puff at the foot: one stride back, offset across the
          // view axis to the active foot's side (right vector of yaw)
          const back = sprintMode ? 46 : 38;
          const fx =
            pos.x -
            Math.sin(yaw) * back +
            Math.cos(yaw) * footSide * 14;
          const fz =
            pos.z -
            Math.cos(yaw) * back -
            Math.sin(yaw) * footSide * 14;
          atmos.footstep(fx, surfaceYAt(fx, fz) + 6, fz, sprintMode);
        }
      } else {
        footAccum = 0;
      }

      // --- health regen (after a damage-free grace period) ---
      if (
        deathTimer <= 0 &&
        health < MAX_HEALTH &&
        elapsed - lastDamageAt > HEALTH_REGEN_DELAY
      ) {
        health = Math.min(MAX_HEALTH, health + HEALTH_REGEN_RATE * dt);
      }

      // stream the endless terrain around the traveller: chunks ahead of
      // the movement are meshed, terrain that fell out of sight behind the
      // player is released (both happen inside this single call)
      terrain.update(pos.x, pos.z);

      // --- ground / gravity ---
      const groundY = surfaceYAt(pos.x, pos.z);
      if (driving) {
        // mounted: the jeep already follows the terrain, so there is no
        // falling, jumping or landing while the engine is running
        airborne = false;
        vy = 0;
      } else if (airborne) {
        vy -= GRAVITY * dt;
        pos.y += vy * dt;
        if (pos.y <= groundY) {
          pos.y = groundY;
          const impact = -vy;
          vy = 0;
          airborne = false;

          if (impact > FALL_DAMAGE_MIN_SPEED) {
            applyDamage(
              Math.min(
                MAX_HEALTH,
                (impact - FALL_DAMAGE_MIN_SPEED) * FALL_DAMAGE_SCALE
              )
            );
          }

          // dust burst on every real landing, scaled with the impact speed
          // (falls that hurt also billow more)
          if (impact > 240) {
            atmos.landing(pos.x, pos.y, pos.z, impact);
          }
        }
      } else {
        pos.y += (groundY - pos.y) * Math.min(1, 12 * dt);
      }

      character.root.position.set(pos.x, pos.y + footOffset, pos.z);

      character.root.rotation.y = yaw;

      // advance the in-game clock (full 24h every CYCLE_SECONDS)
      timeHour = (timeHour + (24 / CYCLE_SECONDS) * dt) % 24;

      // --- animation state machine / death sequence ---
      if (deathTimer > 0) {
        deathTimer -= dt;
        if (deathTimer <= 0) respawn();
      } else {
        // hold-to-fire safety net: resume the attack loop after a jump,
        // death or any other interrupt while F is still held
        if (attackHeld && loaded && !airborne && oneShot === null) {
          playAnim('attack', true);
        }
        const desired = oneShot ?? (airborne ? 'jump' : moving ? 'run' : 'stand');
        if (loaded && desired !== currentAnim) {
          playAnim(desired, false);
        }
      }

      character.update(dt);

      // --- camera + sky (sky re-anchors to the final camera position) ---
      updateCamera(false, dt);
      // one shower per in-game day, but WATER RAIN IS GREEN-LAND ONLY:
      // the frozen countries have their own weather (soft snow across the
      // winter biome, harsh sleet on the glacier hearts), so the storm is
      // damped to exactly zero across the biome's soft border and NEVER
      // rains onto snow or ice. The storm CLOUDS still darken the sky
      // everywhere (updateSky keeps the raw front — a grey ceiling over a
      // snowfield with gentle flakes is exactly right); only the
      // precipitation, its audio, its lightning and its puddles are gated.
      const stormIntensity = rainIntensityFromHour(timeHour);
      winterIntensity = winterFactorWorld(pos.x, pos.z, BLOCK, GRID_OFFSET);
      iceIntensity = iceFactorWorld(pos.x, pos.z, BLOCK, GRID_OFFSET);
      desertIntensity = desertFactorWorld(pos.x, pos.z, BLOCK, GRID_OFFSET);
      redIntensity = redFactorWorld(pos.x, pos.z, BLOCK, GRID_OFFSET);
      mesaIntensity = mesaFactorWorld(pos.x, pos.z, BLOCK, GRID_OFFSET);
      volcanoIntensity = volcanoFactorWorld(pos.x, pos.z, BLOCK, GRID_OFFSET);
      // HOT-CLIMATE FEEL GATE: natural snow countries can still roll next
      // to natural hot countries in the far ring (terrain priority keeps
      // the GROUND correct — sand/basalt beat snow) — so the snowfall,
      // icy sky tint, footprints and crunch audio all fade out across the
      // hot border and the climate FEEL always matches the ground too
      const hot = Math.max(
        desertIntensity,
        redIntensity,
        mesaIntensity,
        volcanoIntensity
      );
      const hotKill = 1 - THREE.MathUtils.smoothstep(hot, 0.3, 0.6);
      const winterFx = winterIntensity * hotKill;
      const iceFx = iceIntensity * hotKill;
      winterFxVal = winterFx;
      iceFxVal = iceFx;
      const frozen = Math.max(winterFx, iceFx);
      // full pour on clearly-green ground, faded to exactly zero by the
      // time the ground reads as snow (factor ~0.5), glacier ice — or any
      // of the hot biomes: the dune seas, the badlands and the volcano
      // ash-fields all keep their own dry climates, so storms passing
      // overhead never rain onto them either
      rainIntensity =
        stormIntensity *
        (1 - THREE.MathUtils.smoothstep(frozen, 0.3, 0.6)) *
        (1 - THREE.MathUtils.smoothstep(desertIntensity, 0.3, 0.6)) *
        (1 - THREE.MathUtils.smoothstep(redIntensity, 0.3, 0.6)) *
        (1 - THREE.MathUtils.smoothstep(mesaIntensity, 0.3, 0.6)) *
        (1 - THREE.MathUtils.smoothstep(volcanoIntensity, 0.3, 0.6));
      rain.update(dt, pos, rainIntensity);
      // winter biomes carry their own weather: soft SNOW falls across the
      // whole frozen country (factor fades at the soft border, so the
      // snowfall swells as you cross the snow line), while the harsher ice
      // sleet pours only over the blue glacier hearts inside it
      snowRain.update(dt, pos, winterFx);
      iceRain.update(dt, pos, iceFx);
      // volcano embers + ash plume + the 3D sky zone sign: the ember
      // swarm rises wherever the ash factor says so, the stratovolcano's
      // plume smokes over the nearest crater, and when the player has
      // truly settled into a biome (0.7s stability against border
      // wobble) the sky raises its name in giant block letters
      embers.update(dt, pos, volcanoIntensity);
      plume.update(dt, pos.x, pos.z);
      const vNear = nearestVolcanoWorld(pos.x, pos.z, BLOCK, GRID_OFFSET);
      volcanoGlow = vNear.has ? vNear.glow : 0;
      const zoneId =
        volcanoIntensity > 0.5
          ? 'volcano'
          : mesaIntensity > 0.5
            ? 'badlands'
            : redIntensity > 0.5
              ? 'reddesert'
              : desertIntensity > 0.5
                ? 'desert'
                : winterIntensity > 0.5 || iceIntensity > 0.5
                  ? 'winter'
                  : 'grass';
      if (zoneId !== pendingZoneId) {
        pendingZoneId = zoneId;
        zoneStableT = 0;
      } else if (zoneId !== currentZoneId) {
        zoneStableT += dt;
        if (zoneStableT >= 0.7) {
          currentZoneId = zoneId;
          const sign = ZONE_SIGNS[zoneId];
          if (sign) skyText.show(sign.label, sign.color);
        }
      }
      skyText.update(dt, camera);
      // boot prints in the snow: only while genuinely walking on frozen
      // ground (never airborne, never while driving, never in the lobby) —
      // the system itself re-checks the snow under each individual foot
      footprints.update(
        dt,
        pos.x,
        pos.z,
        yaw,
        winterFx,
        moving && !airborne && deathTimer <= 0 && !controlsLocked,
        sprintMode
      );
      updateSky(
        dt,
        stormIntensity,
        winterFx,
        desertIntensity,
        redIntensity,
        mesaIntensity,
        volcanoIntensity,
        volcanoGlow
      );

      // atmosphere drama: lightning / meteors, driven by
      // the same sky state the renderer just used
      atmos.update(dt, {
        camera,
        playerPos: pos,
        sunDir,
        sunUp: THREE.MathUtils.smoothstep(sunDir.y, -0.04, 0.16),
        moonUp: THREE.MathUtils.smoothstep(moonDir.y, -0.04, 0.16),
        storm: rainIntensity,
      });
      // the same frame's lightning state lights the cloud deck from within
      // (strike-cell bloom + sheet flicker — see skyClouds.applyFlash)
      clouds.applyFlash(atmos.cloudFlash());

      // game audio: rain loop follows the storm, the night wind loop fades in
      // with the moon (same smoothstep as the sky driver's moonUp); the mute
      // toggle also silences the running footsteps (plain HTMLAudioElement)
      const sfx = soundRef.current;
      if (sfx) {
        sfx.setRain(rainIntensity);
        sfx.setNight(THREE.MathUtils.smoothstep(moonDir.y, -0.04, 0.16));
        // TWO surface footsteps, strictly one terrain each — the same
        // winter factor under the boots drives both loops in opposite
        // directions so they crossfade across the soft snow line:
        //   winterIntensity <= 0.3  ->  forest boot-loop only (grass)
        //   winterIntensity >= 0.6  ->  snow crunch only (deep snow)
        //   in between              ->  a short crossfade at the border
        // (0.3 is the same gate the footprint system uses, so steps and
        // sound always agree); the mute toggle silences both loops.
        const snowAudible = THREE.MathUtils.clamp(
          (winterFx - 0.3) / 0.3,
          0,
          1
        );
        const grassAudible = 1 - snowAudible;

        // grass footsteps: full on green ground, faded to silence by the
        // time the ground reads as snow
        const runVol = sfx.isMuted() ? 0 : RUN_SOUND_VOLUME * grassAudible;
        if (runSound.volume !== runVol) runSound.volume = runVol;
        setRunSound(
          loaded &&
            moving &&
            !airborne &&
            deathTimer <= 0 &&
            !controlsLocked &&
            runVol > 0.001
        );

        // snow-walk crunch: the mirrored half — 0 at the soft border, full
        // on deep snow (below the 0.3 gate nothing plays at all)
        const snowVol = sfx.isMuted() ? 0 : SNOW_WALK_VOLUME * snowAudible;
        if (snowWalkSound.volume !== snowVol) snowWalkSound.volume = snowVol;
        setSnowWalkSound(
          loaded &&
            moving &&
            !airborne &&
            deathTimer <= 0 &&
            !controlsLocked &&
            snowVol > 0.001
        );

        // tyre screech: the on/off gate follows the jeep's drift state
        // exactly (skid marks + smoke = audible screech, one source of
        // truth); the mute toggle silences it like every other loop
        const screechVol = sfx.isMuted() ? 0 : TIRE_SCREECH_VOLUME;
        if (screechSound.volume !== screechVol)
          screechSound.volume = screechVol;
        setScreechSound(driving && driveDrift && screechVol > 0.001);
      }
      // puddles GROW slowly while it pours and dry slowly after (sky colour
      // + sun drive their look; fog colour is re-synced inside updateSky)
      const fog = scene.fog as THREE.FogExp2 | null;
      water.update(
        dt,
        rainIntensity,
        fog ? fog.color : SKY_DAY,
        directionalLight,
        pos.x,
        pos.z
      );

      // loot chests: ambient bob + spin everywhere, auto-open only while
      // actually playing (never mid-lobby / mid-death)
      chests.update(
        dt,
        pos.x,
        pos.y,
        pos.z,
        phaseRef.current === 'playing' && deathTimer <= 0
      );

      // --- gpgpu birds: parrot loners (flight box follows the player) ---
      parrots.setCenter(pos.x, pos.y, pos.z);
      parrots.update(dt);

      // --- bullets: fly, spark, smoke ---
      bullets.update(dt, camera);

      // BUZZ weapons: manual aim point = the ground ~430 ahead of the
      // facing (the STRAFE order G key / touch streams the chin gun onto it)
      droneAim.set(
        pos.x + Math.sin(yaw) * 430,
        0,
        pos.z + Math.cos(yaw) * 430
      );
      droneAim.y = surfaceYAt(droneAim.x, droneAim.z);
      // --- BUZZ AUTONOMOUS ENGAGEMENT (droneAi.ts) ---
      // The brain decides everything itself: it scans for the live enemy
      // squad, locks one, flies an attack orbit around it, pivots once
      // parked, bursts the chin gun with lead + spread, RUNS A LOCK and
      // drops a HOMING wing-pod rocket when its own cadence and range
      // gates say so, breaks off after every kill (or when its hull runs
      // low) and always comes home on its own. Manual orders (G held /
      // H tap) override the AI's trigger only — the AI keeps flying.
      const nightF = timeHour < 6.4 || timeHour > 18.6 ? 1 : 0;
      const aiOrder = droneAi.tick({
        dt,
        dronePos: petDrone.group.position,
        droneYaw: petDrone.group.rotation.y,
        playerPos: pos,
        nowS: performance.now() / 1000,
        lastKillAt,
        buzzHull,
        heightAt: surfaceYAt,
        dummies: threats,
      });
      let droneCombatTarget: THREE.Vector3 | null = null;
      if (aiOrder.pivotTo) {
        droneCombatTarget = droneCombatAim.copy(aiOrder.pivotTo);
      }
      if (deathTimer <= 0 && (keys.has('KeyG') || droneGunHeld)) {
        petDrone.fireGun(droneAim); // manual override streams at the facing
      } else if (deathTimer <= 0 && phaseRef.current === 'playing' && loaded) {
        if (aiOrder.missileAim && petDrone.missilesLoaded() > 0) {
          // the launch order carries the target id — the rocket flies
          // HOMING with a live tracker onto whatever the brain designated
          const tid = aiOrder.missileTargetId;
          const tracker = tid === null ? undefined : makeThreatTracker(tid);
          petDrone.launchMissile(
            aiOrder.missileAim,
            tracker ? { tracker } : undefined
          );
        }
        if (aiOrder.fireAim) {
          petDrone.fireGun(aiOrder.fireAim); // rate-limited inside
        }
      }

      // hull: formation time repairs BUZZ; fighting chews it (see onAirHit)
      if (aiOrder.state !== 'ENGAGE') {
        buzzHull = Math.min(100, buzzHull + 9 * dt);
      }

      // pet drone: one tick of the companion brain (spring flight,
      // banking, rotors, lights; headlights fade in with nightFactor).
      // droneCombatTarget makes a parked BUZZ pivot toward its mark and
      // aiOrder.flightOverride flies the attack orbit while engaging —
      // through the exact same spring/heading/banking/terrain-glide code
      // as the formation slot.
      petDrone.update(dt, pos, yaw, {
        night: nightF,
        combatTarget: droneCombatTarget ?? undefined,
        flightOverride:
          deathTimer <= 0 && phaseRef.current === 'playing'
            ? (aiOrder.flightOverride ?? undefined)
            : undefined,
      });

      // jeep exhaust smoke keeps fading even while unmounted
      jeep.updateFx(dt);

      renderer.render(scene, camera);

      // --- debug info ---
      const charBox = new THREE.Box3().setFromObject(character.root);
      debug.loaded = loaded;
      debug.animation = currentAnim;
      debug.moving = moving;
      debug.airborne = airborne;
      debug.x = pos.x;
      debug.y = pos.y;
      debug.z = pos.z;
      debug.charMinY = Math.round(charBox.min.y);
      debug.charMaxY = Math.round(charBox.max.y);
      debug.timeOfDay = timeHour;
      debug.stamina = Math.round(stamina);
      debug.exhausted = false; // stamina system removed: never decreases
      debug.sprint = sprintMode;
      debug.touchMove = touchMoveVec.active;
      debug.phase = phaseRef.current;
      // --- driving HUD: direct DOM writes, no React re-render per frame ---
      if (driveHudRef.current) {
        const mode = driving ? 'drive' : nearJeep ? 'enter' : 'hidden';
        if (mode !== driveHudMode) {
          driveHudMode = mode;
          driveHudRef.current.style.display =
            mode === 'hidden' ? 'none' : 'flex';
          const speedRow = driveSpeedRef.current?.parentElement;
          if (speedRow) {
            speedRow.style.display = mode === 'drive' ? 'flex' : 'none';
          }
          if (driveHudModeRef.current) {
            driveHudModeRef.current.textContent =
              mode === 'drive' ? 'SPACE brake · E step out' : 'PRESS E TO DRIVE';
          }
        }
        if (driving && driveSpeedRef.current) {
          driveSpeedRef.current.textContent = String(
            Math.round(Math.abs(driveSpeed) * 0.09)
          );
        }
      }

      // dragon HUD: health + stamina pushed straight to the DOM every frame
      healthBarRef.current?.update(
        health,
        MAX_HEALTH,
        stamina,
        MAX_STAMINA,
        deathTimer > 0
      );

      // BUZZ AI chip: brain state + hull, direct DOM write with a cached
      // string so identical frames never touch the DOM
      if (droneHudRef.current) {
        const chip = `AI ${aiOrder.state} · HULL ${Math.round(buzzHull)}%`;
        if (chip !== lastDroneHud) {
          lastDroneHud = chip;
          droneHudRef.current.textContent = chip;
        }
      }

      // BUZZ voice-link chip: link state + heard + reply, same cached-
      // string DOM-write pattern (the callbacks only flip plain lets).
      // The state line flips to HEARING YOU the instant the VAD gate
      // opens — visible feedback BEFORE the transcript exists — and the
      // little bar under it is a live mic level (transform-only write).
      if (voiceHudStateRef.current) {
        const st = voice.status();
        const label =
          voiceState === 'thinking'
            ? 'UNDERSTANDING…'
            : voiceState === 'listening' && st.speechOpen
              ? 'HEARING YOU…'
              : voiceState === 'listening'
                ? 'LISTENING · SAY A COMMAND'
                : 'VOICE OFF · PRESS V';
        if (label !== lastVoiceState) {
          lastVoiceState = label;
          voiceHudStateRef.current.textContent = label;
        }
      }
      if (voiceMeterRef.current) {
        const lvl = voice.meter();
        if (Math.abs(lvl - lastVoiceLevel) > 0.02) {
          lastVoiceLevel = lvl;
          voiceMeterRef.current.style.transform = `scaleX(${Math.max(
            0.04,
            lvl
          ).toFixed(3)})`;
        }
      }
      if (voiceHeard !== lastVoiceHeard && voiceHudHeardRef.current) {
        lastVoiceHeard = voiceHeard;
        voiceHudHeardRef.current.textContent = voiceHeard;
      }
      if (voiceReply !== lastVoiceReply && voiceHudReplyRef.current) {
        lastVoiceReply = voiceReply;
        voiceHudReplyRef.current.textContent = voiceReply;
      }

      // minimap: player-centred north-up map pushed every frame (canvas 2D,
      // zero React re-renders — same pattern as the health bar)
      minimapRef.current?.update(pos.x, pos.z, yaw);

      // --- loadout mirror for the LOBBY pickers: publishes on change only.
      //     The in-game view itself is completely UI-free. ---
      if (skinIndex !== publishedSkin || weaponIndex !== publishedWeapon) {
        publishedSkin = skinIndex;
        publishedWeapon = weaponIndex;
        hudBridgeRef.current.publish?.({ skinIndex, weaponIndex });
      }
    }

    renderer.setAnimationLoop(animate);

    // ================= cleanup =================
    return () => {
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);

      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);

      renderer.setAnimationLoop(null);

      setRunSound(false);
      runSound.pause();
      runSound.src = '';
      delete (window as unknown as { __runSound?: HTMLAudioElement }).__runSound;
      setSnowWalkSound(false);
      snowWalkSound.pause();
      snowWalkSound.src = '';
      delete (window as unknown as {
        __snowWalkSound?: HTMLAudioElement;
      }).__snowWalkSound;
      setScreechSound(false);
      screechSound.pause();
      screechSound.src = '';
      delete (window as unknown as {
        __tireScreech?: HTMLAudioElement;
      }).__tireScreech;

      apiRef.current = null;
      delete (window as unknown as { __gameApi?: GameApi }).__gameApi;

      touchApiRef.current = null;
      delete (window as unknown as { __touchApi?: TouchGameApi }).__touchApi;

      voice.dispose();
      voiceToggleRef.current = null;
      voiceInjectRef.current = null;
      delete (window as unknown as { __voice?: object }).__voice;
      if (radioCtx) {
        void radioCtx.close().catch(() => undefined);
        radioCtx = null;
      }

      character.mixer?.stopAllAction();
      const meshes = [character.meshBody, ...character.weapons];
      for (const mesh of meshes) {
        if (!mesh) continue;
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          const lambert = mat as THREE.MeshLambertMaterial;
          lambert.map?.dispose();
          lambert.dispose();
        }
      }
      for (const skin of [...character.skinsBody, ...character.skinsWeapon]) {
        skin.dispose();
      }
      scene.remove(character.root);

      petDrone.dispose();

      terrain.dispose();
      scene.remove(sunMesh);
      sunMesh.geometry.dispose();
      sunMaterial.map?.dispose();
      sunMaterial.dispose();

      scene.remove(moonMesh);
      moonMesh.geometry.dispose();
      moonMaterial.map?.dispose();
      moonMaterial.dispose();

      scene.remove(starsField);
      starsField.geometry.dispose();
      (starsField.material as THREE.PointsMaterial).dispose();
      starsBright.geometry.dispose();
      (starsBright.material as THREE.PointsMaterial).dispose();
      starSprite.dispose();
      timer.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }

      parrots.dispose(); // also removes window.__parrots
      rain.dispose();
      delete (window as unknown as { __rain?: object }).__rain;
      bullets.dispose();
      delete (window as unknown as { __bullets?: object }).__bullets;
      water.dispose();
      delete (window as unknown as { __water?: object }).__water;
      atmos.dispose();
      delete (window as unknown as { __atmos?: object }).__atmos;
      chests.dispose();
      delete (window as unknown as { __chests?: object }).__chests;
      delete (window as unknown as { __cheats?: object }).__cheats;

      embers.dispose();
      delete (window as unknown as { __embers?: object }).__embers;
      plume.dispose();
      skyText.dispose();
      delete (window as unknown as { __zones?: object }).__zones;

      clouds.dispose();
      delete (window as unknown as { __clouds?: object }).__clouds;
      scene.fog = null;

      delete (window as unknown as { __player?: PlayerDebugInfo }).__player;
      delete (window as unknown as { __char?: MD2Character }).__char;
      delete (window as unknown as {
        __dayNight?: {
          hour(): number;
          setHour(hour: number): void;
          sunHeight(): number;
          sunDir(): number[];
          moonDir(): number[];
          aim(dx: number, dy: number, dz: number): void;
        };
      }).__dayNight;
    };
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#bfd1e5]">
      <div ref={containerRef} className="absolute inset-0" />

      {/* ================= LOBBY dashboard overlay ================= */}
      {phase === 'lobby' && (
        <div className="pointer-events-none absolute inset-0 z-10 select-none">
          {/* readability scrims over the 3D showcase */}
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-zinc-950/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-zinc-950/70 to-transparent" />

          {/* LEFT HALF HEADER — one sharp-cornered glass bar welded to the
              top-left corner of the screen: player profile | divider | coin
              balance with "+". Top edge touches the viewport top and the
              left edge touches the viewport left; corners are square and
              the bottom-right corner is chamfer-cut starting from the
              centre of the right edge. sm+ gets exactly the left half
              (RATFIRE logo owns the right); phones get a compact bar capped
              short of the logo/buttons and drop the COINS label + "+" so
              the count stays readable. */}
          <header
            aria-label="Player header"
            className="pointer-events-auto absolute left-0 top-0 flex w-[calc(100%-8.5rem)] items-center gap-2.5 border border-amber-400/40 bg-zinc-950/70 py-2 pl-3 pr-2 shadow-xl backdrop-blur-md sm:w-[calc(50%-2rem)] sm:gap-3 sm:pl-4 sm:pr-4 [clip-path:polygon(0_0,100%_0,100%_50%,calc(100%_-_28px)_100%,0_100%)]"
          >
            {/* sharp amber underline fading toward the logo half */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-amber-400/80 via-amber-400/25 to-transparent"
            />
            {/* amber accent line riding the chamfered bottom-right cut
                (overshoot is trimmed by the header's own clip-path) */}
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-[13px] right-[-10px] h-px w-12 -rotate-45 bg-gradient-to-r from-amber-400/80 to-amber-400/5 sm:bottom-3.5"
            />
            {/* profile */}
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center bg-gradient-to-br from-amber-300 to-orange-600 text-base font-black text-zinc-950 sm:h-10 sm:w-10">
                {PLAYER_NAME.charAt(0)}
              </div>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-xs font-black tracking-wide text-zinc-100 sm:text-sm">
                  {PLAYER_NAME}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] font-bold text-zinc-300">
                  <span className="flex items-center gap-1">
                    <Gem className="h-3 w-3 text-emerald-400" aria-hidden />
                    {gems}
                  </span>
                </div>
              </div>
            </div>

            {/* divider between profile and currency */}
            <span
              aria-hidden
              className="h-8 w-px shrink-0 bg-gradient-to-b from-transparent via-zinc-500/70 to-transparent"
            />

            {/* coin balance */}
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center border border-amber-400/50 bg-amber-400/15 sm:h-10 sm:w-10"
              >
                <Coins className="h-5 w-5 text-amber-400" />
              </span>
              <div className="leading-none">
                <p className="hidden text-[8px] font-black uppercase tracking-[0.3em] text-zinc-400 sm:block sm:text-[9px]">
                  Coins
                </p>
                <p className="text-sm font-black tabular-nums tracking-wide text-amber-300 sm:mt-1 sm:text-base">
                  {coins}
                </p>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.blur();
                  setLobbyPanel('store');
                }}
                aria-label="Get more coins"
                className="ml-1 hidden h-7 w-7 shrink-0 place-items-center border border-amber-400/50 bg-amber-400/10 text-amber-300 transition-all hover:bg-amber-400/25 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 active:scale-90 sm:ml-1 sm:grid"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </header>

          {/* top-right: game logo — owns the corner again; the maximize/
              sound buttons now live on the right EDGE, vertically centred */}
          <div className="absolute right-3 top-2 text-right sm:right-5 sm:top-3">
            <h1 className="text-2xl font-black italic leading-none tracking-tighter text-zinc-50 drop-shadow-[0_2px_0_rgba(0,0,0,0.55)] sm:text-4xl">
              RAT<span className="text-amber-400">FIRE</span>
            </h1>
            <p className="mt-1 hidden text-[9px] font-bold uppercase tracking-[0.35em] text-zinc-300 sm:block">
              Classic · Bermuda
            </p>
          </div>

          {/* left menu */}
          <nav
            aria-label="Lobby menu"
            className="pointer-events-auto absolute left-3 top-[4.75rem] flex flex-col gap-1.5 sm:left-5 sm:top-24 sm:gap-2"
          >
            {LOBBY_MENU.map((item) => {
              const MenuIcon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={(event) => {
                    event.currentTarget.blur();
                    handleMenuClick(item.id);
                  }}
                  className="flex w-max items-center gap-2.5 whitespace-nowrap border border-zinc-700/50 bg-zinc-950/60 px-3 py-2 text-left backdrop-blur-md transition-all hover:border-amber-400/60 hover:bg-zinc-900/80 hover:pl-4"
                >
                  <MenuIcon
                    className="h-4 w-4 shrink-0 text-amber-400"
                    aria-hidden
                  />
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-200 sm:text-xs">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* ===== fullscreen command panel — every menu entry owns one ===== */}
          {lobbyPanel &&
            (() => {
              const meta = PANEL_META[lobbyPanel];
              const PanelIcon = meta.icon;
              return (
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${meta.title} panel`}
                  className="ratfire-panel pointer-events-auto absolute inset-0 z-30 flex flex-col border border-amber-400/40 bg-zinc-950/90 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl [clip-path:polygon(0_0,100%_0,100%_calc(100%_-_26px),calc(100%_-_26px)_100%,0_100%)]"
                >
                  {/* panel header */}
                  <header className="flex items-center gap-3 border-b border-amber-400/20 px-4 py-3 sm:px-6">
                    <span className="grid h-10 w-10 shrink-0 place-items-center border border-amber-400/50 bg-amber-400/10">
                      <PanelIcon
                        className="h-5 w-5 text-amber-300"
                        aria-hidden
                      />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-black uppercase tracking-[0.25em] text-zinc-100">
                        {meta.title}
                      </h2>
                      <p className="truncate text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
                        {meta.tagline}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="hidden items-center gap-1.5 border border-amber-400/40 bg-amber-400/5 px-2.5 py-1.5 sm:flex">
                        <Coins
                          className="h-3.5 w-3.5 text-amber-400"
                          aria-hidden
                        />
                        <span className="text-xs font-black tabular-nums text-amber-300">
                          {coins}
                        </span>
                      </span>
                      <span className="hidden items-center gap-1.5 border border-emerald-400/40 bg-emerald-400/5 px-2.5 py-1.5 sm:flex">
                        <Gem
                          className="h-3.5 w-3.5 text-emerald-400"
                          aria-hidden
                        />
                        <span className="text-xs font-black tabular-nums text-emerald-300">
                          {gems}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.currentTarget.blur();
                          setLobbyPanel(null);
                        }}
                        aria-label="Close panel"
                        className="flex h-9 w-9 items-center justify-center border border-zinc-700 text-zinc-300 transition-colors hover:border-amber-400/60 hover:text-amber-300"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </header>

                  {/* panel body */}
                  <div className="ratfire-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
                    <div
                      className={
                        lobbyPanel === 'character'
                          ? 'mx-auto flex min-h-full w-full max-w-6xl flex-col'
                          : 'mx-auto w-full max-w-6xl'
                      }
                    >
                      {/* ================= STORE ================= */}
                      {lobbyPanel === 'store' && (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {STORE_ITEMS.map((item) => {
                            const ItemIcon = item.icon;
                            const isSkin = item.kind === 'skin';
                            const isOwned = isSkin && !!owned[item.id];
                            const equipped =
                              isOwned &&
                              loadout.skinIndex === item.skinIndex;
                            const affordable = coins >= item.price;
                            return (
                              <article
                                key={item.id}
                                className="flex flex-col gap-3 border border-zinc-800 bg-zinc-900/60 p-4"
                              >
                                <div className="flex items-start gap-3">
                                  <span className="grid h-10 w-10 shrink-0 place-items-center border border-zinc-700 bg-zinc-950/60">
                                    <ItemIcon
                                      className={`h-5 w-5 ${item.accent}`}
                                      aria-hidden
                                    />
                                  </span>
                                  <div className="min-w-0">
                                    <h3 className="truncate text-xs font-black uppercase tracking-widest text-zinc-100">
                                      {item.name}
                                    </h3>
                                    <p className="mt-0.5 text-[11px] font-semibold leading-4 text-zinc-400">
                                      {item.blurb}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-auto flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-1.5 text-sm font-black tabular-nums text-amber-300">
                                    <Coins
                                      className="h-4 w-4 text-amber-400"
                                      aria-hidden
                                    />
                                    {item.price}
                                  </span>
                                  {isOwned ? (
                                    <span className="flex items-center gap-1 border border-emerald-400/50 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                                      <Check
                                        className="h-3.5 w-3.5"
                                        aria-hidden
                                      />
                                      {equipped ? 'Equipped' : 'Owned'}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.currentTarget.blur();
                                        buyStoreItem(item.id);
                                      }}
                                      className={`-skew-x-12 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-widest transition-all ${
                                        affordable
                                          ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 text-zinc-950 hover:brightness-110 active:scale-95'
                                          : 'border border-zinc-700 bg-zinc-900 text-zinc-500'
                                      }`}
                                    >
                                      <span className="flex skew-x-12 items-center">
                                        Buy
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}

                      {/* ============== LUCK ROYALE ============== */}
                      {lobbyPanel === 'luck' && (
                        <div className="flex flex-col items-center gap-6">
                          <div className="relative">
                            {/* pointer triangle riding the wheel's top edge */}
                            <span
                              aria-hidden
                              className="absolute -top-2 left-1/2 z-20 h-7 w-5 -translate-x-1/2 bg-gradient-to-b from-amber-200 to-amber-400 shadow-[0_2px_10px_rgba(251,191,36,0.8)] [clip-path:polygon(50%_100%,0_0,100%_0)]"
                            />
                            <div className="ratfire-luck-wheel relative h-56 w-56 sm:h-80 sm:w-80 lg:h-96 lg:w-96">
                              <div
                                className="absolute inset-0 rounded-full border-4 border-amber-400/70 shadow-[0_0_60px_-10px_rgba(251,191,36,0.65)]"
                                style={{
                                  background: `conic-gradient(${LUCK_SEGMENTS.map(
                                    (segment, index) =>
                                      `${segment.color} ${index * 45}deg ${
                                        (index + 1) * 45
                                      }deg`
                                  ).join(', ')})`,
                                  transform: `rotate(${luckRotation}deg)`,
                                  transition: luckSpinning
                                    ? 'transform 4s cubic-bezier(0.16, 1, 0.3, 1)'
                                    : 'none',
                                }}
                              >
                                {LUCK_SEGMENTS.map((segment, index) => (
                                  <span
                                    key={segment.id}
                                    className="ratfire-luck-label absolute left-1/2 top-1/2 -ml-8 -mt-2 w-16 text-center text-[10px] font-black uppercase leading-3 tracking-wider sm:-ml-10 sm:w-20 sm:text-xs"
                                    style={
                                      {
                                        '--seg': `${
                                          index * 45 + 22.5
                                        }deg`,
                                        color:
                                          segment.fg === 'light'
                                            ? '#fafafa'
                                            : '#18181b',
                                      } as CSSProperties
                                    }
                                  >
                                    {segment.label}
                                  </span>
                                ))}
                              </div>
                              <div className="absolute left-1/2 top-1/2 z-10 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-amber-400/80 bg-zinc-950 sm:h-16 sm:w-16">
                                <span className="text-[10px] font-black italic tracking-widest text-amber-300 sm:text-xs">
                                  RAT
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex w-full max-w-[18rem] gap-3 sm:max-w-sm">
                            <button
                              type="button"
                              disabled={luckSpinning}
                              onClick={(event) => {
                                event.currentTarget.blur();
                                spinLuck('coins');
                              }}
                              className="flex-1 -skew-x-12 bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 py-3 ring-1 ring-amber-200/70 transition-all enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:py-3.5"
                            >
                              <span className="flex skew-x-12 items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-zinc-950 sm:text-sm">
                                <Coins
                                  className="h-4 w-4 sm:h-5 sm:w-5"
                                  aria-hidden
                                />
                                Spin · {LUCK_COST.coins}
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={luckSpinning}
                              onClick={(event) => {
                                event.currentTarget.blur();
                                spinLuck('gems');
                              }}
                              className="flex-1 -skew-x-12 bg-gradient-to-b from-emerald-300 via-emerald-400 to-teal-500 py-3 ring-1 ring-emerald-200/70 transition-all enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:py-3.5"
                            >
                              <span className="flex skew-x-12 items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-zinc-950 sm:text-sm">
                                <Gem
                                  className="h-4 w-4 sm:h-5 sm:w-5"
                                  aria-hidden
                                />
                                Gem · {LUCK_COST.gems}
                              </span>
                            </button>
                          </div>

                          <p
                            role="status"
                            className="min-h-5 text-center text-xs font-black uppercase tracking-[0.2em] text-amber-300"
                          >
                            {luckSpinning
                              ? 'Spinning…'
                              : luckResult ||
                                'Spin to win coins, gems & exclusive skins'}
                          </p>
                        </div>
                      )}

                      {/* ============== CHARACTER (dressing room) ============== */}
                      {lobbyPanel === 'character' && (
                        <div className="flex min-h-0 flex-1 flex-col-reverse gap-3 lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-4">
                          {/* costume rack — full height, scrollable */}
                          <div
                            aria-label="Costume list"
                            className="ratfire-scroll flex min-h-24 flex-1 flex-col gap-1.5 overflow-y-auto border border-zinc-800/80 bg-zinc-900/40 p-1.5 lg:min-h-0"
                          >
                            <p className="shrink-0 px-1 pb-0.5 pt-0.5 text-[8px] font-black uppercase tracking-[0.3em] text-zinc-500">
                              Costume rack · {SKINS.length}
                            </p>
                            {SKINS.map((skin, index) => {
                              const unlocked = skinUnlocked(index);
                              const equipped = loadout.skinIndex === index;
                              const source = SKIN_SOURCES[index];
                              return (
                                <button
                                  key={skin.name}
                                  type="button"
                                  onClick={(event) => {
                                    event.currentTarget.blur();
                                    if (!unlocked) {
                                      showToast(
                                        'Locked — win it in Luck Royale or buy in the Store'
                                      );
                                      return;
                                    }
                                    apiRef.current?.setSkin(index);
                                  }}
                                  className={`flex w-full shrink-0 items-center gap-2.5 border px-2.5 py-2 text-left transition-all ${
                                    equipped
                                      ? 'border-emerald-400/80 bg-emerald-500/10'
                                      : unlocked
                                        ? 'border-zinc-800 bg-zinc-950/40 hover:border-amber-400/50 hover:bg-zinc-900'
                                        : 'border-zinc-800/60 bg-zinc-950/60 opacity-70'
                                  }`}
                                >
                                  <span
                                    className="h-4 w-4 shrink-0 rounded-full ring-2 ring-zinc-700"
                                    style={{ backgroundColor: skin.color }}
                                  />
                                  <span
                                    className={`truncate text-[11px] font-bold ${
                                      equipped
                                        ? 'text-emerald-300'
                                        : 'text-zinc-200'
                                    }`}
                                  >
                                    {skin.name}
                                  </span>
                                  <span className="ml-auto flex shrink-0 items-center">
                                    {equipped ? (
                                      <Check
                                        className="h-3.5 w-3.5 text-emerald-400"
                                        aria-hidden
                                      />
                                    ) : !unlocked ? (
                                      <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-400/80">
                                        <Lock
                                          className="h-3 w-3"
                                          aria-hidden
                                        />
                                        {source?.source === 'store'
                                          ? 'Store'
                                          : 'Luck'}
                                      </span>
                                    ) : null}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* live display room — full height on desktop */}
                          <div className="relative h-72 shrink-0 overflow-hidden border border-zinc-700/60 bg-gradient-to-b from-zinc-900/70 via-zinc-950/80 to-zinc-950 lg:h-auto">
                            <CharacterPreview
                              skinIndex={loadout.skinIndex}
                              weaponIndex={loadout.weaponIndex}
                            />
                            <p className="absolute left-3 top-3 flex items-center gap-1.5 border border-amber-400/40 bg-zinc-950/80 px-2 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-amber-300 backdrop-blur-sm">
                              <span
                                className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400"
                                aria-hidden
                              />
                              Live preview
                            </p>
                            <p className="absolute bottom-3 left-3 border border-zinc-700/60 bg-zinc-950/80 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-200 backdrop-blur-sm">
                              {SKINS[loadout.skinIndex]?.name}
                            </p>
                            <p className="absolute bottom-3 right-3 hidden text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-500 sm:block">
                              Drag to spin
                            </p>
                          </div>
                        </div>
                      )}

                      {/* ================= VAULT ================= */}
                      {lobbyPanel === 'vault' && (
                        <div className="flex flex-col gap-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="border border-amber-400/30 bg-amber-400/5 p-4">
                              <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">
                                <Coins
                                  className="h-3.5 w-3.5 text-amber-400"
                                  aria-hidden
                                />
                                Coins
                              </p>
                              <p className="mt-1 text-2xl font-black tabular-nums text-amber-300">
                                {coins}
                              </p>
                            </div>
                            <div className="border border-emerald-400/30 bg-emerald-400/5 p-4">
                              <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">
                                <Gem
                                  className="h-3.5 w-3.5 text-emerald-400"
                                  aria-hidden
                                />
                                Gems
                              </p>
                              <p className="mt-1 text-2xl font-black tabular-nums text-emerald-300">
                                {gems}
                              </p>
                            </div>
                          </div>

                          <section className="border border-zinc-800 bg-zinc-900/60 p-4">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                              Equipped loadout
                            </h3>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <div className="flex items-center gap-3 border border-zinc-800 bg-zinc-950/50 p-3">
                                <span
                                  className="h-5 w-5 shrink-0 rounded-full ring-2 ring-zinc-700"
                                  style={{
                                    backgroundColor:
                                      SKINS[loadout.skinIndex]?.color,
                                  }}
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-black uppercase tracking-widest text-zinc-100">
                                    {SKINS[loadout.skinIndex]?.name}
                                  </p>
                                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                                    Skin · change in Character
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 border border-zinc-800 bg-zinc-950/50 p-3">
                                {(() => {
                                  const weapon =
                                    WEAPONS[loadout.weaponIndex] ?? WEAPONS[0];
                                  const WeaponIcon = weapon.icon;
                                  return (
                                    <>
                                      <span className="grid h-9 w-9 shrink-0 place-items-center border border-zinc-700 bg-zinc-950/60">
                                        <WeaponIcon
                                          className="h-4 w-4 text-amber-300"
                                          aria-hidden
                                        />
                                      </span>
                                      <div className="min-w-0">
                                        <p className="truncate text-xs font-black uppercase tracking-widest text-zinc-100">
                                          {weapon.name}
                                        </p>
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                                          {
                                            WEAPON_ROLES[
                                              loadout.weaponIndex
                                            ]
                                          }{' '}
                                          · change in Weapons
                                        </p>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </section>

                          <section>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                              Skin locker
                            </h3>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {SKINS.map((skin, index) => {
                                const unlocked = skinUnlocked(index);
                                const equipped =
                                  loadout.skinIndex === index;
                                const source = SKIN_SOURCES[index];
                                return (
                                  <div
                                    key={skin.name}
                                    className={`flex items-center gap-3 border p-3 ${
                                      equipped
                                        ? 'border-emerald-400/70 bg-emerald-500/10'
                                        : 'border-zinc-800 bg-zinc-900/60'
                                    }`}
                                  >
                                    <span
                                      className="h-4 w-4 shrink-0 rounded-full ring-2 ring-zinc-700"
                                      style={{ backgroundColor: skin.color }}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-[11px] font-black uppercase tracking-wider text-zinc-100">
                                        {skin.name}
                                      </p>
                                      {!unlocked && (
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-amber-400/80">
                                          Locked ·{' '}
                                          {source?.source === 'store'
                                            ? 'Store'
                                            : 'Luck Royale'}
                                        </p>
                                      )}
                                    </div>
                                    {equipped ? (
                                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                                        <Check
                                          className="h-3.5 w-3.5"
                                          aria-hidden
                                        />
                                        Worn
                                      </span>
                                    ) : unlocked ? (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.currentTarget.blur();
                                          apiRef.current?.setSkin(index);
                                        }}
                                        className="-skew-x-12 bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-950 transition-all hover:brightness-110 active:scale-95"
                                      >
                                        <span className="flex skew-x-12">
                                          Equip
                                        </span>
                                      </button>
                                    ) : (
                                      <Lock
                                        className="h-3.5 w-3.5 shrink-0 text-zinc-600"
                                        aria-hidden
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        </div>
                      )}

                      {/* ================= PET ================= */}
                      {lobbyPanel === 'pet' && (
                        <div className="flex flex-col gap-4">
                          <section className="flex flex-wrap items-center gap-4 border border-emerald-400/30 bg-emerald-400/5 p-4">
                            <span className="grid h-12 w-12 shrink-0 place-items-center border border-emerald-400/50 bg-zinc-950/60">
                              <Bot
                                className="h-6 w-6 text-emerald-300"
                                aria-hidden
                              />
                            </span>
                            <div className="min-w-0">
                              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-100">
                                BUZZ — Combat Drone
                              </h3>
                              <p className="text-[11px] font-semibold text-zinc-400">
                                Airborne · AI online · hull 100% · rockets armed
                              </p>
                            </div>
                            <span className="ml-auto flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                              <span
                                className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"
                                aria-hidden
                              />
                              Online
                            </span>
                          </section>

                          <section>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                              Direct orders
                            </h3>
                            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                              {PET_ORDERS.map((order) => {
                                const OrderIcon = order.icon;
                                return (
                                  <button
                                    key={order.kind}
                                    type="button"
                                    onClick={(event) => {
                                      event.currentTarget.blur();
                                      apiRef.current?.droneDirective(
                                        order.kind
                                      );
                                      showToast(`BUZZ: ${order.call}`);
                                    }}
                                    className="flex flex-col items-start gap-3 border border-zinc-800 bg-zinc-900/60 p-4 text-left transition-all hover:border-emerald-400/50 hover:bg-zinc-900"
                                  >
                                    <span className="grid h-9 w-9 place-items-center border border-emerald-400/40 bg-zinc-950/60">
                                      <OrderIcon
                                        className="h-4 w-4 text-emerald-300"
                                        aria-hidden
                                      />
                                    </span>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-zinc-100">
                                      {order.label}
                                    </span>
                                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                                      {order.kind}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                            <p className="mt-3 text-[10px] font-semibold uppercase leading-relaxed tracking-widest text-zinc-500">
                              Orders ride the same brain as BUZZ voice commands
                              — press V in game to talk to him directly.
                            </p>
                          </section>
                        </div>
                      )}

                      {/* ============== COLLECTION ============== */}
                      {lobbyPanel === 'collection' && (
                        <div className="flex flex-col gap-4">
                          <section className="border border-zinc-800 bg-zinc-900/60 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                                Unlock progress
                              </h3>
                              <span className="text-[11px] font-black tabular-nums text-amber-300">
                                {
                                  SKINS.filter((_, index) =>
                                    skinUnlocked(index)
                                  ).length
                                }
                                /{SKINS.length} skins
                              </span>
                            </div>
                            <div className="mt-2 h-2 w-full overflow-hidden bg-zinc-800">
                              <div
                                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
                                style={{
                                  width: `${
                                    (SKINS.filter((_, index) =>
                                      skinUnlocked(index)
                                    ).length /
                                      SKINS.length) *
                                    100
                                  }%`,
                                }}
                              />
                            </div>
                          </section>

                          <section>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                              World atlas
                            </h3>
                            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                              {WORLD_BIOMES.map((biome) => (
                                <article
                                  key={biome.name}
                                  className="border border-zinc-800 bg-zinc-900/60 p-3"
                                >
                                  <div
                                    className={`h-14 w-full bg-gradient-to-br ${biome.gradient}`}
                                    aria-hidden
                                  />
                                  <p className="mt-2 truncate text-[11px] font-black uppercase tracking-wider text-zinc-100">
                                    {biome.name}
                                  </p>
                                  <p className="truncate text-[9px] font-semibold uppercase tracking-widest text-zinc-500">
                                    {biome.tag}
                                  </p>
                                </article>
                              ))}
                            </div>
                          </section>

                          <section>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                              Systems online
                            </h3>
                            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                              {SYSTEM_CARDS.map((system) => {
                                const SystemIcon = system.icon;
                                return (
                                  <article
                                    key={system.name}
                                    className="flex items-center gap-3 border border-zinc-800 bg-zinc-900/60 p-3"
                                  >
                                    <span className="grid h-9 w-9 shrink-0 place-items-center border border-zinc-700 bg-zinc-950/60">
                                      <SystemIcon
                                        className="h-4 w-4 text-amber-300"
                                        aria-hidden
                                      />
                                    </span>
                                    <div className="min-w-0">
                                      <p className="truncate text-[11px] font-black uppercase tracking-wider text-zinc-100">
                                        {system.name}
                                      </p>
                                      <p className="flex items-center gap-1 truncate text-[9px] font-bold uppercase tracking-widest text-emerald-400">
                                        <span
                                          className="h-1 w-1 rounded-full bg-emerald-400"
                                          aria-hidden
                                        />
                                        {system.note}
                                      </p>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                          </section>
                        </div>
                      )}

                      {/* ================= WEAPONS ================= */}
                      {lobbyPanel === 'weapons' && (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                          {WEAPONS.map((weapon, index) => {
                            const WeaponIcon = weapon.icon;
                            const equipped = loadout.weaponIndex === index;
                            return (
                              <button
                                key={weapon.name}
                                type="button"
                                onClick={(event) => {
                                  event.currentTarget.blur();
                                  apiRef.current?.setWeapon(index);
                                }}
                                className={`flex flex-col items-start gap-3 border p-4 text-left transition-all ${
                                  equipped
                                    ? 'border-amber-400/80 bg-amber-400/10'
                                    : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-900'
                                }`}
                              >
                                <span
                                  className={`grid h-10 w-10 place-items-center border ${
                                    equipped
                                      ? 'border-amber-400/60 bg-amber-400/15'
                                      : 'border-zinc-700 bg-zinc-950/60'
                                  }`}
                                >
                                  <WeaponIcon
                                    className={`h-5 w-5 ${
                                      equipped
                                        ? 'text-amber-300'
                                        : 'text-zinc-300'
                                    }`}
                                    aria-hidden
                                  />
                                </span>
                                <span className="text-xs font-black uppercase tracking-widest text-zinc-100">
                                  {weapon.name}
                                </span>
                                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">
                                  {WEAPON_ROLES[index]}
                                </span>
                                {equipped && (
                                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                                    <Check
                                      className="h-3.5 w-3.5"
                                      aria-hidden
                                    />
                                    Equipped
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* panel status footer */}
                  <footer className="flex items-center justify-between gap-3 border-t border-amber-400/20 px-4 py-2 sm:px-6">
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">
                      Ratfire command · {meta.title}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600">
                      Esc to close
                    </p>
                  </footer>
                </section>
              );
            })()}

          {/* bottom-left hint */}
          <p className="absolute bottom-5 left-4 hidden text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400/90 sm:block">
            Drag to rotate · Enter to deploy
          </p>

          {/* bottom-centre: push the whole game source to GitHub */}
          <button
            type="button"
            onClick={(event) => {
              event.currentTarget.blur();
              setGhOpen(true);
            }}
            aria-label="Save source code to GitHub"
            aria-haspopup="dialog"
            className="pointer-events-auto group absolute bottom-5 left-1/2 z-20 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border-2 border-zinc-600/60 bg-zinc-950/75 text-zinc-200 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.8)] backdrop-blur-md transition-all duration-200 hover:scale-110 hover:border-amber-400/70 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 active:scale-95 sm:bottom-8 sm:h-16 sm:w-16"
          >
            <GithubMark
              className="h-6 w-6 transition-transform duration-200 group-hover:rotate-6 sm:h-7 sm:w-7"
            />
          </button>

          {/* START */}
          <button
            type="button"
            onClick={(event) => {
              event.currentTarget.blur();
              enterGame();
            }}
            aria-label="Start game"
            className="group pointer-events-auto absolute bottom-5 right-4 outline-none sm:bottom-8 sm:right-8"
          >
            <span className="flex -skew-x-12 items-center bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 py-3 pl-7 pr-5 shadow-[0_10px_40px_-10px_rgba(251,146,60,0.9)] ring-1 ring-amber-200/70 transition-all duration-200 group-hover:scale-105 group-hover:shadow-[0_12px_50px_-8px_rgba(251,146,60,1)] group-focus-visible:ring-2 group-focus-visible:ring-white group-active:scale-95 sm:py-4 sm:pl-11 sm:pr-7">
              <span className="flex skew-x-12 items-center gap-2.5 text-xl font-black italic tracking-[0.12em] text-zinc-950 sm:text-2xl">
                START
                <Play
                  className="h-5 w-5 fill-zinc-950 sm:h-6 sm:w-6"
                  aria-hidden
                />
              </span>
            </span>
          </button>
        </div>
      )}

      {/* ================= GitHub export panel (centre modal) ================= */}
      {ghOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Save source code to GitHub"
          className="absolute inset-0 z-50 flex items-center justify-center p-4"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close GitHub panel"
            onClick={() => setGhOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-zinc-950/70 backdrop-blur-sm focus-visible:outline-none"
          />
          <section className="relative w-[min(92vw,26rem)] rounded-2xl border border-amber-400/30 bg-zinc-950/95 p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between border-b border-zinc-700/60 pb-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-zinc-100 text-zinc-950">
                  <GithubMark className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-[0.22em] text-zinc-100">
                    Push to GitHub
                  </h2>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                    Back up the full game source
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGhOpen(false)}
                aria-label="Close GitHub panel"
                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {ghStatus === 'success' ? (
              <div className="mt-4 space-y-4">
                <p className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <Check className="h-4 w-4 shrink-0" aria-hidden />
                  Saved {ghFiles} source files to GitHub
                </p>
                <a
                  href={ghUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2.5 text-xs font-bold text-amber-300 underline underline-offset-4 transition-colors hover:bg-amber-400/20"
                >
                  {ghUrl}
                </a>
                <p className="text-[10px] font-semibold uppercase leading-snug tracking-widest text-zinc-500">
                  The repository opens in a new tab — every future save adds a
                  fresh commit.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGhStatus('idle')}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-xs font-black uppercase tracking-widest text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-800"
                  >
                    Save to another repo
                  </button>
                  <button
                    type="button"
                    onClick={() => setGhOpen(false)}
                    className="flex-1 rounded-lg bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 px-3 py-2.5 text-xs font-black uppercase tracking-widest text-zinc-950 transition-all hover:brightness-110"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form
                className="mt-4 space-y-3.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveToGithub();
                }}
              >
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    GitHub token
                  </span>
                  <div className="relative">
                    <input
                      type={ghShowToken ? 'text' : 'password'}
                      value={ghToken}
                      onChange={(event) => setGhToken(event.target.value)}
                      placeholder="ghp_… or github_pat_…"
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 pl-3 pr-10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setGhShowToken((value) => !value)}
                      aria-label={ghShowToken ? 'Hide token' : 'Show token'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
                    >
                      {ghShowToken ? (
                        <EyeOff className="h-4 w-4" aria-hidden />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                  <span className="mt-1 block text-[10px] leading-snug text-zinc-500">
                    Used only for this request and never stored. Needs a classic
                    token with the "repo" scope — or a fine-grained token with
                    Contents + Administration read &amp; write.{' '}
                    <a
                      href="https://github.com/settings/tokens/new"
                      target="_blank"
                      rel="noreferrer"
                      className="whitespace-nowrap font-bold text-amber-400 underline underline-offset-2 transition-colors hover:text-amber-300"
                    >
                      Create / verify a token on GitHub ↗
                    </a>
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Repository name
                  </span>
                  <input
                    type="text"
                    value={ghRepo}
                    onChange={(event) => setGhRepo(event.target.value)}
                    placeholder="my-ratfire-game"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
                  />
                  <span className="mt-1 block text-[10px] leading-snug text-zinc-500">
                    Created under your account on save — or updated with a new
                    commit if it already exists.
                  </span>
                </label>

                {ghStatus === 'error' && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold leading-snug text-red-300"
                  >
                    {ghError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={
                    ghStatus === 'working' || !ghToken.trim() || !ghRepo.trim()
                  }
                  className="flex w-full -skew-x-12 items-center justify-center bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 py-3 ring-1 ring-amber-200/70 transition-all duration-200 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="flex skew-x-12 items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-zinc-950">
                    {ghStatus === 'working' ? (
                      <>
                        <LoaderCircle
                          className="h-4 w-4 animate-spin"
                          aria-hidden
                        />
                        {ghStep}
                      </>
                    ) : (
                      'Save'
                    )}
                  </span>
                </button>
              </form>
            )}
          </section>
        </div>
      )}

      {/* ==== transient toast — lobby menu stubs AND in-game loot pickups ==== */}
      {toast && (
        <div
          role="status"
          className="absolute left-1/2 top-28 z-20 -translate-x-1/2 rounded-full border border-amber-400/40 bg-zinc-950/85 px-5 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-amber-300 shadow-xl backdrop-blur-md sm:top-24"
        >
          {toast}
        </div>
      )}

      {/* ======= driving HUD: jeep speed + enter hint (bottom-centre) ======= */}
      <div
        ref={driveHudRef}
        style={{ display: 'none' }}
        aria-live="polite"
        className="pointer-events-none absolute bottom-28 left-1/2 z-10 -translate-x-1/2 flex-col items-center gap-0.5 rounded-xl border border-amber-400/40 bg-zinc-950/70 px-5 py-2 text-center shadow-xl backdrop-blur-md"
      >
        <div className="hidden flex-row items-baseline gap-1.5">
          <span
            ref={driveSpeedRef}
            className="text-2xl font-black tabular-nums text-amber-300"
          >
            0
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            km/h
          </span>
        </div>
        <span
          ref={driveHudModeRef}
          className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-200"
        >
          PRESS E TO DRIVE
        </span>
      </div>

      {/* == top-LEFT HUD: circular 2D minimap dial with the curved vitals
          ring wrapped around it (ring is 133% of the minimap box, so the
          cluster sits inset far enough that the bezel never leaves the
          screen) == */}
      {phase === 'playing' && (
        <div className="absolute left-9 top-9 z-10 flex flex-col items-start gap-2">
          <Minimap
            ref={minimapRef}
            block={BLOCK}
            gridOffset={GRID_OFFSET}
            bridge={mapBridgeRef}
          />
          <HealthBar ref={healthBarRef} />
        </div>
      )}

      {/* ===== top-right HUD: live balance pill + BUZZ combat chip ===== */}
      {phase === 'playing' && (
        <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 border border-amber-400/40 bg-zinc-950/70 px-2.5 py-1.5 shadow-lg backdrop-blur-md">
            <span className="flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-amber-400" aria-hidden />
              <span className="text-xs font-black tabular-nums text-amber-300">
                {coins}
              </span>
            </span>
            {gems > 0 && (
              <span className="flex items-center gap-1.5">
                <Gem className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                <span className="text-xs font-black tabular-nums text-emerald-300">
                  {gems}
                </span>
              </span>
            )}
          </div>
          {/* drone-AI status: written from the game loop via
              droneHudRef (textContent only — zero React re-renders) */}
          <div className="flex items-center gap-1.5 border border-red-400/40 bg-zinc-950/70 px-2.5 py-1.5 shadow-lg backdrop-blur-md">
            <Target className="h-3.5 w-3.5 text-red-400" aria-hidden />
            <span
              ref={droneHudRef}
              className="text-xs font-black tabular-nums text-red-300"
            >
              AI PATROL · HULL 100%
            </span>
          </div>
          {/* BUZZ voice link: link state + live mic level + last heard +
              BUZZ's reply — written via refs (textContent only, zero
              re-renders) */}
          <div className="w-64 border border-emerald-400/40 bg-zinc-950/70 px-2.5 py-1.5 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-1.5">
              <Mic
                className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                aria-hidden
              />
              <span
                ref={voiceHudStateRef}
                className="text-xs font-black tabular-nums text-emerald-300"
              >
                VOICE OFF · PRESS V
              </span>
            </div>
            <div
              className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-800/80"
              aria-hidden
            >
              <div
                ref={voiceMeterRef}
                className="h-full w-full origin-left rounded-full bg-emerald-400/80 transition-transform duration-75"
                style={{ transform: 'scaleX(0)' }}
              />
            </div>
            <span
              ref={voiceHudHeardRef}
              className="mt-1 block truncate text-[11px] font-semibold leading-4 text-zinc-300"
            >
              Press V to talk — or type to BUZZ
            </span>
            <span
              ref={voiceHudReplyRef}
              className="mt-0.5 block whitespace-normal break-words text-[11px] font-semibold leading-4 text-amber-200"
            />
            {/* TYPED CHAT — the always-open channel: even when the speech
                (ASR) link is rate-limited, typed text rides the same LLM
                brain and BUZZ still answers (and speaks) out loud */}
            <form
              className="mt-1 flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                const el = voiceTextRef.current;
                const text = el?.value.trim();
                if (!text) return;
                if (el) el.value = '';
                voiceInjectRef.current?.(text);
              }}
            >
              <input
                ref={voiceTextRef}
                type="text"
                maxLength={120}
                autoComplete="off"
                placeholder="Type to BUZZ…"
                aria-label="Type a message to BUZZ"
                className="h-6 min-w-0 flex-1 border border-emerald-400/30 bg-black/60 px-1.5 text-[11px] font-semibold text-emerald-100 outline-none placeholder:text-zinc-500 focus:border-emerald-300/70"
                onKeyDown={(e) => {
                  // Esc leaves the field instead of the mission
                  if (e.key === 'Escape') e.currentTarget.blur();
                }}
              />
              <button
                type="submit"
                aria-label="Send message to BUZZ"
                className="flex h-6 w-6 shrink-0 items-center justify-center border border-emerald-400/40 bg-emerald-400/10 text-emerald-300 transition-colors hover:bg-emerald-400/25"
              >
                <Send className="h-3 w-3" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========== mobile touch controls — ONLY on touch devices ========== */}
      {phase === 'playing' && isTouch && (
        <TouchControls apiRef={touchApiRef} />
      )}

      {/* ===== right EDGE, vertically centred: MAXIMIZE (fullscreen) + sound
           stacked VERTICALLY (also the M key) — clears the lobby header/
           logo on top and the mobile fire cluster at the bottom; the top
           offset re-centres within the safe-area box on notched phones */}
      <div
        className="absolute right-3 z-0 flex -translate-y-1/2 flex-col items-center gap-2"
        style={{
          top: 'calc(50% + (env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) / 2)',
        }}
      >
        <button
          type="button"
          onClick={toggleImmersive}
          aria-label={
            isFullscreen
              ? 'Exit fullscreen (show the browser bars)'
              : 'Maximize game — hide the browser bars (fullscreen)'
          }
          aria-pressed={isFullscreen}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white/85 backdrop-blur-sm transition-colors hover:bg-black/55"
        >
          {isFullscreen ? (
            <Minimize className="h-5 w-5" aria-hidden />
          ) : (
            <Maximize className="h-5 w-5" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? 'Unmute game sound' : 'Mute game sound'}
          aria-pressed={muted}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white/85 backdrop-blur-sm transition-colors hover:bg-black/55"
        >
          {muted ? (
            <VolumeX className="h-5 w-5" aria-hidden />
          ) : (
            <Volume2 className="h-5 w-5" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={() => voiceToggleRef.current?.()}
          aria-label={
            voiceOn
              ? 'Stop BUZZ voice link (V)'
              : 'Start BUZZ voice link (V)'
          }
          aria-pressed={voiceOn}
          title="BUZZ voice link (V)"
          className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-sm transition-colors ${
            voiceOn
              ? 'bg-emerald-500/40 text-emerald-100 hover:bg-emerald-500/60'
              : 'bg-black/35 text-white/85 hover:bg-black/55'
          }`}
        >
          {voiceOn ? (
            <Mic className="h-5 w-5" aria-hidden />
          ) : (
            <MicOff className="h-5 w-5" aria-hidden />
          )}
        </button>
      </div>

    </main>
  );
}
