import type { FamilyProfile, HomeType, KitItemId, VisualShell } from "./types";

/** Demo families so trainers can try the game without a live customer record. */
export const DEMO_PROFILES: FamilyProfile[] = [
  {
    customerId: "FAM-CHEN",
    familyName: "Chen",
    homeType: "city",
    members: [
      { id: "c1", name: "Maya", age: 9, role: "child" },
      { id: "c2", name: "Leo", age: 6, role: "child" },
      { id: "c3", name: "Priya", age: 38, role: "adult" },
      { id: "c4", name: "David", age: 40, role: "adult" },
    ],
    neighbors: [
      {
        id: "n1",
        name: "The Patels",
        note: "They have spare keys and a landline.",
      },
    ],
    plan: {
      meetingPlace: "the oak tree in the front yard",
      kitItems: ["gobag", "flashlight", "medkit", "water", "food", "batteries"],
      hasGenerator: true,
      hasBasement: false,
      waterSource: "tap",
      specialNotes: ["Leo needs his stuffed fox if you have extra time."],
    },
  },
  {
    customerId: "FAM-RIVERA",
    familyName: "Rivera",
    homeType: "apartment",
    members: [
      { id: "r1", name: "Sofia", age: 8, role: "child" },
      { id: "r2", name: "Elena", age: 34, role: "adult" },
    ],
    neighbors: [
      {
        id: "n2",
        name: "Mrs. Alvarez",
        note: "She lives next door and keeps a spare key.",
      },
    ],
    plan: {
      meetingPlace: "the lobby mailboxes",
      kitItems: ["gobag", "flashlight", "radio", "water", "medkit"],
      hasGenerator: false,
      hasBasement: false,
      waterSource: "tap",
      specialNotes: ["Use the stairs, not the elevator, if the power is out."],
    },
  },
  {
    customerId: "FAM-BROOKS",
    familyName: "Brooks",
    homeType: "country",
    members: [
      { id: "b1", name: "Sam", age: 11, role: "child" },
      { id: "b2", name: "Jordan", age: 14, role: "teen" },
      { id: "b3", name: "Chris", age: 42, role: "adult" },
    ],
    neighbors: [
      {
        id: "n3",
        name: "Mr. Hale",
        note: "Farmer down the road. Has extra fuel.",
      },
    ],
    plan: {
      meetingPlace: "the red barn by the driveway",
      kitItems: ["gobag", "flashlight", "medkit", "water", "food", "radio", "batteries"],
      hasGenerator: true,
      hasBasement: true,
      waterSource: "well",
      specialNotes: ["Well pump needs the generator if the power stays off."],
    },
  },
  {
    customerId: "FAM-HALE",
    familyName: "Hale",
    homeType: "desert",
    members: [
      { id: "h1", name: "Noor", age: 10, role: "child" },
      { id: "h2", name: "Amira", age: 36, role: "adult" },
      { id: "h3", name: "Yusuf", age: 37, role: "adult" },
    ],
    neighbors: [
      {
        id: "n4",
        name: "Tia Rosa",
        note: "Keeps extra water in her shade carport.",
      },
    ],
    plan: {
      meetingPlace: "the shaded carport",
      kitItems: ["water", "gobag", "medkit", "radio", "flashlight", "batteries"],
      hasGenerator: false,
      hasBasement: false,
      waterSource: "stored",
      specialNotes: ["Water is the first thing. Stay in the shade."],
    },
  },
  {
    customerId: "FAM-PARK",
    familyName: "Park",
    homeType: "forest",
    members: [
      { id: "p1", name: "Jun", age: 7, role: "child" },
      { id: "p2", name: "Hana", age: 12, role: "child" },
      { id: "p3", name: "Min", age: 41, role: "adult" },
    ],
    neighbors: [
      {
        id: "n5",
        name: "Ranger Cole",
        note: "Lives at the end of the lane and watches the fire radio.",
      },
    ],
    plan: {
      meetingPlace: "the driveway end, away from the trees",
      kitItems: ["gobag", "whistle", "radio", "medkit", "flashlight", "extinguisher"],
      hasGenerator: true,
      hasBasement: false,
      waterSource: "tap",
      specialNotes: ["If you smell smoke, grab the go-bag and go to the rally point."],
    },
  },
];

