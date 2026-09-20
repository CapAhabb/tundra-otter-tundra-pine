import { useEffect } from "react";
import { bootHandoffFromLocation, useGameStore } from "@/lib/game/store";
import { findProfile } from "@/lib/game/profiles";
import { parseProfilePayload } from "@/lib/game/profiles";
import {
  BriefingScreen,
  DebriefScreen,
  DrillsScreen,
  SetupScreen,
  TitleScreen,
  WhoScreen,
  ShellScreen,
} from "./Screens";
import { GameView } from "./GameView";

export function GameApp() {
  const screen = useGameStore((s) => s.screen);
  const loadProfile = useGameStore((s) => s.loadProfile);
  const loadCustomerId = useGameStore((s) => s.loadCustomerId);

  useEffect(() => {
    bootHandoffFromLocation();
    window.ReadyHouse = {
      loadProfile,
      loadCustomerId,
    };
    const onMsg = (ev: MessageEvent) => {
      const data = ev.data as {
        source?: string;
        type?: string;
        profile?: unknown;
        customerId?: string;
      };
      if (data?.source !== "ready-house") return;
      if (data.type === "load-customer" && data.customerId) {
        loadCustomerId(String(data.customerId));
      }
      if (data.type === "load-profile" && data.profile) {
        const parsed =
          typeof data.profile === "string"
            ? parseProfilePayload(encodeURIComponent(data.profile))
            : findProfile((data.profile as { customerId?: string }).customerId ?? "") ??
              (data.profile as Parameters<typeof loadProfile>[0]);
        if (parsed && "familyName" in parsed) loadProfile(parsed);
      }
    };
    window.addEventListener("message", onMsg);
    window.parent?.postMessage({ source: "ready-house", type: "ready" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, [loadCustomerId, loadProfile]);

  if (screen === "title") return <TitleScreen />;
  if (screen === "setup") return <SetupScreen />;
  if (screen === "who") return <WhoScreen />;
  if (screen === "shell") return <ShellScreen />;
  if (screen === "briefing") return <BriefingScreen />;
  if (screen === "drills") return <DrillsScreen />;
  if (screen === "play") return <GameView />;
  return <DebriefScreen />;
}
