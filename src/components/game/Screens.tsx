import { useEffect, useRef, useState } from "react";
import {
  Building2,
  House,
  Sun,
  TreePine,
  ArrowRight,
  Plus,
  Check,
  Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DEMO_PROFILES, KIT_OPTIONS, blankProfile, defaultKitFor, shellsFor } from "@/lib/game/profiles";
import { drillsFor } from "@/lib/game/missions";
import { useGameStore } from "@/lib/game/store";
import { gameAudio } from "@/lib/game/audio";
import {
  DRILL_META,
  HOME_LABELS,
  KIT_LABELS,
  SHELL_BLURB,
  SHELL_LABELS,
  type DrillId,
  type FamilyMember,
  type FamilyProfile,
  type HomeType,
} from "@/lib/game/types";
import { cn } from "@/lib/utils";

function unlock() {
  gameAudio.unlock();
}

function trainerMode() {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search);
  return q.get("trainer") === "1" || q.get("dev") === "1";
}

function CloudSvg() {
  return (
    <svg viewBox="0 0 1200 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        fill="rgba(255, 246, 232, 0.28)"
        d="M70 86c-28 0-46-18-46-36 0-22 18-36 40-34 8-22 36-34 58-22 14-16 46-18 62-2 22-10 50 2 54 24 24 2 40 20 36 38-4 22-26 34-50 32H70z"
      />
      <path
        fill="rgba(255, 250, 240, 0.22)"
        d="M430 92c-32 0-52-16-54-38-2-22 16-38 40-36 10-20 40-30 62-16 18-18 54-16 68 4 24-12 56 4 58 28 26 0 42 20 38 38-4 20-24 32-50 30H430z"
      />
      <path
        fill="rgba(236, 228, 214, 0.2)"
        d="M820 80c-26 0-44-14-46-32-2-20 14-34 36-32 8-18 34-28 54-14 16-14 46-14 58 4 20-10 48 4 50 24 22 2 36 18 32 34-4 18-22 28-44 26H820z"
      />
    </svg>
  );
}

function TitleClouds() {
  return (
    <div className="title-clouds" aria-hidden="true">
      <div className="title-cloud-strip title-keep-motion" style={{ top: "8%", animationDuration: "70s" }}>
        <CloudSvg />
        <CloudSvg />
      </div>
      <div className="title-cloud-strip title-keep-motion" style={{ top: "28%", animationDuration: "110s", opacity: 0.75 }}>
        <CloudSvg />
        <CloudSvg />
      </div>
    </div>
  );
}

function KaraMark({ uid }: { uid: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-halo`} cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#ffe7a8" stopOpacity="0.9" />
          <stop offset="70%" stopColor="#3e8f82" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#3e8f82" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-brass`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#f0d59a" />
          <stop offset="55%" stopColor="#c9a45a" />
          <stop offset="100%" stopColor="#8a6a32" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${uid}-halo)`} />
      <circle cx="32" cy="32" r="18" fill={`url(#${uid}-brass)`} stroke="#6e5424" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="14" fill="#f4ead4" />
      <path fill="#e2c36a" d="M32 18 L35 32 L32 46 L29 32 Z" />
      <path fill="#e2c36a" d="M18 32 L32 35 L46 32 L32 29 Z" />
      <path fill="#b8893a" d="M22 22 L32 30 L42 22 L34 32 L42 42 L32 34 L22 42 L30 32 Z" />
      <path fill="#3e8f82" d="M32 24 L34 31 L41 32 L34 33 L32 40 L30 33 L23 32 L30 31 Z" />
      <circle cx="32" cy="32" r="2" fill="#f7f1e4" />
    </svg>
  );
}

