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

export type MatrixVersion = {
  id: string;
  label: string;
  at: number;
  /** Full patch state as of this version. */
  state: MatrixPatch;
  /** Calculator ids changed by this step. */
  changed: string[];
};

const BASELINE: MatrixVersion = {
  id: "baseline",
  label: "Pre-optimization baseline",
  at: Date.now(),
  state: {},
  changed: [],
};

let timeline: MatrixVersion[] = [BASELINE];
let cursor = 0;
let patches: MatrixPatch = {};
const patchListeners = new Set<() => void>();

function emitPatches() {
  patches = timeline[cursor]?.state ?? {};
  patchListeners.forEach((l) => l());
}

function subscribePatches(cb: () => void) {
  patchListeners.add(cb);
  return () => patchListeners.delete(cb);
}

/** Merge an optimizer-produced patch into the matrix, recording a timeline version. */
export function applyMatrixPatch(patch: MatrixPatch, label?: string) {
  const next: MatrixPatch = { ...patches };
  for (const [id, vals] of Object.entries(patch)) {
    next[id] = { ...(next[id] ?? {}), ...vals };
  }
  // Branching from an earlier restored point drops the redo tail.
  timeline = [
    ...timeline.slice(0, cursor + 1),
    {
      id: `v-${Date.now()}-${timeline.length}`,
      label: label || `Optimization #${timeline.length}`,
      at: Date.now(),
      state: next,
      changed: Object.keys(patch),
    },
  ];
  cursor = timeline.length - 1;
  emitPatches();
}

/** Step back to the state before the most recent apply. */
export function undoMatrixPatch() {
  if (cursor <= 0) return;
  cursor -= 1;
  emitPatches();
}

/** Step forward again after an undo. */
export function redoMatrixPatch() {
  if (cursor >= timeline.length - 1) return;
  cursor += 1;
  emitPatches();
}

/** Jump to any recorded version in the timeline. */
export function restoreMatrixVersion(id: string) {
  const idx = timeline.findIndex((v) => v.id === id);
  if (idx < 0 || idx === cursor) return;
  cursor = idx;
  emitPatches();
}

/** Drop every optimizer patch and clear the timeline. */
export function resetMatrixPatches() {
  if (timeline.length === 1 && cursor === 0) return;
  timeline = [{ ...BASELINE, at: Date.now() }];
  cursor = 0;
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

function metaKey() {
  return `${cursor}:${timeline.length}:${Object.keys(patches).length}`;
}

export function useMatrixPatchMeta() {
  return useSyncExternalStore(subscribePatches, metaKey, metaKey);
}

export function getMatrixPatchMeta() {
  return {
    canUndo: cursor > 0,
    canRedo: cursor < timeline.length - 1,
    patchedCount: Object.keys(patches).length,
    cursor,
    versionCount: timeline.length,
  };
}

export function getMatrixTimeline() {
  return timeline;
}

export function useMatrixTimeline() {
  useSyncExternalStore(subscribePatches, metaKey, metaKey);
  return { timeline, cursor };
}

