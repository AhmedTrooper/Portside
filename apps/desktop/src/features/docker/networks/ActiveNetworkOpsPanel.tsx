import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Stack } from "@astryxdesign/core/Stack";
import { Icon } from "@astryxdesign/core/Icon";
import {
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Inbox,
} from "lucide-react";

type OpKind = "create" | "remove";
type OpStatus = "running" | "done" | "error" | "cancelled";

interface NetworkOperation {
  id: string;
  kind: OpKind;
  target: string;
  status: OpStatus;
  started_at_ms: number;
  finished_at_ms: number | null;
  message: string | null;
}

const RECENT_KEEP_MS = 5_000; // hold finished ops for 5s so the UI shows "Done"/"Error"

function statusIcon(op: NetworkOperation) {
  if (op.status === "done") return CheckCircle2;
  if (op.status === "error") return XCircle;
  if (op.kind === "create") return Plus;
  return Trash2;
}

function statusLabel(op: NetworkOperation): string {
  if (op.status === "done") return "Done";
  if (op.status === "error") return "Error";
  if (op.status === "cancelled") return "Cancelled";
  if (op.kind === "create") return "Creating";
  return "Removing";
}

function isNetworkOperation(value: unknown): value is NetworkOperation {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string") return false;
  if (v.kind !== "create" && v.kind !== "remove") return false;
  if (typeof v.target !== "string") return false;
  if (v.status !== "running" && v.status !== "done" && v.status !== "error" && v.status !== "cancelled") {
    return false;
  }
  if (typeof v.started_at_ms !== "number") return false;
  if (v.finished_at_ms !== null && typeof v.finished_at_ms !== "number") return false;
  if (v.message !== null && typeof v.message !== "string") return false;
  return true;
}

interface OperationRowProps {
  op: NetworkOperation;
}

function OperationRow({ op }: OperationRowProps) {
  const IconComp = statusIcon(op);
  const isRunning = op.status === "running";

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
      {isRunning && (
        <div className="mt-2">
          <ProgressBar
            isIndeterminate
            label="Network op progress"
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
 * Live panel of in-flight and recently-finished network operations.
 *
 * Subscribes to the `network-operation-update` event the backend emits
 * whenever a create/remove's state changes. Mirrors the same shape as the
 * images panel so the two side-panels look and behave identically.
 */
export function ActiveNetworkOpsPanel() {
  const [ops, setOps] = useState<Record<string, NetworkOperation>>({});

  useEffect(() => {
    let unlisten: () => void = () => {};
    let cancelled = false;

    async function setup() {
      try {
        const raw: unknown = await invoke("get_network_operations");
        if (cancelled) return;
        if (Array.isArray(raw)) {
          const next: Record<string, NetworkOperation> = {};
          for (const item of raw) {
            if (isNetworkOperation(item)) next[item.id] = item;
          }
          setOps(next);
        }
      } catch {
        // Optional command — fine if a backend without it is running.
      }

      unlisten = await listen<unknown>("network-operation-update", (event) => {
        if (cancelled) return;
        const op = event.payload;
        if (!isNetworkOperation(op)) return;
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
        const next: Record<string, NetworkOperation> = {};
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
      <Stack
        direction="horizontal"
        gap={2}
        vAlign="center"
        className="px-4 py-3 border-b border-default"
      >
        <Heading level={3}>Operations</Heading>
        <span className="text-xs opacity-70">
          {entries.length === 0 ? "Idle" : `${entries.length} active`}
        </span>
      </Stack>
      <div className="flex-1 min-h-0 overflow-auto">
        {entries.length === 0 ? (
          <div className="p-6 text-center text-sm opacity-70 inline-flex items-center gap-2 justify-center w-full">
            <Icon icon={Inbox} size="sm" />
            No network operations yet.
          </div>
        ) : (
          entries.map((op) => <OperationRow key={op.id} op={op} />)
        )}
      </div>
    </Card>
  );
}
