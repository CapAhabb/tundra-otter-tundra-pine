import { buildHouse, circleHitsRect, pointInRect, roomAt } from "./house";
import { ageTierFor, kitItemsForTier, stepsFor, tierText, type AgeTier } from "./missions";
import { gameAudio } from "./audio";
import { KIT_LABELS, type DrillId, type FamilyProfile, type HouseWorld, type Interactable, type KitItemId, type MissionStep, type Rect, type VisualShell } from "./types";
import { saveChildObservation } from "./child-progress";
import { drawKaraRose } from "./kara-art";

export type HudChoice = { id: string; label: string };

export type HudState = {
  roomName: string;
  nearby: Interactable | null;
  steps: MissionStep[];
  powerOut: boolean;
  flashlight: boolean;
  collected: KitItemId[];
  dialogue: { speaker: string; text: string } | null;
  choices: HudChoice[] | null;
  complete: boolean;
  hint: string;
  prompt: string | null;
  playerName: string;
  cutIn: boolean;
};

const ASSETS: Record<string, string> = {
  player: "/game/player-sheet.png",
  maya: "/game/maya.png",
  leo: "/game/leo.png",
  neighbor: "/game/neighbor-sheet.png",
  sofa: "/game/sofa.png",
  bed: "/game/bed.png",
  fridge: "/game/fridge.png",
  table: "/game/table.png",
  counter: "/game/counter.png",
  breaker: "/game/breaker.png",
  generator: "/game/generator.png",
  gobag: "/game/gobag.png",
  medkit: "/game/medkit.png",
  flashlight: "/game/flashlight.png",
  water: "/game/water.png",
  radio: "/game/radio.png",
  food: "/game/food.png",
  batteries: "/game/batteries.png",
  extinguisher: "/game/extinguisher.png",
  whistle: "/game/whistle.png",
  wood: "/game/floor-wood.jpg",
  tile: "/game/floor-tile.jpg",
  carpet: "/game/floor-carpet.jpg",
  grass: "/game/floor-grass.jpg",
  sand: "/game/floor-sand.jpg",
  forest: "/game/floor-forest.jpg",
  concrete: "/game/floor-concrete.jpg",
  bath: "/game/floor-bath.jpg",
};

const SPEED = 168;
const PLAYER_R = 12;
const FIXED = 1 / 60;

type Dir = "down" | "left" | "right" | "up";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function yawFromMove(mx: number, my: number): number {
  return Math.atan2(-mx, -my);
}

