import { useSyncExternalStore } from "react";

export type CalcSnapshot = {
  id: string;
  title: string;
  category: string;
  inputs: { label: string; value: number }[];
  results: { label: string; value: string }[];
  touched: boolean;
};

const store = new Map<string, CalcSnapshot>();
const listeners = new Set<() => void>();
let version = 0;
let cache: CalcSnapshot[] = [];

function emit() {
  version++;
  cache = Array.from(store.values());
  listeners.forEach((l) => l());
}

export function publishCalc(snapshot: CalcSnapshot) {
  const prev = store.get(snapshot.id);
  if (prev && JSON.stringify(prev) === JSON.stringify(snapshot)) return;
  store.set(snapshot.id, snapshot);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return cache;
}

/** Live read of everything currently rendered in the Calculator Matrix. */
export function useCalcMatrixState() {
  return useSyncExternalStore(subscribe, getSnapshot, () => cache);
}

export function getCalcMatrixState() {
  return cache;
}

/** Compact text payload for LLM prompts / mock responses. */
export function formatCalcContext(snaps: CalcSnapshot[], onlyTouched = true) {
  const list = onlyTouched ? snaps.filter((s) => s.touched) : snaps;
  const chosen = list.length ? list : snaps.slice(0, 12);
  if (!chosen.length) return "No calculators have been run yet.";
  return chosen
    .map(
      (s) =>
        `- ${s.title} [${s.category}] :: ${s.inputs
          .map((i) => `${i.label}=${i.value}`)
          .join(", ")} => ${s.results.map((r) => `${r.label}: ${r.value}`).join(" | ")}`,
    )
    .join("\n");
}

export const calcStoreVersion = () => version;

/* ---------------- Optimizer patch layer (apply / undo / reset) ---------------- */

export type MatrixPatch = Record<string, Record<string, number>>;

let patches: MatrixPatch = {};
let history: MatrixPatch[] = [];
const patchListeners = new Set<() => void>();

function emitPatches() {
  patchListeners.forEach((l) => l());
}

function subscribePatches(cb: () => void) {
  patchListeners.add(cb);
  return () => patchListeners.delete(cb);
}

/** Merge an optimizer-produced patch into the matrix, keeping an undo snapshot. */
export function applyMatrixPatch(patch: MatrixPatch) {
  history = [...history, patches];
  const next: MatrixPatch = { ...patches };
  for (const [id, vals] of Object.entries(patch)) {
    next[id] = { ...(next[id] ?? {}), ...vals };
  }
  patches = next;
  emitPatches();
}

/** Step back to the state before the most recent apply. */
export function undoMatrixPatch() {
  if (!history.length) return;
  patches = history[history.length - 1];
  history = history.slice(0, -1);
  emitPatches();
}

/** Drop every optimizer patch — back to pre-optimization values. */
export function resetMatrixPatches() {
  if (!history.length && !Object.keys(patches).length) return;
  patches = {};
  history = [];
  emitPatches();
}

const EMPTY_PATCH: Record<string, number> = {};

export function useMatrixPatch(calcId: string) {
  return useSyncExternalStore(
    subscribePatches,
    () => patches[calcId] ?? EMPTY_PATCH,
    () => patches[calcId] ?? EMPTY_PATCH,
  );
}

export function useMatrixPatchMeta() {
  return useSyncExternalStore(
    subscribePatches,
    () => `${history.length}:${Object.keys(patches).length}`,
    () => `${history.length}:${Object.keys(patches).length}`,
  );
}

export function getMatrixPatchMeta() {
  return { canUndo: history.length > 0, patchedCount: Object.keys(patches).length };
}
