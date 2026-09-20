import type {
  FamilyProfile,
  FloorId,
  HouseWorld,
  VisualShell,
  Interactable,
  KitItemId,
  Rect,
  Room,
  WorldProp,
} from "./types";

const WALL = 18;

function inset(r: Rect, t = WALL): Rect {
  return { x: r.x + t, y: r.y + t, w: r.w - t * 2, h: r.h - t * 2 };
}

function door(a: Rect, side: "n" | "s" | "e" | "w", offset: number, width = 84): Rect {
  if (side === "n") return { x: a.x + offset, y: a.y - 28, w: width, h: WALL + 56 };
  if (side === "s") return { x: a.x + offset, y: a.y + a.h - WALL - 28, w: width, h: WALL + 56 };
  if (side === "w") return { x: a.x - 28, y: a.y + offset, w: WALL + 56, h: width };
  return { x: a.x + a.w - WALL - 28, y: a.y + offset, w: WALL + 56, h: width };
}

function prop(
  partial: Omit<WorldProp, "id"> & { id?: string },
  i: number,
): WorldProp {
  return { id: partial.id ?? `p${i}`, ...partial };
}

const ITEM_SIZE: Record<KitItemId, { w: number; h: number }> = {
  gobag: { w: 46, h: 50 },
  medkit: { w: 42, h: 32 },
  flashlight: { w: 44, h: 28 },
  water: { w: 40, h: 44 },
  radio: { w: 38, h: 42 },
  food: { w: 48, h: 38 },
  batteries: { w: 36, h: 32 },
  extinguisher: { w: 28, h: 50 },
  whistle: { w: 32, h: 26 },
};

function placeItem(
  id: KitItemId,
  x: number,
  y: number,
  props: WorldProp[],
  ints: Interactable[],
) {
  const s = ITEM_SIZE[id];
  props.push({
    id: `item-${id}`,
    kind: id,
    x,
    y,
    w: s.w,
    h: s.h,
    collide: false,
    collectible: id,
    interact: "pickup",
  });
  ints.push({
    id: `item-${id}`,
    kind: "pickup",
    x: x + s.w / 2,
    y: y + s.h / 2,
    r: 46,
    label: "Pick up",
    item: id,
  });
}

