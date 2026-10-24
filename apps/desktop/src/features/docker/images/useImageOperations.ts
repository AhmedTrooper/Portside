import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { usePortsideToast as useToast } from "../../../hooks/usePortsideToast";
import { stringifyError } from "../shared/types";
import { isImageOperation, type ImageOperation } from "./imageOperations";

export function useImageOperations(notify = false) {
  const [operations, setOperations] = useState<Record<string, ImageOperation>>({});
  const [error, setError] = useState<string | null>(null);
  const known = useRef<Record<string, ImageOperation>>({});
  const toast = useToast();
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    async function setup() {
      // Subscribe before reading the snapshot so fast completions cannot be lost.
      const stop = await listen<unknown>("image-operation-update", event => {
        if (cancelled || !isImageOperation(event.payload)) return;
        const op = event.payload;
        const previous = known.current[op.id];
        known.current[op.id] = op;
        setOperations(prev => ({ ...prev, [op.id]: op }));
        if (notify && previous?.status === "running" && op.status !== "running") {
          toast({ type: op.status === "error" ? "error" : "info", isAutoHide: true,
            autoHideDuration: op.status === "error" ? 6000 : 3000,
            body: `${op.kind}: ${op.target} — ${op.status === "done" ? "completed" : "failed"}${op.status === "error" && op.message ? `: ${op.message}` : "."}` });
        }
      });
      if (cancelled) { stop(); return; }
      unlisten = stop;
      const raw: unknown = await invoke("get_image_operations");
      if (cancelled) return;
      if (!Array.isArray(raw)) throw new Error("Unexpected image operation state.");
      const seeded = Object.fromEntries(raw.filter(isImageOperation).map(op => [op.id, op]));
      known.current = { ...seeded, ...known.current };
      setOperations(prev => ({ ...seeded, ...prev }));
      setError(null);
    }
    void setup().catch(e => { if (!cancelled) setError(stringifyError(e)); });
    const timer = window.setInterval(() => {
      const cutoff = Date.now() - 5 * 60_000;
      known.current = Object.fromEntries(Object.entries(known.current).filter(([, op]) => op.status === "running" || (op.finished_at_ms ?? 0) >= cutoff));
      setOperations(prev => {
        const next = Object.fromEntries(Object.entries(prev).filter(([, op]) => op.status === "running" || (op.finished_at_ms ?? 0) >= cutoff));
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1000);
    return () => { cancelled = true; unlisten?.(); window.clearInterval(timer); };
  }, [notify, toast]);
  return { operations: Object.values(operations).sort((a, b) => b.started_at_ms - a.started_at_ms), error };
}