function TitleKaraOrbit() {
  return (
    <div className="kara-stage">
      <div className="kara-fly kara-fly-back title-keep-motion">
        <KaraMark uid="kb" />
      </div>
      <div className="relative z-10">
        <h1 className="font-display mt-4 text-4xl font-semibold tracking-tight text-primary-fg sm:text-5xl">
          Northstar Guidance
        </h1>
        <p className="mt-1 text-sm font-medium tracking-wide text-primary-fg/70">Event Sim</p>
      </div>
      <div className="kara-fly kara-fly-front title-keep-motion">
        <KaraMark uid="kf" />
        <span className="kara-spark" />
        <span className="kara-spark" />
        <span className="kara-spark" />
      </div>
    </div>
  );
}

const HOME_ICON: Record<HomeType, typeof House> = {
  apartment: Building2,
  city: House,
  country: House,
  desert: Sun,
  forest: TreePine,
};

export function TitleScreen() {
  const loadProfile = useGameStore((s) => s.loadProfile);
  const loadCustomerId = useGameStore((s) => s.loadCustomerId);
  const setScreen = useGameStore((s) => s.setScreen);
  const setDraft = useGameStore((s) => s.setDraft);
  const [cid, setCid] = useState("");
  const [err, setErr] = useState("");
  const trainer = trainerMode();

  return (
    <div className="relative min-h-dvh overflow-hidden bg-night text-primary-fg">
      <img
        src="/game/title-dusk.jpg"
        alt=""
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(18_24_32/0.88)_0%,rgb(18_24_32/0.55)_48%,rgb(18_24_32/0.2)_100%)]" />
      <TitleClouds />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col justify-end gap-8 px-5 py-8 sm:justify-center sm:py-16">
        <div className="max-w-xl">
          <Badge className="bg-primary/20 text-primary-fg">Family continuity training</Badge>
          <TitleKaraOrbit />
          <p className="mt-3 max-w-md text-base text-primary-fg/80 sm:text-lg">
            A calm walk through your own home plan. Kids practice where the kit lives, what to do
            when the lights go out, and who to find.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              size="xl"
              onClick={() => {
                unlock();
                loadProfile(DEMO_PROFILES[0]);
              }}
            >
              Play a demo family
              <ArrowRight />
            </Button>
            {trainer ? (
              <Button
                size="xl"
                variant="secondary"
                className="border-primary-fg/15 bg-primary-fg/10 text-primary-fg hover:bg-primary-fg/16"
                onClick={() => {
                  unlock();
                  setDraft(blankProfile());
                  setScreen("setup");
                }}
              >
                Build your family
              </Button>
            ) : null}
          </div>
        </div>

        {trainer ? (
        <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <Card className="border-primary-fg/10 bg-night/70 text-primary-fg backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-primary-fg">Customer handoff</CardTitle>
              <CardDescription className="text-primary-fg/65">
                Your web app can open this game with a customer id. Try one of the trainer ids, or
                paste your own.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  unlock();
                  const ok = loadCustomerId(cid);
                  setErr(ok ? "" : "No family loaded for that id. Use a demo id below, or build a family.");
                }}
              >
                <Input
                  value={cid}
                  onChange={(e) => setCid(e.target.value)}
                  placeholder="FAM-CHEN"
                  className="border-primary-fg/15 bg-night text-primary-fg placeholder:text-primary-fg/40"
                  aria-label="Customer ID"
                />
                <Button type="submit" variant="secondary" className="shrink-0">
                  Load
                </Button>
              </form>
              {err ? <p className="text-sm text-warn-fg">{err}</p> : null}
              <p className="text-xs text-primary-fg/55">
                Embed with <code className="font-mono">?customerId=</code> or postMessage{" "}
                <code className="font-mono">ready-house</code>.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-5">
            {DEMO_PROFILES.map((p) => {
              const Icon = HOME_ICON[p.homeType];
              return (
                <button
                  key={p.customerId}
                  type="button"
                  onClick={() => {
                    unlock();
                    loadProfile(p);
                  }}
                  className="rounded-[var(--radius-lg)] border border-primary-fg/12 bg-night/65 p-3 text-left text-primary-fg backdrop-blur-sm transition-colors hover:bg-night/80"
                >
                  <Icon className="size-4 opacity-80" />
                  <p className="mt-2 font-display text-sm font-semibold">{p.familyName}</p>
                  <p className="text-[11px] text-primary-fg/60">{p.customerId}</p>
                  <p className="mt-1 text-[11px] text-primary-fg/70">{HOME_LABELS[p.homeType]}</p>
                </button>
              );
            })}
          </div>
        </div>
        ) : null}
      </div>
    </div>
  );
}