export function buildHouse(profile: FamilyProfile, shell?: VisualShell | null): HouseWorld {
  const home = profile.homeType;
  const isApt = home === "apartment";
  const yardFloor: FloorId =
    home === "desert" || shell === "country" && home === "desert"
      ? "sand"
      : shell === "country"
        ? "grass"
        : home === "forest"
          ? "forest"
          : home === "desert"
            ? "sand"
            : "grass";

  const rooms: Room[] = [];
  if (!isApt) {
    rooms.push({
      id: "yard",
      name: home === "desert" ? "Yard" : home === "forest" ? "Treeside" : "Yard",
      x: 32,
      y: 28,
      w: 1536,
      h: 220,
      floor: yardFloor,
    });
  }

  const topY = isApt ? 28 : 248;
  rooms.push(
    {
      id: "bedroom",
      name: "Bedroom",
      x: 32,
      y: topY,
      w: 430,
      h: 320,
      floor: "carpet",
    },
    {
      id: "bathroom",
      name: "Bathroom",
      x: 462,
      y: topY,
      w: 270,
      h: 320,
      floor: "bath",
    },
    {
      id: "utility",
      name: isApt ? "Closet" : profile.plan.hasBasement ? "Utility" : "Utility",
      x: 732,
      y: topY,
      w: isApt ? 420 : 836,
      h: 320,
      floor: "concrete",
    },
  );

  const midY = topY + 320;
  rooms.push(
    {
      id: "living",
      name: "Living room",
      x: 32,
      y: midY,
      w: 780,
      h: 340,
      floor: "wood",
    },
    {
      id: "kitchen",
      name: "Kitchen",
      x: 812,
      y: midY,
      w: isApt ? 340 : 756,
      h: 340,
      floor: "tile",
    },
  );

  const botY = midY + 340;
  if (!isApt) {
    rooms.push(
      {
        id: "garage",
        name: "Garage",
        x: 32,
        y: botY,
        w: 430,
        h: 210,
        floor: "concrete",
      },
      {
        id: "hall",
        name: "Entry",
        x: 462,
        y: botY,
        w: 1106,
        h: 210,
        floor: "wood",
      },
    );
  } else {
    rooms.push({
      id: "hall",
      name: "Hall / lobby door",
      x: 32,
      y: botY,
      w: 1120,
      h: 210,
      floor: "wood",
    });
  }

  const byId = Object.fromEntries(rooms.map((r) => [r.id, r])) as Record<string, Room>;
  const walk: Rect[] = rooms.map((r) => inset(r));

  // Door corridors
  walk.push(door(byId.bedroom, "s", 160));
  walk.push(door(byId.bathroom, "s", 90));
  walk.push(door(byId.utility, "s", 80));
  walk.push(door(byId.living, "e", 120));
  if (byId.yard) walk.push(door(byId.living, "n", 280));
  walk.push(door(byId.hall, "n", isApt ? 120 : 80));
  if (byId.garage) {
    walk.push(door(byId.garage, "e", 60));
    walk.push(door(byId.hall, "w", 60));
  }
  walk.push(door(byId.kitchen, "s", 80));

  const props: WorldProp[] = [];
  const ints: Interactable[] = [];
  let pi = 0;

  const bedR = byId.bedroom;
  props.push(
    prop({ kind: "bed", x: bedR.x + 48, y: bedR.y + 48, w: 150, h: 170, collide: true }, pi++),
  );

  const liv = byId.living;
  props.push(
    prop({ kind: "sofa", x: liv.x + 70, y: liv.y + 90, w: 210, h: 120, collide: true }, pi++),
    prop({ kind: "table", x: liv.x + 320, y: liv.y + 130, w: 150, h: 90, collide: true }, pi++),
  );

  const kit = byId.kitchen;
  props.push(
    prop({ kind: "fridge", x: kit.x + kit.w - 92, y: kit.y + 50, w: 58, h: 110, collide: true }, pi++),
    prop({ kind: "counter", x: kit.x + 40, y: kit.y + 46, w: 240, h: 70, collide: true }, pi++),
  );

  const util = byId.utility;
  props.push(
    prop(
      {
        kind: "breaker",
        x: util.x + 40,
        y: util.y + 70,
        w: 54,
        h: 70,
        collide: true,
        interact: "breaker",
      },
      pi++,
    ),
  );
  ints.push({
    id: "breaker",
    kind: "breaker",
    x: util.x + 67,
    y: util.y + 105,
    r: 56,
    label: "Breaker panel",
  });

  if (profile.plan.hasGenerator) {
    const host = byId.yard ?? byId.garage ?? util;
    const gx = byId.yard ? host.x + host.w - 220 : host.x + 80;
    const gy = byId.yard ? host.y + 70 : host.y + 70;
    props.push(
      prop(
        { kind: "generator", x: gx, y: gy, w: 110, h: 78, collide: true, interact: "generator" },
        pi++,
      ),
    );
    ints.push({
      id: "generator",
      kind: "generator",
      x: gx + 55,
      y: gy + 40,
      r: 64,
      label: "Generator",
    });
  }

  const itemHomes: Record<KitItemId, { room: string; ox: number; oy: number }> = {
    flashlight: { room: "bedroom", ox: 250, oy: 70 },
    medkit: { room: "bathroom", ox: 80, oy: 80 },
    gobag: { room: "hall", ox: isApt ? 80 : 40, oy: 70 },
    water: { room: home === "desert" ? (byId.garage ? "garage" : "kitchen") : "kitchen", ox: 80, oy: 180 },
    radio: { room: "living", ox: 500, oy: 70 },
    food: { room: "kitchen", ox: 280, oy: 180 },
    batteries: { room: "utility", ox: 160, oy: 80 },
    extinguisher: { room: byId.garage ? "garage" : "kitchen", ox: 40, oy: 50 },
    whistle: { room: "hall", ox: 180, oy: 70 },
  };

  for (const id of profile.plan.kitItems) {
    const homeAt = itemHomes[id];
    const room = byId[homeAt.room] ?? byId.hall;
    placeItem(id, room.x + homeAt.ox, room.y + homeAt.oy, props, ints);
  }

  const hall = byId.hall;
  ints.push({
    id: "kit-station",
    kind: "kit-station",
    x: hall.x + hall.w - 90,
    y: hall.y + 100,
    r: 54,
    label: "Kit corner",
  });

  const neighbor = profile.neighbors[0];
  if (neighbor) {
    const nx = isApt ? hall.x + hall.w - 70 : (byId.yard?.x ?? hall.x) + 120;
    const ny = isApt ? hall.y + 110 : (byId.yard?.y ?? hall.y) + 110;
    ints.push({
      id: "neighbor",
      kind: "neighbor",
      x: nx,
      y: ny,
      r: 60,
      label: neighbor.name,
    });
  }

  const meetingRoom = isApt ? hall : (byId.yard ?? hall);
  const meeting = {
    x: isApt ? hall.x + 80 : meetingRoom.x + meetingRoom.w / 2,
    y: isApt ? hall.y + 110 : meetingRoom.y + 90,
    label: profile.plan.meetingPlace,
  };
  ints.push({
    id: "rally",
    kind: "rally",
    x: meeting.x,
    y: meeting.y,
    r: 70,
    label: "Meeting place",
  });

  const playerSkipped = true;
  void playerSkipped;
  const spots: Array<{ room: string; ox: number; oy: number }> = [
    { room: "living", ox: 240, oy: 240 },
    { room: "kitchen", ox: 180, oy: 240 },
    { room: "bedroom", ox: 280, oy: 240 },
  ];
  profile.members.forEach((m, i) => {
    const s = spots[i % spots.length];
    const room = byId[s.room] ?? liv;
    ints.push({
      id: `fam-${m.id}`,
      kind: "family",
      x: room.x + s.ox,
      y: room.y + s.oy,
      r: 48,
      label: m.name,
      memberId: m.id,
    });
  });

  const spawnRoom = hall;
  const maxX = Math.max(...rooms.map((r) => r.x + r.w)) + 40;
  const maxY = Math.max(...rooms.map((r) => r.y + r.h)) + 40;

  return {
    width: maxX,
    height: maxY,
    rooms,
    walk,
    props,
    interactables: ints,
    spawn: { x: spawnRoom.x + 220, y: spawnRoom.y + 110 },
    meeting,
  };
}

export function pointInRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
}

export function circleHitsRect(x: number, y: number, rad: number, r: Rect): boolean {
  const nx = Math.max(r.x, Math.min(x, r.x + r.w));
  const ny = Math.max(r.y, Math.min(y, r.y + r.h));
  const dx = x - nx;
  const dy = y - ny;
  return dx * dx + dy * dy < rad * rad;
}

export function roomAt(world: HouseWorld, x: number, y: number): Room | undefined {
  return world.rooms.find((r) => pointInRect(x, y, r));
}
