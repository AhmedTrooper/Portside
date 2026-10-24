import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  emptyDockerSnapshot,
  parseDockerSnapshot,
  stringifyError,
  type DockerSnapshot,
} from "./types";

const CHANGE_EVENTS = [
  "docker-containers-changed",
  "docker-images-changed",
  "docker-networks-changed",
  "docker-volumes-changed",
  "docker-compose-changed",
];

/**
 * Shared Docker snapshot loader for the dashboard and resource grids.
 *
 * The backend also polls Docker every 60 seconds and emits
 * `global-state-updated` when the snapshot changes. Write actions emit a
 * resource-specific event; those listeners use `refresh_global_state`, which
 * reads Docker immediately instead of returning the poller's cached snapshot.
 */
export function useDockerSnapshot() {
  const [snapshot, setSnapshot] = useState<DockerSnapshot>(emptyDockerSnapshot);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTask = useRef<Promise<void> | null>(null);

  const refresh = useCallback(() => {
    // A write action and its change event can both request a refresh. Keep one
    // Docker read in flight so the UI doesn't issue duplicate work or let an
    // older snapshot land after a newer one.
    if (refreshTask.current) return refreshTask.current;

    setIsLoading(true);
    const task = (async () => {
      try {
        const raw: unknown = await invoke("refresh_global_state");
        const parsed = parseDockerSnapshot(raw);
        if (!parsed) {
          setError("Received an unexpected Docker state from the backend.");
          return;
        }
        setSnapshot(parsed);
        setError(null);
      } catch (e) {
        setError(stringifyError(e));
      } finally {
        setIsLoading(false);
        refreshTask.current = null;
      }
    })();

    refreshTask.current = task;
    return task;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    async function setup() {
      await refresh();
      if (cancelled) return;

      const stateUnlisten = await listen<unknown>("global-state-updated", (event) => {
        if (cancelled) return;
        const parsed = parseDockerSnapshot(event.payload);
        if (!parsed) return;
        setSnapshot(parsed);
        setError(null);
        setIsLoading(false);
      });
      unlisteners.push(stateUnlisten);

      for (const eventName of CHANGE_EVENTS) {
        const unlisten = await listen(eventName, () => {
          if (!cancelled) void refresh();
        });
        if (cancelled) {
          unlisten();
          break;
        }
        unlisteners.push(unlisten);
      }
    }

    void setup();

    return () => {
      cancelled = true;
      for (const unlisten of unlisteners) unlisten();
    };
  }, [refresh]);

  return { ...snapshot, isLoading, error, refresh };
}