export function SetupScreen() {
  const draft = useGameStore((s) => s.setupDraft) ?? blankProfile();
  const setDraft = useGameStore((s) => s.setDraft);
  const loadProfile = useGameStore((s) => s.loadProfile);
  const setScreen = useGameStore((s) => s.setScreen);
  const [neighborName, setNeighborName] = useState("");

  const update = (patch: Partial<FamilyProfile>) => setDraft({ ...draft, ...patch });

  return (
    <div className="min-h-dvh bg-bg px-4 py-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <p className="text-sm font-semibold text-primary">Family plan</p>
          <h1 className="font-display mt-1 text-3xl font-semibold">Who lives in this house?</h1>
          <p className="mt-2 text-muted">
            This is what the game will load from your customer record later. Fill it in once, then
            play.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Family name
              <Input
                value={draft.familyName}
                onChange={(e) => update({ familyName: e.target.value })}
              />
            </label>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">People</p>
              {draft.members.map((m, i) => (
                <div key={m.id} className="grid grid-cols-[1fr_88px] gap-2">
                  <Input
                    value={m.name}
                    aria-label="Name"
                    onChange={(e) => {
                      const members = draft.members.map((x, idx) =>
                        idx === i ? { ...x, name: e.target.value } : x,
                      );
                      update({ members });
                    }}
                  />
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={m.age}
                    aria-label="Age"
                    onChange={(e) => {
                      const age = Number(e.target.value);
                      const members = draft.members.map((x, idx) =>
                        idx === i
                          ? {
                              ...x,
                              age,
                              role: (age < 13 ? "child" : age < 18 ? "teen" : "adult") as FamilyMember["role"],
                            }
                          : x,
                      );
                      update({ members });
                    }}
                  />
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() =>
                  update({
                    members: [
                      ...draft.members,
                      {
                        id: `m${draft.members.length + 1}`,
                        name: "Taylor",
                        age: 10,
                        role: "child",
                      },
                    ],
                  })
                }
              >
                <Plus className="size-4" /> Add person
              </Button>
            </div>
          </CardContent>
        </Card>

        <div>
          <p className="mb-2 text-sm font-semibold">Where do you live?</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(Object.keys(HOME_LABELS) as HomeType[]).map((h) => {
              const Icon = HOME_ICON[h];
              const on = draft.homeType === h;
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() =>
                    update({
                      homeType: h,
                      plan: {
                        ...draft.plan,
                        kitItems: defaultKitFor(h),
                        hasGenerator: h !== "apartment",
                      },
                    })
                  }
                  className={cn(
                    "flex min-h-20 flex-col items-start gap-2 rounded-[var(--radius-lg)] border p-3 text-left",
                    on ? "border-primary bg-primary-soft" : "border-border bg-surface",
                  )}
                >
                  <Icon className="size-4 text-primary" />
                  <span className="text-sm font-semibold">{HOME_LABELS[h]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm font-semibold">Neighbors you rely on</p>
            <div className="flex gap-2">
              <Input
                value={neighborName}
                onChange={(e) => setNeighborName(e.target.value)}
                placeholder="Mrs. Alvarez"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  if (!neighborName.trim()) return;
                  update({
                    neighbors: [
                      ...draft.neighbors,
                      {
                        id: `n${draft.neighbors.length + 1}`,
                        name: neighborName.trim(),
                        note: "Part of the family plan.",
                      },
                    ],
                  });
                  setNeighborName("");
                }}
              >
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {draft.neighbors.map((n) => (
                <Badge key={n.id}>{n.name}</Badge>
              ))}
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Meeting place
              <Input
                value={draft.plan.meetingPlace}
                onChange={(e) => update({ plan: { ...draft.plan, meetingPlace: e.target.value } })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={draft.plan.hasGenerator}
                onChange={(e) => update({ plan: { ...draft.plan, hasGenerator: e.target.checked } })}
              />
              We have a generator
            </label>
            <p className="text-sm font-semibold">Kit items</p>
            <div className="flex flex-wrap gap-2">
              {KIT_OPTIONS.map((id) => {
                const on = draft.plan.kitItems.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      const kitItems = on
                        ? draft.plan.kitItems.filter((x) => x !== id)
                        : [...draft.plan.kitItems, id];
                      update({ plan: { ...draft.plan, kitItems } });
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold",
                      on ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted",
                    )}
                  >
                    {KIT_LABELS[id]}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={() => setScreen("title")}>
            Back
          </Button>
          <Button
            size="lg"
            onClick={() => {
              unlock();
              loadProfile({ ...draft, familyName: draft.familyName.trim() || "Family" });
            }}
          >
            Continue
            <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function WhoScreen() {
  const profile = useGameStore((s) => s.profile);
  const setPlayer = useGameStore((s) => s.setPlayer);
  const setScreen = useGameStore((s) => s.setScreen);
  if (!profile) return null;
  const kids = profile.members.filter((m) => m.role === "child" || m.role === "teen");
  const list = kids.length ? kids : profile.members;

  return (
    <div className="min-h-dvh bg-bg px-4 py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <Badge>{profile.customerId}</Badge>
          <h1 className="font-display mt-3 text-3xl font-semibold">Who is playing?</h1>
          <p className="mt-2 text-muted">
            You will walk the {profile.familyName} home as this person. Pick the kid who is training
            today.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {list.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                unlock();
                setPlayer(m.id);
              }}
              className="flex min-h-24 flex-col items-start rounded-[var(--radius-xl)] border border-border bg-surface p-5 text-left hover:border-primary"
            >
              <p className="font-display text-xl font-semibold">{m.name}</p>
              <p className="text-sm text-muted">
                {m.age} · {m.role}
              </p>
            </button>
          ))}
        </div>
        <Button variant="ghost" className="self-start" onClick={() => setScreen("title")}>
          Back
        </Button>
      </div>
    </div>
  );
}

export function ShellScreen() {
  const profile = useGameStore((s) => s.profile);
  const setVisualShell = useGameStore((s) => s.setVisualShell);
  const setScreen = useGameStore((s) => s.setScreen);
  if (!profile) return null;
  const options = shellsFor(profile);

  return (
    <div className="min-h-dvh bg-bg px-4 py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <p className="text-sm font-semibold text-primary">Event Sim look</p>
          <h1 className="font-display mt-1 text-3xl font-semibold">Pick a home picture</h1>
          <p className="mt-2 text-muted">
            This only changes how the house looks. Your family plan stays the real one.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                unlock();
                setVisualShell(id);
              }}
              className="rounded-[var(--radius-xl)] border border-border bg-surface p-5 text-left hover:border-primary"
            >
              <p className="font-display text-xl font-semibold">{SHELL_LABELS[id]}</p>
              <p className="mt-1 text-sm text-muted">{SHELL_BLURB[id]}</p>
            </button>
          ))}
        </div>
        <Button variant="ghost" className="self-start" onClick={() => setScreen("who")}>
          Back
        </Button>
      </div>
    </div>
  );
}

