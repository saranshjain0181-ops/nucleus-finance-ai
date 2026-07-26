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
