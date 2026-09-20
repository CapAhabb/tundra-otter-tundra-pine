/** Narrow local child notes. Never writes the canonical household record. */

const KEY = "northstar-guidance-child-progress";

export type ChildObservation = {
  id: string;
  at: number;
  kind: string;
  note: string;
};

export type ChildProgress = {
  observations: ChildObservation[];
  lessons: string[];
  discovered: string[];
  missions: string[];
  shell: string | null;
};

function empty(): ChildProgress {
  return { observations: [], lessons: [], discovered: [], missions: [], shell: null };
}

export function loadChildProgress(): ChildProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as ChildProgress;
    return {
      observations: Array.isArray(parsed.observations) ? parsed.observations : [],
      lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
      discovered: Array.isArray(parsed.discovered) ? parsed.discovered : [],
      missions: Array.isArray(parsed.missions) ? parsed.missions : [],
      shell: typeof parsed.shell === "string" ? parsed.shell : null,
    };
  } catch {
    return empty();
  }
}

export function saveChildObservation(kind: string, note: string) {
  if (typeof localStorage === "undefined") return;
  const cur = loadChildProgress();
  cur.observations.push({
    id: `${kind}-${Date.now()}`,
    at: Date.now(),
    kind,
    note,
  });
  if (!cur.lessons.includes(kind)) cur.lessons.push(kind);
  if (!cur.discovered.includes(kind)) cur.discovered.push(kind);
  try {
    write(cur);
  } catch {
    /* ignore quota */
  }
}

function write(cur: ChildProgress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cur));
  } catch {
    /* ignore quota */
  }
}

export function saveChildShell(shell: string) {
  if (typeof localStorage === "undefined") return;
  const cur = loadChildProgress();
  cur.shell = shell;
  write(cur);
}

export function saveChildMission(id: string) {
  if (typeof localStorage === "undefined") return;
  const cur = loadChildProgress();
  if (!cur.missions.includes(id)) cur.missions.push(id);
  write(cur);
}