export function BriefingScreen() {
  const profile = useGameStore((s) => s.profile);
  const playerId = useGameStore((s) => s.playerId);
  const setScreen = useGameStore((s) => s.setScreen);
  const startDrill = useGameStore((s) => s.startDrill);
  if (!profile) return null;
  const player = profile.members.find((m) => m.id === playerId);
  const Icon = HOME_ICON[profile.homeType];

  return (
    <div className="min-h-dvh bg-bg px-4 py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-start gap-3">
          <span className="grid size-12 place-items-center rounded-[var(--radius-lg)] bg-primary-soft text-primary">
            <Compass className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-primary">Kara, your guide</p>
            <h1 className="font-display text-3xl font-semibold">
              Hi {player?.name}. This is the {profile.familyName} plan.
            </h1>
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-4 text-sm leading-relaxed">
            <p className="flex items-center gap-2 font-semibold">
              <Icon className="size-4 text-primary" />
              {HOME_LABELS[profile.homeType]}
            </p>
            <p>
              If the lights go out, you find a flashlight, then go to the{" "}
              {profile.homeType === "apartment" ? "closet panel" : "utility breakers"}
              {profile.plan.hasGenerator ? ", then start the generator" : ""}.
            </p>
            <p>
              Your kit lives around the house:{" "}
              {profile.plan.kitItems.map((id) => KIT_LABELS[id].toLowerCase()).join(", ")}.
            </p>
            <p>
              Meeting place: <strong>{profile.plan.meetingPlace}</strong>.
            </p>
            {profile.neighbors[0] ? (
              <p>
                Neighbor to check: <strong>{profile.neighbors[0].name}</strong> — {profile.neighbors[0].note}
              </p>
            ) : null}
            {profile.plan.specialNotes.map((n) => (
              <p key={n} className="text-muted">
                {n}
              </p>
            ))}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setScreen("drills")}>
            Choose a drill
          </Button>
          <Button
            size="lg"
            onClick={() => {
              unlock();
              startDrill("power-out");
            }}
          >
            Start lights-out
            <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DrillsScreen() {
  const profile = useGameStore((s) => s.profile);
  const startDrill = useGameStore((s) => s.startDrill);
  const setScreen = useGameStore((s) => s.setScreen);
  if (!profile) return null;
  const drills = drillsFor(profile);

  return (
    <div className="min-h-dvh bg-bg px-4 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-semibold">Pick a drill</h1>
          <p className="mt-2 text-muted">Short practices, written from the {profile.familyName} plan.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {drills.map((id) => {
            const meta = DRILL_META[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  unlock();
                  startDrill(id as DrillId);
                }}
                className="rounded-[var(--radius-xl)] border border-border bg-surface p-5 text-left hover:border-primary"
              >
                <p className="text-xs font-semibold tracking-wide text-primary">{meta.duration}</p>
                <p className="font-display mt-2 text-xl font-semibold">{meta.title}</p>
                <p className="mt-1 text-sm text-muted">{meta.blurb}</p>
              </button>
            );
          })}
        </div>
        <Button variant="ghost" className="self-start" onClick={() => setScreen("briefing")}>
          Back to the plan
        </Button>
      </div>
    </div>
  );
}

