export type HomeType = "apartment" | "city" | "country" | "desert" | "forest";

export type MemberRole = "adult" | "teen" | "child";

export type KitItemId =
  | "gobag"
  | "medkit"
  | "flashlight"
  | "water"
  | "radio"
  | "food"
  | "batteries"
  | "extinguisher"
  | "whistle";

export type DrillId = "power-out" | "pack-kit" | "neighbor" | "rally";

export type VisualShell = "neighborhood" | "country" | "apartment" | "cozy";

export type Screen =
  | "title"
  | "setup"
  | "who"
  | "shell"
  | "briefing"
  | "drills"
  | "play"
  | "debrief";

export type FamilyMember = {
  id: string;
  name: string;
  age: number;
  role: MemberRole;
};

export type Neighbor = {
  id: string;
  name: string;
  note: string;
};

export type FamilyPlan = {
  meetingPlace: string;
  kitItems: KitItemId[];
  hasGenerator: boolean;
  hasBasement: boolean;
  waterSource: "tap" | "well" | "stored";
  specialNotes: string[];
};

export type FamilyProfile = {
  customerId: string;
  familyName: string;
  members: FamilyMember[];
  homeType: HomeType;
  neighbors: Neighbor[];
  plan: FamilyPlan;
};

export type Rect = { x: number; y: number; w: number; h: number };

export type FloorId =
  | "wood"
  | "tile"
  | "carpet"
  | "grass"
  | "sand"
  | "forest"
  | "concrete"
  | "bath";

export type RoomId =
  | "yard"
  | "bedroom"
  | "bathroom"
  | "utility"
  | "living"
  | "kitchen"
  | "garage"
  | "hall";

export type Room = Rect & {
  id: RoomId;
  name: string;
  floor: FloorId;
};

export type PropKind =
  | "sofa"
  | "bed"
  | "fridge"
  | "table"
  | "counter"
  | "breaker"
  | "generator"
  | "gobag"
  | "medkit"
  | "flashlight"
  | "water"
  | "radio"
  | "food"
  | "batteries"
  | "extinguisher"
  | "whistle";

export type WorldProp = Rect & {
  id: string;
  kind: PropKind;
  collide: boolean;
  collectible?: KitItemId;
  interact?: InteractKind;
};

export type InteractKind =
  | "pickup"
  | "breaker"
  | "generator"
  | "neighbor"
  | "family"
  | "rally"
  | "kit-station";

export type Interactable = {
  id: string;
  kind: InteractKind;
  x: number;
  y: number;
  r: number;
  label: string;
  memberId?: string;
  item?: KitItemId;
};

export type MissionStep = {
  id: string;
  label: string;
  hint: string;
  done: boolean;
};

export type Dialogue = {
  speaker: string;
  text: string;
  dismiss: string;
};

export type HouseWorld = {
  width: number;
  height: number;
  rooms: Room[];
  walk: Rect[];
  props: WorldProp[];
  interactables: Interactable[];
  spawn: { x: number; y: number };
  meeting: { x: number; y: number; label: string };
};

export const KIT_LABELS: Record<KitItemId, string> = {
  gobag: "Go-bag",
  medkit: "First-aid kit",
  flashlight: "Flashlight",
  water: "Water",
  radio: "Radio",
  food: "Food crate",
  batteries: "Batteries",
  extinguisher: "Extinguisher",
  whistle: "Whistle",
};

export const HOME_LABELS: Record<HomeType, string> = {
  apartment: "Apartment",
  city: "City house",
  country: "Country home",
  desert: "Desert home",
  forest: "Forest home",
};

export const SHELL_LABELS: Record<VisualShell, string> = {
  neighborhood: "Neighborhood Home",
  country: "Country Home",
  apartment: "Apartment",
  cozy: "Cozy Home",
};

export const SHELL_BLURB: Record<VisualShell, string> = {
  neighborhood: "A regular house on a street.",
  country: "A home with more yard around it.",
  apartment: "A home in a building.",
  cozy: "A smaller, quiet home.",
};

export const DRILL_META: Record<
  DrillId,
  { title: string; blurb: string; duration: string }
> = {
  "power-out": {
    title: "Lights out",
    blurb: "The power stops. Find light, then follow the breaker steps.",
    duration: "4 min",
  },
  "pack-kit": {
    title: "Pack the kit",
    blurb: "Walk the house and gather every item on your family list.",
    duration: "5 min",
  },
  neighbor: {
    title: "Check the neighbor",
    blurb: "Practice walking to the person your family relies on.",
    duration: "2 min",
  },
  rally: {
    title: "Rally point",
    blurb: "Account for everyone, then meet at the family meeting place.",
    duration: "4 min",
  },
};
