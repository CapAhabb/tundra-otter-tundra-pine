import { create } from "zustand";
import type { DrillId, FamilyProfile, Screen, VisualShell } from "./types";
import { findProfile, parseProfilePayload, shellsFor } from "./profiles";
import { loadChildProgress, saveChildMission, saveChildShell } from "./child-progress";

export type GameStore = {
  screen: Screen;
  profile: FamilyProfile | null;
  playerId: string | null;
  drill: DrillId | null;
  lastStars: number;
  lastSummary: string;
  setupDraft: FamilyProfile | null;
  visualShell: VisualShell | null;
  setScreen: (s: Screen) => void;
  loadProfile: (p: FamilyProfile) => void;
  loadCustomerId: (id: string) => boolean;
  setPlayer: (id: string) => void;
  setDraft: (p: FamilyProfile) => void;
  setVisualShell: (s: VisualShell) => void;
  startDrill: (d: DrillId) => void;
  finishDrill: (stars: number, summary: string) => void;
  resetToTitle: () => void;
};

export const useGameStore = create<GameStore>((set, get) => ({
  screen: "title",
  profile: null,
  playerId: null,
  drill: null,
  lastStars: 0,
  lastSummary: "",
  setupDraft: null,
  visualShell: null,
  setScreen: (screen) => set({ screen }),
  loadProfile: (profile) => set({ profile, screen: "who", setupDraft: null }),
  loadCustomerId: (id) => {
    const p = findProfile(id);
    if (!p) return false;
    get().loadProfile(p);
    return true;
  },
  setPlayer: (playerId) => {
    const profile = get().profile;
    const saved = loadChildProgress().shell;
    const options = profile ? shellsFor(profile) : [];
    const picked =
      saved && options.includes(saved as VisualShell) ? (saved as VisualShell) : options[0] ?? null;
    const next: Screen = options.length > 1 ? "shell" : "briefing";
    set({ playerId, visualShell: picked, screen: next });
  },
  setDraft: (setupDraft) => set({ setupDraft }),
  setVisualShell: (visualShell) => {
    saveChildShell(visualShell);
    set({ visualShell, screen: "briefing" });
  },
  startDrill: (drill) => set({ drill, screen: "play" }),
  finishDrill: (lastStars, lastSummary) => {
    const drill = get().drill;
    if (drill) saveChildMission(drill);
    set({ lastStars, lastSummary, screen: "debrief" });
  },
  resetToTitle: () =>
    set({
      screen: "title",
      drill: null,
    }),
}));

export function bootHandoffFromLocation(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  const cid = url.searchParams.get("customerId");
  const raw = url.searchParams.get("profile");
  const play = url.searchParams.get("play");
  const drill = url.searchParams.get("drill") as DrillId | null;
  let loaded = false;
  if (raw) {
    const parsed = parseProfilePayload(raw);
    if (parsed) {
      useGameStore.getState().loadProfile(parsed);
      loaded = true;
    }
  } else if (cid) {
    loaded = useGameStore.getState().loadCustomerId(cid);
  }
  if (play === "1") {
    const st = useGameStore.getState();
    const profile = st.profile;
    if (profile) {
      const kid =
        profile.members.find((m) => m.role === "child") ??
        profile.members[0];
      useGameStore.setState({
        playerId: kid.id,
        drill: drill === "pack-kit" || drill === "neighbor" || drill === "rally" || drill === "power-out"
          ? drill
          : "power-out",
        screen: "play",
      });
      return true;
    }
  }
  return loaded;
}
