import { Card } from "@astryxdesign/core/Card";
import { Heading, Text } from "@astryxdesign/core/Text";
import { DOCKER_CARD_STYLE } from "../shared/DockerCard";
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
  Upload,
  Hammer,
  Archive,
} from "lucide-react";
import type { ImageOperation } from "./imageOperations";
import { useImageOperations } from "./useImageOperations";

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
  if (op.kind === "push") return Upload;
  if (op.kind === "build") return Hammer;
  if (op.kind === "save" || op.kind === "load") return Archive;
  return Trash2;
}

function statusLabel(op: ImageOperation): string {
  if (op.status === "done") return "Done";
  if (op.status === "error") return "Error";
  if (op.status === "cancelled") return "Cancelled";
  return { pull: "Pulling", remove: "Removing", push: "Pushing", build: "Building", save: "Saving", load: "Loading", prune: "Pruning" }[op.kind];
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
      <Stack direction="horizontal" gap={2} vAlign="center" wrap="wrap">
        <Icon
          icon={isRunning ? Loader2 : IconComp}
          size="sm"
          className={isRunning ? "animate-spin" : ""}
        />
        <span className="min-w-0 [overflow-wrap:anywhere] text-sm font-medium flex-1" title={op.target}>
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
            label={`${op.kind} progress`}
            isLabelHidden
            variant="accent"
          />
        </div>
      )}
      {!isRunning && op.message && (
        <div className="[overflow-wrap:anywhere] mt-1 text-xs opacity-70" title={op.message}>
          {op.message}
        </div>
      )}
      {op.log && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer">Output</summary>
          <pre className="select-text whitespace-pre-wrap break-all leading-relaxed max-h-[220px] overflow-auto">{op.log}</pre>
        </details>
      )}
    </div>
  );
}

/**
 * Live panel of in-flight and recently-finished image operations.
 *
 * Subscribes to the `image-operation-update` event the backend emits whenever
 * an image workflow's state changes. Recent results and bounded output stay
 * available for five minutes, including across page unmounts.
 */
export function ActiveOpsPanel() {
  const { operations: entries, error } = useImageOperations();

  return (
    <Card padding={0} className="w-full h-full min-w-0 min-h-0 flex flex-col" style={DOCKER_CARD_STYLE}>
      <Stack direction="horizontal" gap={2} vAlign="center" wrap="wrap" className="shrink-0 px-4 py-3 border-b border-default">
        <Heading level={3}>Operations</Heading>
        <span className="text-xs opacity-70">
          {entries.length === 0 ? "Idle" : `${entries.filter(op => op.status === "running").length} active`}
        </span>
      </Stack>
      <div className="flex-1 min-h-0 overflow-auto">
        {error && <Text role="alert" display="block" className="docker-card-text">Could not read image operations: {error}</Text>}
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