export function DebriefScreen() {
  const profile = useGameStore((s) => s.profile);
  const lastStars = useGameStore((s) => s.lastStars);
  const lastSummary = useGameStore((s) => s.lastSummary);
  const setScreen = useGameStore((s) => s.setScreen);
  const resetToTitle = useGameStore((s) => s.resetToTitle);
  if (!profile) return null;

  return (
    <div className="min-h-dvh bg-bg px-4 py-10">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div>
          <Badge>Drill complete</Badge>
          <h1 className="font-display mt-3 text-3xl font-semibold">You practiced the plan.</h1>
          <p className="mt-2 text-muted">{lastSummary}</p>
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "grid size-12 place-items-center rounded-full border text-lg font-bold",
                i < lastStars
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-surface text-subtle",
              )}
            >
              {i < lastStars ? <Check className="size-5" /> : i + 1}
            </span>
          ))}
        </div>
        <Card>
          <CardContent className="text-sm leading-relaxed">
            Talk through this with a grown-up: where the flashlight lives, who you would go to, and
            the meeting place — {profile.plan.meetingPlace}.
          </CardContent>
        </Card>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" onClick={() => setScreen("drills")}>
            Another drill
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setScreen("briefing")}>
            Review the plan
          </Button>
          <Button variant="ghost" onClick={resetToTitle}>
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}

