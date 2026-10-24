export const IMAGE_OPERATION_KINDS = ["pull", "remove", "push", "build", "save", "load", "prune"] as const;
export type ImageOpKind = typeof IMAGE_OPERATION_KINDS[number];
export interface LayerProgress { id: string; current: number; total: number; }
export interface ImageOperation {
  id: string; kind: ImageOpKind; target: string;
  status: "running" | "done" | "error" | "cancelled";
  started_at_ms: number; finished_at_ms: number | null;
  message: string | null; layers: Record<string, LayerProgress>; log?: string;
}
export function isImageOperation(value: unknown): value is ImageOperation {
  if (!value || typeof value !== "object") return false;
  const op = value as Record<string, unknown>;
  return typeof op.id === "string" && typeof op.target === "string" &&
    IMAGE_OPERATION_KINDS.includes(op.kind as ImageOpKind) &&
    ["running", "done", "error", "cancelled"].includes(op.status as string) &&
    typeof op.started_at_ms === "number" && (op.finished_at_ms === null || typeof op.finished_at_ms === "number") &&
    (op.message === null || typeof op.message === "string") && !!op.layers && typeof op.layers === "object" && !Array.isArray(op.layers) &&
    Object.values(op.layers).every(layer => !!layer && typeof layer === "object" &&
      typeof layer.id === "string" && typeof layer.current === "number" && Number.isFinite(layer.current) && layer.current >= 0 &&
      typeof layer.total === "number" && Number.isFinite(layer.total) && layer.total >= 0) &&
    (op.log === undefined || typeof op.log === "string");
}
