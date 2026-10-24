import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Text";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Stack } from "@astryxdesign/core/Stack";
import { Icon } from "@astryxdesign/core/Icon";
import {
  Download,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Inbox,
} from "lucide-react";

type OpKind = "pull" | "remove";
type OpStatus = "running" | "done" | "error" | "cancelled";

interface LayerProgress {
  id: string;
  current: number;
  total: number;
}

interface ImageOperation {
  id: string;
  kind: OpKind;
  target: string;
  status: OpStatus;
  started_at_ms: number;
  finished_at_ms: number | null;
  message: string | null;
  layers: Record<string, LayerProgress>;
}

const RECENT_KEEP_MS = 5_000; // hold finished ops for 5s so the UI can show "Done"

function aggregateProgress(op: ImageOperation): { current: number; total: number } {
  let current = 0;
  let total = 0;
  for (const layer of Object.values(op.layers)) {
    current += layer.current;
    total += layer.total;
  }
  return { current, total };
}

function statusVariant(op: ImageOperation): "accent" | "success" | "error" {
  if (op.status === "done") return "success";
  if (op.status === "error") return "error";
  return "accent";
}

function statusIcon(op: ImageOperation) {
  if (op.status === "done") return CheckCircle2;
  if (op.status === "error") return XCircle;
  if (op.kind === "pull") return Download;
  return Trash2;
}

function statusLabel(op: ImageOperation): string {
  if (op.status === "done") return "Done";
  if (op.status === "error") return "Error";
  if (op.status === "cancelled") return "Cancelled";
  if (op.kind === "pull") return "Pulling";
  return "Removing";
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  if (unit === 0) return `${Math.round(value)} ${units[unit]}`;
  return `${value.toFixed(1)} ${units[unit]}`;
}

interface OperationRowProps {
  op: ImageOperation;
}

function OperationRow({ op }: OperationRowProps) {
  const IconComp = statusIcon(op);
  const progress = aggregateProgress(op);
  const isRunning = op.status === "running";
  const indeterminate = isRunning && op.kind !== "pull";
  const pullRunning = isRunning && op.kind === "pull";

  return (
    <div className="border-b border-default last:border-b-0 px-3 py-2">
      <Stack direction="horizontal" gap={2} vAlign="center">
        <Icon
          icon={isRunning ? Loader2 : IconComp}
          size="sm"
          className={isRunning ? "animate-spin" : ""}
        />
        <span className="text-sm font-medium truncate flex-1" title={op.target}>
          {op.target}
        </span>
        <span className="text-xs opacity-70">{statusLabel(op)}</span>
      </Stack>
      {pullRunning && progress.total > 0 && (
        <div className="mt-2">
          <ProgressBar
            value={progress.current}
            max={Math.max(progress.total, 1)}
            label="Download progress"
            isLabelHidden
            variant={statusVariant(op)}
            hasValueLabel
            formatValueLabel={(v, m) => `${formatBytes(v)} / ${formatBytes(m)}`}
          />
        </div>
      )}
      {pullRunning && progress.total === 0 && (
        <div className="mt-2">
          <ProgressBar
            isIndeterminate
            label="Pull progress"
            isLabelHidden
            variant="accent"
          />
        </div>
      )}
      {indeterminate && (
        <div className="mt-2">
          <ProgressBar
            isIndeterminate
            label="Remove progress"
            isLabelHidden
            variant="accent"
          />
        </div>
      )}
      {!isRunning && op.message && (
        <div className="mt-1 text-xs opacity-70 truncate" title={op.message}>
          {op.message}
        </div>
      )}
    </div>
  );
}

/**
 * Live panel of in-flight and recently-finished image operations.
 *
 * Subscribes to the `image-operation-update` event the backend emits whenever
 * a pull/remove's state changes. Finished operations are kept in the UI for
 * a few seconds so the user sees the "Done" or "Error" pill before the entry
 * rolls off.
 */
export function ActiveOpsPanel() {
  const [ops, setOps] = useState<Record<string, ImageOperation>>({});

  useEffect(() => {
    let unlisten: () => void = () => {};
    let cancelled = false;

    async function setup() {
      // Seed the map with any in-flight ops from the backend's shared state.
      // The command is optional (older builds won't have it), so any failure
      // is treated as "nothing to seed" rather than an error.
      try {
        const raw: unknown = await invoke("get_image_operations");
        if (cancelled) return;
        if (Array.isArray(raw)) {
          const opsList: ImageOperation[] = [];
          for (const item of raw) {
            if (isImageOperation(item)) {
              opsList.push(item);
            }
          }
          const next: Record<string, ImageOperation> = {};
          for (const op of opsList) {
            next[op.id] = op;
          }
          setOps(next);
        }
      } catch {
        // Backend without the command yet — start empty.
      }

      unlisten = await listen<unknown>("image-operation-update", (event) => {
        if (cancelled) return;
        const op = event.payload;
        if (!isImageOperation(op)) return;
        setOps((prev) => ({ ...prev, [op.id]: op }));
      });
    }

    setup();

    return () => {
      cancelled = true;
      unlisten();
    };
  }, []);

  // GC finished ops after a while so the panel doesn't grow indefinitely.
  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      setOps((prev) => {
        const next: Record<string, ImageOperation> = {};
        let changed = false;
        for (const [id, op] of Object.entries(prev)) {
          const finishedMs = op.finished_at_ms ?? 0;
          if (op.status === "running" || now - finishedMs < RECENT_KEEP_MS) {
            next[id] = op;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const entries = Object.values(ops).sort((a, b) => b.started_at_ms - a.started_at_ms);

  return (
    <Card className="w-full h-full min-h-0 flex flex-col">
      <Stack direction="horizontal" gap={2} vAlign="center" className="px-4 py-3 border-b border-default">
        <Heading level={3}>Operations</Heading>
        <span className="text-xs opacity-70">
          {entries.length === 0 ? "Idle" : `${entries.length} active`}
        </span>
      </Stack>
      <div className="flex-1 min-h-0 overflow-auto">
        {entries.length === 0 ? (
          <div className="p-6 text-center text-sm opacity-70 inline-flex items-center gap-2 justify-center w-full">
            <Icon icon={Inbox} size="sm" />
            No image operations yet.
          </div>
        ) : (
          entries.map((op) => <OperationRow key={op.id} op={op} />)
        )}
      </div>
    </Card>
  );
}

/**
 * Narrow an `unknown` value into an `ImageOperation`. Used at the trust
 * boundary between Tauri and React: an event payload could be missing,
 * malformed, or come from an older binary. Anything we can't prove safe
 * is dropped — never surfaced to the UI as garbage.
 */
function isImageOperation(value: unknown): value is ImageOperation {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string") return false;
  if (v.kind !== "pull" && v.kind !== "remove") return false;
  if (typeof v.target !== "string") return false;
  if (v.status !== "running" && v.status !== "done" && v.status !== "error" && v.status !== "cancelled") {
    return false;
  }
  if (typeof v.started_at_ms !== "number") return false;
  if (v.finished_at_ms !== null && typeof v.finished_at_ms !== "number") return false;
  if (v.message !== null && typeof v.message !== "string") return false;
  if (!v.layers || typeof v.layers !== "object") return false;
  return true;
}