export const KIT_OPTIONS: KitItemId[] = [
  "gobag",
  "medkit",
  "flashlight",
  "water",
  "radio",
  "food",
  "batteries",
  "extinguisher",
  "whistle",
];

export function findProfile(customerId: string): FamilyProfile | undefined {
  const id = customerId.trim().toUpperCase();
  return DEMO_PROFILES.find((p) => p.customerId === id);
}

export function defaultKitFor(home: HomeType): KitItemId[] {
  switch (home) {
    case "apartment":
      return ["gobag", "flashlight", "radio", "water", "medkit"];
    case "desert":
      return ["water", "gobag", "medkit", "radio", "flashlight", "batteries"];
    case "forest":
      return ["gobag", "whistle", "radio", "medkit", "flashlight", "extinguisher"];
    case "country":
      return ["gobag", "flashlight", "medkit", "water", "food", "radio", "batteries"];
    default:
      return ["gobag", "flashlight", "medkit", "water", "food", "batteries"];
  }
}

export function blankProfile(): FamilyProfile {
  return {
    customerId: "CUSTOM",
    familyName: "Family",
    homeType: "city",
    members: [
      { id: "m1", name: "Alex", age: 9, role: "child" },
      { id: "m2", name: "Jordan", age: 38, role: "adult" },
    ],
    neighbors: [],
    plan: {
      meetingPlace: "the front walk",
      kitItems: defaultKitFor("city"),
      hasGenerator: true,
      hasBasement: false,
      waterSource: "tap",
      specialNotes: [],
    },
  };
}

export function parseProfilePayload(raw: string): FamilyProfile | null {
  try {
    const json = JSON.parse(decodeURIComponent(raw)) as Partial<FamilyProfile>;
    if (!json.familyName || !Array.isArray(json.members) || json.members.length === 0) {
      return null;
    }
    const homeType = (json.homeType ?? "city") as HomeType;
    return {
      customerId: String(json.customerId ?? "CUSTOM"),
      familyName: String(json.familyName),
      homeType,
      members: json.members.map((m, i) => ({
        id: m.id ?? `m${i}`,
        name: m.name,
        age: Number(m.age) || 10,
        role: m.role ?? (Number(m.age) < 13 ? "child" : "adult"),
      })),
      neighbors: (json.neighbors ?? []).map((n, i) => ({
        id: n.id ?? `n${i}`,
        name: n.name,
        note: n.note ?? "",
      })),
      plan: {
        meetingPlace: json.plan?.meetingPlace ?? "the front walk",
        kitItems: json.plan?.kitItems ?? defaultKitFor(homeType),
        hasGenerator: json.plan?.hasGenerator ?? homeType !== "apartment",
        hasBasement: json.plan?.hasBasement ?? false,
        waterSource: json.plan?.waterSource ?? "tap",
        specialNotes: json.plan?.specialNotes ?? [],
      },
    };
  } catch {
    return null;
  }
}

/**
 * Parent web-app handoff
 * ----------------------
 * 1. Open this game with `?customerId=FAM-CHEN` (or your real customer id).
 * 2. Or pass a full profile: `?profile=` + encodeURIComponent(JSON.stringify(profile)).
 * 3. If this game is iframed, postMessage:
 *    { source: "ready-house", type: "load-profile", profile }
 *    { source: "ready-house", type: "load-customer", customerId }
 * 4. window.ReadyHouse.loadProfile(profile) is also available after boot.
 *
 * Profile JSON matches FamilyProfile in types.ts.
 */

export function shellsFor(profile: FamilyProfile): VisualShell[] {
  if (profile.homeType === "apartment") return ["apartment"];
  if (profile.homeType === "country" || profile.homeType === "forest") return ["country", "cozy"];
  if (profile.homeType === "desert") return ["country", "neighborhood"];
  return ["neighborhood", "cozy"];
}
