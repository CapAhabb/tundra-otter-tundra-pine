import type { DrillId, FamilyProfile, KitItemId, MissionStep } from "./types";
import { KIT_LABELS } from "./types";

/** Three simple bands so hints and required-item counts can flex across ages 6-12. */
export type AgeTier = "young" | "mid" | "older";

export function ageTierFor(age: number | undefined | null): AgeTier {
  if (age == null) return "mid";
  if (age <= 8) return "young";
  if (age <= 10) return "mid";
  return "older";
}

export function tierText(tier: AgeTier, young: string, mid: string, older?: string): string {
  if (tier === "young") return young;
  if (tier === "older") return older ?? mid;
  return mid;
}

/** Younger players get a shorter required list; everyone can still explore the whole house. */
export function kitItemsForTier(items: KitItemId[], tier: AgeTier): KitItemId[] {
  if (tier === "young") return items.slice(0, Math.min(4, items.length));
  return items;
}

/** Cheap, structure-preserving variation: same steps, shuffled order per playthrough. */
function shuffled<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function stepsFor(
  drill: DrillId,
  profile: FamilyProfile,
  playerName: string,
  age?: number | null,
): MissionStep[] {
  const tier = ageTierFor(age);

  if (drill === "power-out") {
    const steps: MissionStep[] = [
      {
        id: "flashlight",
        label: "Find a flashlight",
        hint: tierText(
          tier,
          "Go to the bedroom. The flashlight is by the bed.",
          "Check the bedroom. A flashlight lives near the bed.",
          "The flashlight is stored near the bed in the bedroom — start there.",
        ),
        done: false,
      },
      {
        id: "breaker",
        label: "Go to the breakers",
        hint: tierText(
          tier,
          "Now walk to the utility room. Use the gray panel.",
          "Walk to the utility room and use the gray panel.",
          "Head to the utility room next and check the breaker panel.",
        ),
        done: false,
      },
    ];
    if (profile.plan.hasGenerator) {
      steps.push({
        id: "generator",
        label: "Start the generator",
        hint:
          profile.homeType === "apartment"
            ? tierText(
                tier,
                "This building has a generator. Check the utility closet.",
                "Your plan uses a building generator — check the utility closet.",
                "Your plan uses a building generator; it's in the utility closet.",
              )
            : tierText(
                tier,
                "The generator is outside. Look in the yard or garage.",
                "The generator is outside in the yard or garage.",
                "The generator's outside — yard or garage, depending on your home.",
              ),
        done: false,
      });
    }
    steps.push({
      id: "done",
      label: "Tell Kara you are safe",
      hint: tierText(
        tier,
        `Great job, ${playerName}! Stand still and press Use.`,
        `Nice work, ${playerName}. Stand still and press Use when you are ready.`,
        `Nice work, ${playerName}. When you're ready, stand still and press Use to check in.`,
      ),
      done: false,
    });
    return steps;
  }

  if (drill === "pack-kit") {
    const items = kitItemsForTier(profile.plan.kitItems, tier);
    const itemSteps = shuffled(items).map((id) => ({
      id: `kit-${id}`,
      label: `Find the ${KIT_LABELS[id].toLowerCase()}`,
      hint: tierText(
        tier,
        `Look for the ${KIT_LABELS[id].toLowerCase()} in the house.`,
        `Look around the house for the ${KIT_LABELS[id].toLowerCase()}.`,
        `Search the house for the ${KIT_LABELS[id].toLowerCase()} — check the usual rooms first.`,
      ),
      done: false,
    }));
    return itemSteps.concat({
      id: "station",
      label: "Bring everything to the kit corner",
      hint: tierText(
        tier,
        "Bring it all to the entry hall.",
        "The kit corner is in the entry hall.",
        "Once you have everything, drop it at the kit corner in the entry hall.",
      ),
      done: false,
    });
  }

  if (drill === "neighbor") {
    const n = profile.neighbors[0];
    return [
      {
        id: "find-neighbor",
        label: n ? `Find ${n.name}` : "Find your neighbor",
        hint:
          profile.homeType === "apartment"
            ? tierText(
                tier,
                "Walk to the far end of the hall.",
                "The neighbor door is at the far end of the hall.",
                "The neighbor's door is at the far end of the hall.",
              )
            : tierText(
                tier,
                "Look in the front yard.",
                "Look in the front yard.",
                "Check the front yard.",
              ),
        done: false,
      },
      {
        id: "talk-neighbor",
        label: "Practice what you would say",
        hint: tierText(
          tier,
          "Walk up and press Use to say hi.",
          "Walk up and press Use.",
          "Walk over and press Use when you're close.",
        ),
        done: false,
      },
    ];
  }

  const others = profile.members.filter((m) => m.name !== playerName);
  return others
    .map((m) => ({
      id: `find-${m.id}`,
      label: `Check on ${m.name}`,
      hint: tierText(
        tier,
        `Find ${m.name} in the house.`,
        `${m.name} is somewhere in the house.`,
        `${m.name} is somewhere in the house — track them down.`,
      ),
      done: false,
    }))
    .concat({
      id: "meeting",
      label: `Meet at ${profile.plan.meetingPlace}`,
      hint: tierText(
        tier,
        `When everyone's found, go to ${profile.plan.meetingPlace}.`,
        "Go to the family meeting place once everyone is accounted for.",
        "Once everyone's accounted for, head to the family meeting place.",
      ),
      done: false,
    });
}

export function drillsFor(profile: FamilyProfile): DrillId[] {
  const list: DrillId[] = ["power-out", "pack-kit", "rally"];
  if (profile.neighbors.length > 0) list.splice(2, 0, "neighbor");
  return list;
}