export class ReadyEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  profile: FamilyProfile;
  playerId: string;
  drill: DrillId;
  world: HouseWorld;
  images: Record<string, HTMLImageElement> = {};
  keys = new Set<string>();
  injected: string[] | null = null;
  stick = { x: 0, y: 0 };
  px = 0;
  py = 0;
  vx = 0;
  vy = 0;
  yaw = Math.PI;
  dir: Dir = "down";
  /** -1..1, eased toward facing left/right; drives a smooth turn instead of an instant mirror flip. */
  facingScale = 1;
  walkT = 0;
  camX = 0;
  camY = 0;
  running = false;
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;
  acc = 0;
  last = 0;
  raf = 0;
  powerOut = false;
  flashlight = false;
  breakersDone = false;
  generatorDone = false;
  neighborTalked = false;
  collected = new Set<KitItemId>();
  checked = new Set<string>();
  hiddenProps = new Set<string>();
  steps: MissionStep[] = [];
  dialogue: { speaker: string; text: string } | null = null;
  complete = false;
  shake = 0;
  particles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  idle = 0;
  onHud?: (h: HudState) => void;
  onComplete?: (stars: number, summary: string) => void;
  playerName = "";
  reduced = false;
  finishPosted = false;
  interactHeld = false;
  interactWas = false;
  private talkQueue: { speaker: string; text: string }[] = [];
  private pendingChoices: HudChoice[] | null = null;
  private scheduledChoices: HudChoice[] | null = null;
  private hintedStep = "";
  private taught = new Set<string>();
  private karaMode: "idle" | "guiding" | "teaching" | "attention" | "success" = "idle";
  private kx = 0;
  private ky = 0;
  private karaDust: { x: number; y: number; vx: number; vy: number; life: number; s: number }[] = [];
  private hudKey = "";
  private ageTier: AgeTier = "mid";
  private effectiveKitItems: KitItemId[] = [];
  private nudgeCount = 0;
  cutIn: { x: number; y: number } | null = null;
  private cutInT = 0;

  constructor(
    canvas: HTMLCanvasElement,
    profile: FamilyProfile,
    playerId: string,
    drill: DrillId,
    shell?: VisualShell | null,
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2d context");
    this.ctx = ctx;
    this.profile = profile;
    this.playerId = playerId;
    this.drill = drill;
    this.world = buildHouse(profile, shell);
    this.px = this.world.spawn.x;
    this.py = this.world.spawn.y;
    this.kx = this.px + 56;
    this.ky = this.py - 138;
    this.camX = this.px;
    this.camY = this.py;
    const player = profile.members.find((m) => m.id === playerId);
    this.playerName = player?.name ?? "You";
    this.ageTier = ageTierFor(player?.age);
    this.effectiveKitItems = kitItemsForTier(profile.plan.kitItems, this.ageTier);
    this.steps = stepsFor(drill, profile, this.playerName, player?.age);
    this.reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (drill === "power-out") this.powerOut = true;
  }

  async start() {
    const entries = await Promise.all(
      Object.entries(ASSETS).map(async ([k, src]) => [k, await loadImage(src)] as const),
    );
    // stop() can run while the image loads above are still in flight (e.g. an
    // effect cleanup firing before this async work resolves). Without this
    // guard, a "stopped" engine would resurrect itself afterward: rebinding
    // window key listeners, starting its own render loop, and overwriting
    // window.__controlsTest — a second, invisible-but-live engine racing the
    // real one on the same canvas and keyboard, each with its own dialogue
    // state. That's what made a dismissed line (or a cut-in) look like it
    // randomly came back: it was a different, stale engine instance re-
    // asserting itself.
    if (this.destroyed) return;
    this.images = Object.fromEntries(
      entries.filter((e): e is readonly [string, HTMLImageElement] => e[1] != null),
    );
    this.resize();
    this.bind();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    if (this.canvas.parentElement) this.resizeObserver.observe(this.canvas.parentElement);
    this.running = true;
    this.last = performance.now();
    let drillLine = `Find everyone in the ${this.profile.familyName} family, then meet at ${this.profile.plan.meetingPlace}.`;
    if (this.drill === "power-out") {
      gameAudio.outage();
      this.shake = this.reduced ? 0 : 10;
      drillLine = `The lights just went out. That's okay, ${this.playerName}. We have a plan. First, find a flashlight.`;
    } else if (this.drill === "pack-kit") {
      drillLine = `Let's pack the ${this.profile.familyName} kit. Walk the house and pick up each item on the list.`;
    } else if (this.drill === "neighbor") {
      const n = this.profile.neighbors[0];
      drillLine = n
        ? `If something happens, your family checks in with ${n.name}. Let's walk over.`
        : "Let's practice walking to your neighbor.";
    }
    this.talkQueue = [
      { speaker: "Kara", text: `Hi ${this.playerName}, I’m Kara. ${drillLine}` },
    ];
    this.advanceTalk();
    this.emit();
    this.loop(this.last);
    this.installProbe();
  }

  stop() {
    this.destroyed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbind();
    this.resizeObserver?.disconnect();
    if (window.__controlsTest) delete window.__controlsTest;
  }

  resize() {
    const parent = this.canvas.parentElement;
    const w = parent?.clientWidth ?? 800;
    const h = parent?.clientHeight ?? 600;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === "KeyE" || e.code === "Space") this.interactHeld = true;
    if (e.code === "Escape" && this.dialogue && !this.pendingChoices) {
      this.advanceTalk();
      this.emit();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === "KeyE" || e.code === "Space") this.interactHeld = false;
  };
  private onBlur = () => {
    this.keys.clear();
    this.stick.x = 0;
    this.stick.y = 0;
    this.interactHeld = false;
  };

  private bind() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onBlur);
    window.addEventListener("resize", this.onResize);
  }
  private unbind() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onBlur);
    window.removeEventListener("resize", this.onResize);
  }
  private onResize = () => this.resize();

  setStick(x: number, y: number) {
    this.stick.x = x;
    this.stick.y = y;
  }

  requestInteract() {
    this.interactHeld = true;
  }

  dismissDialogue() {
    // Only clear pendingChoices (skipping an already-revealed choice without
    // answering). Do NOT clear scheduledChoices here: for any lesson with
    // more than one line of dialogue before its question, clicking Continue
    // through the earlier lines was wiping the choice before it ever had a
    // chance to appear. advanceTalk() is what promotes scheduledChoices to
    // pendingChoices once the queue actually empties.
    this.pendingChoices = null;
    this.advanceTalk();
    this.emit();
  }

  chooseLesson(id: string) {
    this.pendingChoices = null;
    this.scheduledChoices = null;
    this.dialogue = null;
    if (id === "flash-ok" || id === "flash-batteries") this.cutIn = null;
    if (id === "flash-ok") {
      saveChildObservation("flashlight", "Child marked flashlight as checked.");
      this.karaSay(
        tierText(
          this.ageTier,
          "Nice! It's ready to go, just like that.",
          "Nice job. Now you know it’s ready, and so does your family.",
          "Nice job — you checked it yourself, so your family can count on it working.",
        ),
      );
    } else if (id === "flash-batteries") {
      saveChildObservation("flashlight", "Child noted the flashlight may need batteries.");
      this.karaSay(
        tierText(
          this.ageTier,
          "Good eye! Tell a grown-up it needs batteries.",
          "Good catch. That’s exactly why we check before an emergency, not during one.",
          "Good catch — finding that now, calmly, beats discovering it during an outage.",
        ),
      );
    } else if (id === "water-yes") {
      saveChildObservation("water", "Child knows extra water location.");
      this.karaSay(
        tierText(
          this.ageTier,
          "Good! You know right where it is.",
          "Good. Still get with your parents and talk it through, so you both know for sure.",
          "Good — it's still worth double-checking with your parents, so you're both certain.",
        ),
      );
      this.karaSay(
        tierText(
          this.ageTier,
          "And if water ever runs low, a grown-up can boil it for a full minute to make it safe again.",
          "And if you're ever running low, boiling water for a full minute makes it safe to drink again — never drink flood or storm water.",
          "And if supplies ever run short, boiling water for a full minute (or a purification tablet) makes it safe again — never drink flood or storm water, even if it looks clear.",
        ),
      );
    } else if (id === "water-not-sure") {
      saveChildObservation("water", "Child is unsure where extra water is.");
      this.karaSay(
        tierText(
          this.ageTier,
          "That's okay. Ask a grown-up to show you.",
          "That’s okay. Get with your parents and discuss where extra water is kept, so you’ll know if you ever need it.",
          "That’s a completely fair answer — ask your parents to walk you through it once, and you'll always know.",
        ),
      );
      this.karaSay(
        tierText(
          this.ageTier,
          "Good to know either way: a grown-up can boil water for a full minute to make it safe if you ever run low.",
          "Good to know either way: boiling water for a full minute makes it safe to drink if you ever run low — never drink flood or storm water.",
          "Worth knowing either way: boiling water for a full minute (or a purification tablet) makes it safe if supplies run short — never drink flood or storm water, even if it looks clear.",
        ),
      );
    } else if (id === "gen-outside") {
      saveChildObservation("generator", "Child knows generators must run outside, away from windows and doors.");
      this.karaSay(
        tierText(
          this.ageTier,
          "That's right! Outside and far from windows keeps everyone safe.",
          "That's right. Outside, far from windows, doors, and vents — that's the only safe spot for it.",
          "Exactly — outside, well clear of windows, doors, and vents, is the only safe place for it to run.",
        ),
      );
    } else if (id === "gen-garage") {
      saveChildObservation("generator", "Child initially thought a garage was safe for a running generator.");
      this.karaSay(
        tierText(
          this.ageTier,
          "Actually, never in the garage, even with the door open — the gas can hurt you without you smelling it. Always outside.",
          "Actually, never — even in a garage with the door open. It makes carbon monoxide, and you can't see or smell it building up. Always run it outside, away from windows and doors.",
          "Actually, never — even in a garage with the door open, carbon monoxide can build up fast without any smell to warn you. Always run it outside, well away from windows and doors.",
        ),
      );
    } else if (id === "medkit-know") {
      saveChildObservation("medkit", "Child knows what's in the first-aid kit.");
      this.karaSay(
        tierText(
          this.ageTier,
          "Great! Bandages are for small cuts and scrapes.",
          "Great. Just remember: it's for small cuts and scrapes — a grown-up handles anything bigger.",
          "Good — it's for small cuts and scrapes; anything bigger is a grown-up's job, every time.",
        ),
      );
    } else if (id === "medkit-not-sure") {
      saveChildObservation("medkit", "Child is unsure what's in the first-aid kit.");
      this.karaSay(
        tierText(
          this.ageTier,
          "That's okay. Ask a grown-up to show you what's inside.",
          "That’s okay. Ask a grown-up to go through it with you sometime, so it's not new if you ever need it.",
          "Fair enough — ask a grown-up to walk through it with you once, so nothing's a surprise later.",
        ),
      );
    } else if (id === "radio-know") {
      saveChildObservation("radio", "Child knows how to use the emergency radio.");
      this.karaSay(
        tierText(
          this.ageTier,
          "Nice! It works even when the power is out.",
          "Nice. It keeps working on batteries or a hand crank, so you can still hear news with no power.",
          "Good to know — battery or hand-crank power means it still works when the outlets and cell towers don't.",
        ),
      );
    } else if (id === "radio-not-sure") {
      saveChildObservation("radio", "Child is unsure how to use the emergency radio.");
      this.karaSay(
        tierText(
          this.ageTier,
          "That's okay. Ask a grown-up to show you the switch.",
          "That’s okay. Ask a grown-up to show you the switch — it's usually just batteries or a hand crank.",
          "That's fine — ask a grown-up to show you once; it's almost always just batteries or a hand crank.",
        ),
      );
    } else if (id === "whistle-try") {
      saveChildObservation("whistle", "Child practiced the three-blast help signal.");
      gameAudio.success();
      this.karaSay(
        tierText(
          this.ageTier,
          "That's the sound! Three blasts means come find me.",
          "That's it. Three blasts carries a lot farther than shouting, and it doesn't tire out your voice.",
          "Exactly — three blasts carries much farther than shouting, and it won't wear out your voice like yelling would.",
        ),
      );
    } else if (id === "whistle-later") {
      saveChildObservation("whistle", "Child deferred practicing the whistle signal.");
      this.karaSay(
        tierText(
          this.ageTier,
          "Okay. Remember: three blasts means come find me.",
          "Okay. Just remember the pattern: three sharp blasts means come find me.",
          "No rush — just remember the pattern for later: three sharp blasts means come find me.",
        ),
      );
    }
    this.karaMode = "success";
    this.emit();
  }

  private karaSay(text: string) {
    this.talkQueue.push({ speaker: "Kara", text });
    if (!this.dialogue) this.advanceTalk();
  }

  private advanceTalk() {
    const next = this.talkQueue.shift();
    this.dialogue = next ?? null;
    if (this.dialogue && this.talkQueue.length === 0 && this.scheduledChoices) {
      this.pendingChoices = this.scheduledChoices;
      this.scheduledChoices = null;
    }
    // A cut-in always rides along with an active talk sequence (see
    // startFlashlightLesson/startBreakerLesson); once that sequence ends
    // with nothing left to say and no choice pending, release the shot.
    if (!this.dialogue && !this.pendingChoices) this.cutIn = null;
    this.karaMode = this.dialogue ? "teaching" : "idle";
    if (!this.dialogue && this.complete) this.karaMode = "success";
  }

  private held(code: string) {
    if (this.injected) return this.injected.includes(code);
    return this.keys.has(code);
  }

  private loop = (t: number) => {
    if (!this.running) return;
    const dt = Math.min((t - this.last) / 1000, 0.1);
    this.last = t;
    this.acc += dt;
    while (this.acc >= FIXED) {
      this.step(FIXED);
      this.acc -= FIXED;
    }
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private step(dt: number) {
    let dismissed = false;
    if (this.dialogue && this.interactHeld && !this.interactWas && !this.pendingChoices) {
      this.advanceTalk();
      dismissed = true;
    }

    let mx = this.cutIn ? 0 : this.stick.x;
    let my = this.cutIn ? 0 : this.stick.y;
    if (!this.cutIn) {
      if (this.held("KeyA") || this.held("ArrowLeft")) mx -= 1;
      if (this.held("KeyD") || this.held("ArrowRight")) mx += 1;
      if (this.held("KeyW") || this.held("ArrowUp")) my -= 1;
      if (this.held("KeyS") || this.held("ArrowDown")) my += 1;
    }
    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }
    this.vx = mx * SPEED;
    this.vy = my * SPEED;
    if (mag > 0.15) {
      this.yaw = yawFromMove(mx, my);
      if (Math.abs(mx) > Math.abs(my)) this.dir = mx < 0 ? "left" : "right";
      else this.dir = my < 0 ? "up" : "down";
      this.walkT = (this.walkT + dt * 7) % (Math.PI * 2);
      gameAudio.footstep();
      this.idle = 0;
    } else {
      this.walkT = 0;
      this.idle += dt;
    }
    // Ease the mirror flip toward the last horizontal direction instead of snapping,
    // so turning around reads as a smooth turn rather than an instant pop.
    const facingTarget = this.dir === "left" ? -1 : 1;
    this.facingScale += (facingTarget - this.facingScale) * Math.min(1, dt * 12);

    const nx = this.px + this.vx * dt;
    const ny = this.py + this.vy * dt;
    if (this.canStand(nx, this.py)) this.px = nx;
    if (this.canStand(this.px, ny)) this.py = ny;

    const follow = this.reduced ? 1 : 1 - Math.pow(0.001, dt);
    this.camX += (this.px - this.camX) * follow;
    this.camY += (this.py - this.camY) * follow;
    const cutRate = this.reduced ? 4 : 1.7;
    this.cutInT = this.cutIn
      ? Math.min(1, this.cutInT + dt * cutRate)
      : Math.max(0, this.cutInT - dt * 2.4);
    this.updateKara(dt);
    this.shake = Math.max(0, this.shake - dt * 18);

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    const just = this.interactHeld && !this.interactWas;
    this.interactWas = this.interactHeld;
    if (!this.held("KeyE") && !this.held("Space")) this.interactHeld = false;

    if (just && !this.dialogue && !dismissed) this.tryInteract();

    if (this.idle > 14 && !this.complete && !this.dialogue && !this.cutIn) {
      this.idle = 0;
      const next = this.steps.find((st) => !st.done);
      if (next && this.hintedStep !== next.id) {
        this.hintedStep = next.id;
        this.nudgeCount += 1;
        this.karaMode = "attention";
        this.karaSay(next.hint);
        gameAudio.kara();
      }
    }

    this.emit();
  }

  private emitMove() {
    const follow = 0.2;
    this.camX += (this.px - this.camX) * follow;
    this.camY += (this.py - this.camY) * follow;
  }

  private canStand(x: number, y: number) {
    const onWalk = this.world.walk.some((r) => pointInRect(x, y, r));
    if (!onWalk) return false;
    for (const p of this.world.props) {
      if (!p.collide || this.hiddenProps.has(p.id)) continue;
      const body: Rect = { x: p.x + 8, y: p.y + p.h * 0.45, w: p.w - 16, h: p.h * 0.5 };
      if (circleHitsRect(x, y, PLAYER_R, body)) return false;
    }
    return true;
  }

  private nearby(): Interactable | null {
    let best: Interactable | null = null;
    let bestD = 9999;
    for (const it of this.world.interactables) {
      if (this.hiddenProps.has(it.id)) continue;
      if (it.kind === "family" && it.memberId === this.playerId) continue;
      if (it.kind === "pickup" && it.item && this.collected.has(it.item)) continue;
      const d = Math.hypot(it.x - this.px, it.y - this.py);
      if (d < it.r && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }

  private mark(id: string) {
    this.steps = this.steps.map((s) => (s.id === id ? { ...s, done: true } : s));
  }

  private tryInteract() {
    const n = this.nearby();
    if (!n) return;
    if (n.kind === "pickup" && n.item) {
      this.collected.add(n.item);
      this.hiddenProps.add(n.id);
      this.burst(n.x, n.y);
      gameAudio.pickup();
      this.mark(`kit-${n.item}`);
      if (n.item === "flashlight") {
        this.flashlight = true;
        this.mark("flashlight");
        this.startFlashlightLesson(this.drill === "power-out", n.x, n.y);
      } else if (n.item === "water") {
        this.startWaterLesson();
      } else if (n.item === "medkit") {
        this.startMedkitLesson();
      } else if (n.item === "radio") {
        this.startRadioLesson();
      } else if (n.item === "whistle") {
        this.startWhistleLesson();
      }
      this.maybeFinish();
      return;
    }
    if (n.kind === "breaker") {
      this.breakersDone = true;
      this.mark("breaker");
      gameAudio.click();
      this.startBreakerLesson(n.x, n.y);
      this.maybeFinish();
      return;
    }
    if (n.kind === "generator") {
      this.generatorDone = true;
      this.mark("generator");
      this.powerOut = false;
      gameAudio.success();
      this.startGeneratorLesson();
      this.maybeFinish();
      return;
    }
    if (n.kind === "neighbor") {
      this.neighborTalked = true;
      this.mark("find-neighbor");
      this.mark("talk-neighbor");
      const nb = this.profile.neighbors[0];
      this.dialogue = {
        speaker: nb?.name ?? "Neighbor",
        text: nb
          ? `Hi ${this.playerName}. If you ever need help, come find me. ${nb.note}`
          : `Hi ${this.playerName}. You can knock any time.`,
      };
      gameAudio.success();
      this.maybeFinish();
      return;
    }
    if (n.kind === "family" && n.memberId) {
      this.checked.add(n.memberId);
      this.mark(`find-${n.memberId}`);
      this.dialogue = {
        speaker: n.label,
        text: `I'm okay, ${this.playerName}. See you at ${this.profile.plan.meetingPlace}.`,
      };
      gameAudio.pickup();
      this.maybeFinish();
      return;
    }
    if (n.kind === "kit-station") {
      const have = this.effectiveKitItems.every((id) => this.collected.has(id));
      if (have) {
        this.mark("station");
        this.dialogue = {
          speaker: "Kara",
          text: "Kit corner is stocked. That's exactly how the family plan is written.",
        };
        gameAudio.success();
        this.maybeFinish();
      } else {
        this.dialogue = {
          speaker: "Kara",
          text: "Not yet — look at the list and keep searching the house.",
        };
      }
      return;
    }
    if (n.kind === "rally") {
      const others = this.profile.members.filter((m) => m.id !== this.playerId);
      const all = others.every((m) => this.checked.has(m.id));
      if (this.drill === "rally" && all) {
        this.mark("meeting");
        this.dialogue = {
          speaker: "Kara",
          text: `This is your family meeting place. If everyone gets separated, this is where your plan says to meet.`,
        };
        gameAudio.success();
        this.maybeFinish();
      } else if (this.drill === "rally") {
        this.dialogue = {
          speaker: "Kara",
          text: "Good, you found the meeting place. Check on the rest of the family first.",
        };
      }
    }
  }

  private maybeFinish() {
    if (this.drill === "power-out") {
      const needGen = this.profile.plan.hasGenerator;
      if (this.flashlight && this.breakersDone && (!needGen || this.generatorDone)) {
        this.mark("done");
        this.complete = true;
        if (!this.profile.plan.hasGenerator) this.powerOut = false;
      }
    } else if (this.drill === "pack-kit") {
      if (
        this.effectiveKitItems.every((id) => this.collected.has(id)) &&
        this.steps.find((s) => s.id === "station")?.done
      ) {
        this.complete = true;
      }
    } else if (this.drill === "neighbor") {
      if (this.neighborTalked) this.complete = true;
    } else if (this.drill === "rally") {
      if (this.steps.every((s) => s.done)) this.complete = true;
    }
    if (this.complete && !this.finishPosted) {
      this.finishPosted = true;
      // Every drill finishes once its steps are done — there's no fail state.
      // Stars instead reflect how independently the child got there: fewer
      // nudges from Kara means a higher rating, not a faster or "correcter" run.
      const stars = this.nudgeCount === 0 ? 3 : this.nudgeCount <= 2 ? 2 : 1;
      const summary = this.summaryText();
      window.setTimeout(() => this.onComplete?.(stars, summary), 900);
    }
  }

  private summaryText() {
    if (this.drill === "power-out") {
      return `${this.playerName} practiced the lights-out plan: flashlight first, then the breakers${this.profile.plan.hasGenerator ? ", then the generator" : ""}.`;
    }
    if (this.drill === "pack-kit") {
      return `${this.playerName} gathered the ${this.profile.familyName} kit and brought it to the kit corner.`;
    }
    if (this.drill === "neighbor") {
      const n = this.profile.neighbors[0];
      return `${this.playerName} practiced checking in with ${n?.name ?? "the neighbor"}.`;
    }
    return `${this.playerName} accounted for the family and met at ${this.profile.plan.meetingPlace}.`;
  }

  private burst(x: number, y: number) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * 40,
        vy: Math.sin(a) * 40,
        life: 0.45,
      });
    }
  }

  private startFlashlightLesson(afterOutage: boolean, x?: number, y?: number) {
    if (this.taught.has("flashlight")) {
      this.karaSay(
        afterOutage
          ? "Good. Now we can see. Next stop: the breaker panel in the utility room."
          : `You found the flashlight. ${this.collected.size} of ${this.profile.plan.kitItems.length} kit items.`,
      );
      return;
    }
    this.taught.add("flashlight");
    // First time only: a short staged close-up on the flashlight, then back to
    // normal play once the battery check is answered (see chooseLesson).
    if (x != null && y != null) this.cutIn = { x, y };
    this.talkQueue = [
      { speaker: "Kara", text: "Oh! You found the flashlight." },
      { speaker: "Kara", text: "A flashlight only helps if it works when you need it." },
      { speaker: "Kara", text: "Check the batteries." },
    ];
    if (afterOutage) {
      this.talkQueue.push({
        speaker: "Kara",
        text: "When you are done checking, next stop is the breaker panel in the utility room.",
      });
    }
    this.scheduledChoices = [
      { id: "flash-ok", label: "Checked" },
      { id: "flash-batteries", label: "Needs batteries" },
    ];
    this.advanceTalk();
  }

  private startBreakerLesson(x?: number, y?: number) {
    if (this.taught.has("breaker")) {
      this.karaSay(
        this.profile.plan.hasGenerator
          ? "Breakers are set. If the power stays off, we start the generator next."
          : "Breakers are set. In an apartment, the building crew handles the rest. You did your part.",
      );
      return;
    }
    this.taught.add("breaker");
    saveChildObservation("breaker", "Child learned why breakers get shut off before the power comes back.");
    // Same staged close-up treatment as the flashlight: a beat on the panel
    // itself while Kara and the player talk it through, then back to normal
    // play once the exchange ends (cutIn clears itself in advanceTalk once
    // the queue drains with no choices left to show).
    if (x != null && y != null) this.cutIn = { x, y };
    this.talkQueue = [
      { speaker: this.playerName, text: "Ok Kara, I'm at the breaker. What do you want me to do?" },
      {
        speaker: "Kara",
        text: tierText(
          this.ageTier,
          "Go get a grown-up, and do this together. Once they're here, you'll turn off the main switch, then every other breaker.",
          "Go get a parent, and let's do this together. Once they're here, you'll turn off the main switch, then turn every breaker off.",
          "Go get a parent, and let's do this together. Once they're here, you'll turn off the main switch, then turn off every breaker.",
        ),
      },
      { speaker: this.playerName, text: "What's the point?" },
      {
        speaker: "Kara",
        text: tierText(
          this.ageTier,
          "It keeps your home's power from sneaking back out onto the lines outside, where it could really hurt someone fixing them.",
          "It lowers the chance of power feeding back out onto the grid — which could badly hurt a line worker out there trying to restore it.",
          "It reduces the chance of backfeed into the grid, which could seriously injure a line worker out there trying to restore power.",
        ),
      },
      { speaker: this.playerName, text: "Ok, I understand now." },
    ];
    this.advanceTalk();
  }

  private startWaterLesson() {
    if (this.taught.has("water")) {
      this.karaSay(`You found the water. ${this.collected.size} of ${this.profile.plan.kitItems.length} kit items.`);
      return;
    }
    this.taught.add("water");
    this.talkQueue = [
      { speaker: "Kara", text: "You found the water. Do you know where your family keeps extra?" },
    ];
    this.scheduledChoices = [
      { id: "water-yes", label: "Yes" },
      { id: "water-not-sure", label: "Not sure" },
    ];
    this.advanceTalk();
  }

  private startGeneratorLesson() {
    if (this.taught.has("generator")) {
      this.karaSay(
        "This home has a backup generator. It can help power some things during an outage, but not everything.",
      );
      return;
    }
    this.taught.add("generator");
    this.talkQueue = [
      {
        speaker: "Kara",
        text: "This home has a backup generator. It can help power some things during an outage, but not everything.",
      },
      {
        speaker: "Kara",
        text: "It also makes a gas you can't see or smell. Where should it always run?",
      },
    ];
    this.scheduledChoices = [
      { id: "gen-outside", label: "Outside, away from windows" },
      { id: "gen-garage", label: "In the garage" },
    ];
    this.advanceTalk();
  }

  private startMedkitLesson() {
    if (this.taught.has("medkit")) {
      this.karaSay(`You found the first-aid kit. ${this.collected.size} of ${this.profile.plan.kitItems.length} kit items.`);
      return;
    }
    this.taught.add("medkit");
    this.talkQueue = [
      { speaker: "Kara", text: "You found the first-aid kit. Do you know what's inside, like where the bandages are?" },
    ];
    this.scheduledChoices = [
      { id: "medkit-know", label: "Yes" },
      { id: "medkit-not-sure", label: "Not sure" },
    ];
    this.advanceTalk();
  }

  private startRadioLesson() {
    if (this.taught.has("radio")) {
      this.karaSay(`You found the radio. ${this.collected.size} of ${this.profile.plan.kitItems.length} kit items.`);
      return;
    }
    this.taught.add("radio");
    this.talkQueue = [
      {
        speaker: "Kara",
        text: "This radio doesn't need a wall plug. Do you know how to turn it on?",
      },
    ];
    this.scheduledChoices = [
      { id: "radio-know", label: "Yes" },
      { id: "radio-not-sure", label: "Not sure" },
    ];
    this.advanceTalk();
  }

  private startWhistleLesson() {
    if (this.taught.has("whistle")) {
      this.karaSay(`You found the whistle. ${this.collected.size} of ${this.profile.plan.kitItems.length} kit items.`);
      return;
    }
    this.taught.add("whistle");
    this.talkQueue = [
      { speaker: "Kara", text: "Three sharp blasts on this whistle means \"come find me.\" Want to try it?" },
    ];
    this.scheduledChoices = [
      { id: "whistle-try", label: "Try it" },
      { id: "whistle-later", label: "Later" },
    ];
    this.advanceTalk();
  }

  private currentHint() {
    const next = this.steps.find((s) => !s.done);
    return next?.hint ?? "You finished this drill.";
  }

  private emit() {
    const n = this.nearby();
    const hud: HudState = {
      roomName: roomAt(this.world, this.px, this.py)?.name ?? "House",
      nearby: n,
      steps: this.steps,
      powerOut: this.powerOut,
      flashlight: this.flashlight,
      collected: [...this.collected],
      dialogue: this.dialogue,
      choices: this.pendingChoices,
      complete: this.complete,
      hint: this.currentHint(),
      prompt: n ? n.label : null,
      playerName: this.playerName,
      cutIn: !!this.cutIn,
    };
    const key = `${hud.roomName}|${n?.id ?? ""}|${hud.hint}|${hud.dialogue?.text ?? ""}|${(hud.choices ?? []).map((c) => c.id).join(",")}|${this.steps.map((s) => (s.done ? 1 : 0)).join("")}|${hud.prompt ?? ""}|${hud.cutIn ? 1 : 0}`;
    if (key === this.hudKey) return;
    this.hudKey = key;
    this.onHud?.(hud);
  }

  private zoom() {
    const cssW = this.canvas.clientWidth;
    return cssW < 500 ? 0.5 : 0.55;
  }

  private static easeInOut(t: number) {
    return t * t * (3 - 2 * t);
  }

  private draw() {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#2a3a2c";
    ctx.fillRect(0, 0, w, h);

    const t = ReadyEngine.easeInOut(this.cutInT);
    const baseZ = this.zoom();
    const closeZ = baseZ * 4.2;
    const z = baseZ + (closeZ - baseZ) * t;

    // Close-up focuses a little above the pickup point (chest/face height, not the floor icon).
    const targetX = this.cutIn?.x ?? this.px;
    const targetY = (this.cutIn?.y ?? this.py) - 30;
    const fx = this.camX + (targetX - this.camX) * t;
    const fy = this.camY + (targetY - this.camY) * t;

    // A low/near-floor look: the further into the cut-in, the lower the focus
    // point sits in frame, as if the camera rose up from near the ground.
    const anchorY = h / 2 + (h * 0.7 - h / 2) * t;

    const sx = this.reduced || t > 0.05 ? 0 : (Math.random() - 0.5) * this.shake;
    const sy = this.reduced || t > 0.05 ? 0 : (Math.random() - 0.5) * this.shake;
    ctx.save();
    ctx.translate(w / 2 + sx, anchorY + sy);
    ctx.scale(z, z);
    ctx.translate(-fx, -fy);

    this.drawRooms(ctx);
    const drawables: { y: number; draw: () => void }[] = [];
    for (const p of this.world.props) {
      if (this.hiddenProps.has(p.id)) continue;
      drawables.push({ y: p.y + p.h, draw: () => this.drawProp(ctx, p) });
    }
    for (const it of this.world.interactables) {
      if (it.kind === "neighbor") {
        drawables.push({ y: it.y + 20, draw: () => this.drawNeighbor(ctx, it) });
      }
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();
    for (const it of this.world.interactables) {
      if (it.kind === "family" && it.memberId !== this.playerId && !this.checked.has(it.memberId ?? "")) {
        this.drawPawn(ctx, it);
      }
    }
    this.drawPlayer(ctx);

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = "#f3eee4";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (this.powerOut) this.drawDark(ctx, w, h, z);
    if (t > 0.01) this.drawCutInLight(ctx, fx, fy, t);

    ctx.restore();

    if (t > 0.01) this.drawCutInVignette(ctx, w, h, t);
  }

  /** Warm spotlight on the staged subject, in world space (moves with the scene). */
  private drawCutInLight(ctx: CanvasRenderingContext2D, fx: number, fy: number, t: number) {
    const r = 420;
    const g = ctx.createRadialGradient(fx, fy - 10, 20, fx, fy - 10, r);
    g.addColorStop(0, `rgba(255, 224, 176, ${0.34 * t})`);
    g.addColorStop(0.45, `rgba(255, 196, 132, ${0.14 * t})`);
    g.addColorStop(1, "rgba(20, 16, 10, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(fx - r, fy - r, r * 2, r * 2);
  }

  /** Cinematic frame darkening, in screen space (fixed, doesn't move with the scene). */
  private drawCutInVignette(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
    const g = ctx.createRadialGradient(
      w / 2,
      h * 0.62,
      Math.min(w, h) * 0.18,
      w / 2,
      h * 0.55,
      Math.max(w, h) * 0.75,
    );
    g.addColorStop(0, "rgba(10, 8, 6, 0)");
    g.addColorStop(1, `rgba(8, 6, 4, ${0.55 * t})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  private drawRooms(ctx: CanvasRenderingContext2D) {
    const ground = this.images.grass ?? this.images.forest ?? this.images.wood;
    if (ground) {
      const tw = 220;
      for (let x = -40; x < this.world.width + 40; x += tw) {
        for (let y = -40; y < this.world.height + 40; y += tw) {
          ctx.drawImage(ground, x, y, tw, tw);
        }
      }
    } else {
      ctx.fillStyle = "#3d5a40";
      ctx.fillRect(-40, -40, this.world.width + 80, this.world.height + 80);
    }

    for (const room of this.world.rooms) {
      const outdoor = room.id === "yard";
      const img = this.images[room.floor];
      ctx.save();
      ctx.beginPath();
      ctx.rect(room.x, room.y, room.w, room.h);
      ctx.clip();
      if (img) {
        const tw = 160;
        for (let x = room.x; x < room.x + room.w; x += tw) {
          for (let y = room.y; y < room.y + room.h; y += tw) {
            ctx.drawImage(img, x, y, tw, tw);
          }
        }
      } else {
        ctx.fillStyle = outdoor ? "#6a8a58" : "#e6d9c4";
        ctx.fillRect(room.x, room.y, room.w, room.h);
      }
      if (!outdoor) {
        const g = ctx.createRadialGradient(
          room.x + room.w * 0.5,
          room.y + room.h * 0.35,
          20,
          room.x + room.w * 0.5,
          room.y + room.h * 0.5,
          Math.max(room.w, room.h) * 0.72,
        );
        g.addColorStop(0, "rgba(255, 220, 172, 0.22)");
        g.addColorStop(0.6, "rgba(255, 200, 140, 0.08)");
        g.addColorStop(1, "rgba(36, 24, 16, 0.2)");
        ctx.fillStyle = g;
        ctx.fillRect(room.x, room.y, room.w, room.h);
      }
      ctx.restore();

      if (!outdoor) this.drawRoomDecor(ctx, room);

      ctx.lineJoin = "round";
      ctx.strokeStyle = "#6a5340";
      ctx.lineWidth = 16;
      ctx.strokeRect(room.x + 8, room.y + 8, room.w - 16, room.h - 16);
      ctx.strokeStyle = "#c4b49a";
      ctx.lineWidth = 6;
      ctx.strokeRect(room.x + 11, room.y + 11, room.w - 22, room.h - 22);
      if (!outdoor) {
        ctx.strokeStyle = "rgba(63, 47, 34, 0.4)";
        ctx.lineWidth = 4;
        ctx.strokeRect(room.x + 17, room.y + 17, room.w - 34, room.h - 34);
      }

      ctx.fillStyle = outdoor ? "rgba(245, 240, 230, 0.72)" : "rgba(255, 248, 236, 0.78)";
      ctx.font = "600 13px Nunito, sans-serif";
      ctx.fillText(room.name, room.x + 22, room.y + 32);
    }
    for (const r of this.world.walk) {
      if (r.w < 90 || r.h < 90) {
        const img = this.images.wood;
        if (img) ctx.drawImage(img, r.x, r.y, r.w, r.h);
      }
    }
  }

  /** Restrained, low-cost decor so rooms read as finished rather than blocked out. */
  private drawRoomDecor(ctx: CanvasRenderingContext2D, room: Rect & { id: string }) {
    const rugRooms: Record<string, { color: string; edge: string }> = {
      bedroom: { color: "#c9dce6", edge: "#9db8c6" },
      kidsroom: { color: "#f0d9a6", edge: "#cdaf6f" },
      living: { color: "#d9c9a6", edge: "#b79f76" },
      bathroom: { color: "#cfe3df", edge: "#a9c4bd" },
      hall: { color: "#c9a678", edge: "#a8825a" },
    };
    const rug = rugRooms[room.id];
    if (rug) {
      const rw = Math.min(room.w * 0.34, 170);
      const rh = Math.min(room.h * 0.22, 96);
      const rx = room.x + room.w * 0.6;
      const ry = room.y + room.h - rh - 34;
      const radius = 14;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "rgba(20, 14, 8, 0.14)";
      ctx.beginPath();
      ctx.roundRect(rx + 4, ry + 6, rw, rh, radius);
      ctx.fill();
      ctx.fillStyle = rug.color;
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, radius);
      ctx.fill();
      ctx.strokeStyle = rug.edge;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(rx + 6, ry + 6, rw - 12, rh - 12, radius * 0.6);
      ctx.stroke();
      ctx.restore();
    }

    const frameRooms = new Set(["living", "kitchen", "bedroom", "kidsroom"]);
    if (frameRooms.has(room.id) && room.w > 200) {
      const fx = room.x + room.w * 0.5 - 22;
      const fy = room.y + 24;
      ctx.save();
      ctx.fillStyle = "#5a4530";
      ctx.fillRect(fx, fy, 44, 32);
      ctx.fillStyle = "#eadfc8";
      ctx.fillRect(fx + 4, fy + 4, 36, 24);
      ctx.strokeStyle = "rgba(90, 69, 48, 0.55)";
      ctx.lineWidth = 1;
      ctx.strokeRect(fx + 4, fy + 4, 36, 24);
      ctx.restore();
    }
  }

  private drawProp(ctx: CanvasRenderingContext2D, p: { kind: string; x: number; y: number; w: number; h: number }) {
    ctx.fillStyle = "rgba(30, 24, 16, 0.22)";
    ctx.beginPath();
    ctx.ellipse(p.x + p.w / 2, p.y + p.h - 4, p.w * 0.42, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    const img = this.images[p.kind];
    if (img) {
      ctx.drawImage(img, p.x, p.y, p.w, p.h);
      return;
    }
    ctx.fillStyle = "#8a9188";
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }

  private drawSheet(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    cols: number,
    rows: number,
    col: number,
    row: number,
    x: number,
    y: number,
    dw: number,
    dh: number,
  ) {
    const cw = img.width / cols;
    const ch = img.height / rows;
    ctx.drawImage(img, col * cw, row * ch, cw, ch, x, y, dw, dh);
  }

  private kidSheet(): HTMLImageElement | undefined {
    const n = this.playerName.toLowerCase();
    if (n.includes("leo") || n.includes("sam") || n.includes("jordan")) return this.images.leo;
    return this.images.maya;
  }

  /**
   * maya.png/leo.png are single static full-body portraits (no walk-cycle
   * frames), so this can't swap in real animated art. Instead it cuts each
   * portrait into a torso piece and two leg pieces at the hip line and
   * swings the legs as pendulums around the hip pivot (in opposite phase),
   * with a small counter-rotating torso sway so the arms read as
   * coordinated rather than static. Because each leg pivots from the hip,
   * the foot is lowest (grounded) at the middle of its swing and lifts
   * away from the ground at the extremes — it plants instead of sliding.
   * walkT is 0 whenever the player isn't moving, which collapses every
   * angle back to 0 for a clean idle pose.
   */
  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const img = this.kidSheet();
    if (img) {
      const w = img.width;
      const h = img.height;
      const hipY = Math.round(h * 0.62);
      const overlap = 3;
      const legW = w / 2;
      const legH = h - hipY + overlap;

      const walking = !this.reduced && this.walkT > 0;
      const legSwing = walking ? Math.sin(this.walkT) * 0.4 : 0;
      const legSwingOpp = walking ? Math.sin(this.walkT + Math.PI) * 0.4 : 0;
      const torsoSway = walking ? Math.sin(this.walkT + Math.PI / 2) * 0.07 : 0;
      const bob = walking
        ? Math.abs(Math.sin(this.walkT * 2)) * -2.5
        : this.reduced
          ? 0
          : Math.sin(this.idle * 1.4) * 0.6;

      const topY = this.py - h + 8 + bob;
      const hipScreenY = topY + hipY;

      ctx.save();
      ctx.translate(this.px, 0);
      ctx.scale(this.facingScale, 1);

      // Left leg (image-space), pivoting at the hip.
      ctx.save();
      ctx.translate(-w / 2 + legW / 2, hipScreenY);
      ctx.rotate(legSwing);
      ctx.drawImage(img, 0, hipY - overlap, legW, legH, -legW / 2, -overlap, legW, legH);
      ctx.restore();

      // Right leg (image-space), opposite phase.
      ctx.save();
      ctx.translate(w / 2 - legW / 2, hipScreenY);
      ctx.rotate(legSwingOpp);
      ctx.drawImage(img, legW, hipY - overlap, legW, legH, -legW / 2, -overlap, legW, legH);
      ctx.restore();

      // Torso + arms + head, swaying gently opposite the legs.
      ctx.save();
      ctx.translate(0, hipScreenY);
      ctx.rotate(torsoSway);
      ctx.drawImage(img, 0, 0, w, hipY + overlap, -w / 2, -hipY, w, hipY + overlap);
      ctx.restore();

      ctx.restore();
    }
    this.drawKara(ctx);
  }

  private objectivePoint(): { x: number; y: number } | null {
    const next = this.steps.find((st) => !st.done);
    if (!next) return null;
    const items = this.world.interactables;
    const hit =
      items.find((it) => next.id === "flashlight" && it.item === "flashlight") ||
      items.find((it) => next.id === "breaker" && it.kind === "breaker") ||
      items.find((it) => next.id === "generator" && it.kind === "generator") ||
      items.find((it) => next.id.startsWith("kit-") && it.item === next.id.slice(4)) ||
      items.find((it) => next.id === "station" && it.kind === "kit-station") ||
      items.find((it) => (next.id === "find-neighbor" || next.id === "talk-neighbor") && it.kind === "neighbor") ||
      items.find((it) => next.id.startsWith("find-") && it.memberId === next.id.slice(5)) ||
      items.find((it) => next.id === "meeting" && it.kind === "rally");
    return hit ? { x: hit.x, y: hit.y } : null;
  }

  private updateKara(dt: number) {
    const near = this.nearby();
    const obj = this.objectivePoint();
    let tx = this.px + 56;
    let ty = this.py - 138;
    if (near) {
      this.karaMode = this.dialogue ? "teaching" : "attention";
      tx = this.px + 8;
      ty = this.py - 102;
    } else if (obj && !this.dialogue) {
      this.karaMode = "guiding";
      const dx = obj.x - this.px;
      const dy = obj.y - this.py;
      const m = Math.hypot(dx, dy) || 1;
      tx = this.px + 22 + (dx / m) * 22;
      ty = this.py - 130 + (dy / m) * 6;
    } else if (this.complete) {
      this.karaMode = "success";
    } else {
      this.karaMode = "idle";
    }
    if (this.karaMode === "idle" && !this.reduced) {
      const t = performance.now() / 1000;
      tx += Math.sin(t * 1.15) * 10;
      ty += Math.cos(t * 0.9) * 6;
    }
    const rate = this.reduced ? 1 : Math.min(1, dt * 5.2);
    this.kx += (tx - this.kx) * rate;
    this.ky += (ty - this.ky) * rate;
    for (const p of this.karaDust) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 38 * dt;
      p.life -= dt;
    }
    this.karaDust = this.karaDust.filter((p) => p.life > 0);
  }

  private drawKara(ctx: CanvasRenderingContext2D) {
    const t = performance.now() / 1000;
    const teaching = this.karaMode === "teaching" || !!this.dialogue;
    const bob = this.reduced || teaching ? 0 : Math.sin(t * 2.2) * 4;
    const cx = this.kx;
    const cy = this.ky + bob;
    const r = 8;
    const obj = this.objectivePoint();
    let spin = this.reduced || teaching ? 0 : Math.sin(t * 0.7) * 0.12;
    if (obj && !teaching) {
      spin = Math.atan2(obj.y - cy, obj.x - cx) * 0.12;
    }
    drawKaraRose(ctx, cx, cy, 9, { glow: 1, spin });

    if (!this.reduced) {
      if (Math.random() < 0.9) {
        this.karaDust.push({
          x: cx + (Math.random() - 0.5) * 16,
          y: cy + 5,
          vx: (Math.random() - 0.5) * 20,
          vy: 16 + Math.random() * 28,
          life: 0.9 + Math.random() * 0.8,
          s: 0.7 + Math.random() * 2,
        });
      }
      for (const p of this.karaDust) {
        ctx.fillStyle = `rgba(255, 236, 170, ${Math.max(0, p.life)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  private drawNeighbor(ctx: CanvasRenderingContext2D, it: Interactable) {
    const img = this.images.neighbor;
    const f = Math.floor(performance.now() / 240) % 4;
    if (img) this.drawSheet(ctx, img, 2, 2, f % 2, Math.floor(f / 2), it.x - 26, it.y - 58, 52, 64);
    ctx.fillStyle = "#1b2430";
    ctx.font = "700 11px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(it.label, it.x, it.y + 18);
    ctx.textAlign = "left";
  }

  private drawPawn(ctx: CanvasRenderingContext2D, it: Interactable) {
    const name = (it.label ?? "").toLowerCase();
    const leo = name.includes("leo") || name.includes("sam") || name.includes("jordan");
    const maya = name.includes("maya") || name.includes("sofia");
    const kid = leo ? this.images.leo : maya ? this.images.maya : undefined;
    // Per-pawn phase (from position, so it's stable across frames) keeps
    // idle pawns from bobbing in lockstep with each other or the player.
    const phase = (it.x * 0.013 + it.y * 0.021) % (Math.PI * 2);
    const bob = this.reduced ? 0 : Math.sin(performance.now() / 850 + phase) * 1.6;
    if (kid) {
      ctx.drawImage(kid, it.x - kid.width / 2, it.y - kid.height + 8 + bob, kid.width, kid.height);
    } else {
      ctx.fillStyle = "#3e6b56";
      ctx.beginPath();
      ctx.arc(it.x, it.y - 22 + bob, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#dce8e1";
      ctx.beginPath();
      ctx.arc(it.x, it.y - 22 + bob, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3e6b56";
      ctx.beginPath();
      ctx.ellipse(it.x, it.y - 4 + bob, 12, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#1b2430";
    ctx.font = "700 11px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(it.label, it.x, it.y + 16);
    ctx.textAlign = "left";
  }

  private drawDark(ctx: CanvasRenderingContext2D, cssW: number, cssH: number, z: number) {
    const pad = Math.max(cssW, cssH) / z + 80;
    ctx.fillStyle = "rgba(12, 18, 28, 0.38)";
    ctx.fillRect(this.camX - pad, this.camY - pad, pad * 2, pad * 2);
    const radius = this.flashlight ? 260 : 170;
    const g = ctx.createRadialGradient(this.px, this.py - 12, 12, this.px, this.py - 12, radius);
    g.addColorStop(0, "rgba(255, 214, 150, 0.32)");
    g.addColorStop(0.35, "rgba(255, 190, 110, 0.12)");
    g.addColorStop(1, "rgba(255, 190, 110, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(this.camX - pad, this.camY - pad, pad * 2, pad * 2);
  }

  private installProbe() {
    window.__controlsTest = {
      getYaw: () => this.yaw,
      getSpeed: () => Math.hypot(this.vx, this.vy),
      setKeys: (codes: string[]) => {
        this.injected = codes;
        if (codes.length) this.dialogue = null;
      },
      teleport: (x: number, y: number) => {
        this.px = x;
        this.py = y;
        this.camX = x;
        this.camY = y;
      },
      debug: () => ({
        dialogue: this.dialogue,
        pendingChoices: this.pendingChoices,
        cutIn: this.cutIn,
        cutInT: this.cutInT,
        px: this.px,
        py: this.py,
        collected: [...this.collected],
      }),
    };
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys?: (codes: string[]) => void;
      teleport?: (x: number, y: number) => void;
      debug?: () => unknown;
    };
    ReadyHouse?: {
      loadProfile: (p: FamilyProfile) => void;
      loadCustomerId: (id: string) => boolean;
    };
  }
}
