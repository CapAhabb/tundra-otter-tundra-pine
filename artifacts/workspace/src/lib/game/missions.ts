import type { DrillId, FamilyProfile, MissionStep } from "./types";
import { KIT_LABELS } from "./types";

export function stepsFor(drill: DrillId, profile: FamilyProfile, playerName: string): MissionStep[] {
  if (drill === "power-out") {
    const steps: MissionStep[] = [
      {
        id: "flashlight",
        label: "Find a flashlight",
        hint: "Check the bedroom. A flashlight lives near the bed.",
        done: false,
      },
      {
        id: "breaker",
        label: "Go to the breakers",
        hint: "Walk to the utility room and use the gray panel.",
        done: false,
      },
    ];
    if (profile.plan.hasGenerator) {
      steps.push({
        id: "generator",
        label: "Start the generator",
        hint: profile.homeType === "apartment"
          ? "Your plan uses a building generator — check the utility closet."
          : "The generator is outside in the yard or garage.",
        done: false,
      });
    }
    steps.push({
      id: "done",
      label: "Tell Kara you are safe",
      hint: `Nice work, ${playerName}. Stand still and press Use when you are ready.`,
      done: false,
    });
    return steps;
  }

  if (drill === "pack-kit") {
    return profile.plan.kitItems.map((id) => ({
      id: `kit-${id}`,
      label: `Find the ${KIT_LABELS[id].toLowerCase()}`,
      hint: `Look around the house for the ${KIT_LABELS[id].toLowerCase()}.`,
      done: false,
    })).concat({
      id: "station",
      label: "Bring everything to the kit corner",
      hint: "The kit corner is in the entry hall.",
      done: false,
    });
  }

  if (drill === "neighbor") {
    const n = profile.neighbors[0];
    return [
      {
        id: "find-neighbor",
        label: n ? `Find ${n.name}` : "Find your neighbor",
        hint: profile.homeType === "apartment"
          ? "The neighbor door is at the far end of the hall."
          : "Look in the front yard.",
        done: false,
      },
      {
        id: "talk-neighbor",
        label: "Practice what you would say",
        hint: "Walk up and press Use.",
        done: false,
      },
    ];
  }

  const others = profile.members.filter((m) => m.name !== playerName);
  return others.map((m) => ({
    id: `find-${m.id}`,
    label: `Check on ${m.name}`,
    hint: `${m.name} is somewhere in the house.`,
    done: false,
  })).concat({
    id: "meeting",
    label: `Meet at ${profile.plan.meetingPlace}`,
    hint: "Go to the family meeting place once everyone is accounted for.",
    done: false,
  });
}

export function drillsFor(profile: FamilyProfile): DrillId[] {
  const list: DrillId[] = ["power-out", "pack-kit", "rally"];
  if (profile.neighbors.length > 0) list.splice(2, 0, "neighbor");
  return list;
}
