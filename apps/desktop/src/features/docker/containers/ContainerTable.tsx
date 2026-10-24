import { useEffect, useState, useRef, memo } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Table, TableHeader, TableHeaderCell } from "@astryxdesign/core/Table";
import { Card } from "@astryxdesign/core/Card";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Heading } from "@astryxdesign/core/Text";
import {
  RefreshCw,
  Play,
  Square,
  RotateCw,
  Trash2,
  MoreVertical,
  ShieldAlert,
  CircleDashed,
  CheckCircle2,
  Loader2,
  Pause,
  StopCircle,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { useToast } from "@astryxdesign/core/Toast";

// Match the JSON structure from `docker ps --format '{{json .}}'`
interface DockerContainer extends Record<string, unknown> {
  ID: string;
  Names: string;
  Image: string;
  State: string;
  Status: string;
  Ports: string;
}

const GRID_COLUMNS = "80px 20% 20% 120px 20% 20%";

// =============================================================================
// Status pill configuration
// -----------------------------------------------------------------------------
// Maps every documented Docker container state (and a sensible "unknown"
// fallback) to a coloured CSS dot, optional pulse animation, theme-aware tint,
// semantic icon, and a presentational label. Each entry only references theme
// tokens — no hardcoded colors — so it adapts to any Astryx theme.
//
// Docker states (per `docker ps --format '{{json .}}'`):
//   created | restarting | running | removing | paused | exited | dead
// =============================================================================
type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

interface StatusConfig {
  tone: StatusTone;
  /** Foreground color for the dot, the badge tint and the icon. */
  textColorVar: string;
  /** Background color for the pill behind the dot. */
  bgColorVar: string;
  /** Optional Lucide icon rendered before the label. */
  icon: typeof CheckCircle2;
  /** When true, the dot pulses to draw attention (only for "live" states). */
  pulse: boolean;
  /** Display label shown to the user (defaults to Title-cased state). */
  label: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  running: {
    tone: "success",
    textColorVar: "var(--color-text-green)",
    bgColorVar: "var(--color-background-green)",
    icon: CheckCircle2,
    pulse: true,
    label: "Running",
  },
  paused: {
    tone: "warning",
    textColorVar: "var(--color-text-yellow)",
    bgColorVar: "var(--color-background-yellow)",
    icon: Pause,
    pulse: false,
    label: "Paused",
  },
  restarting: {
    tone: "info",
    textColorVar: "var(--color-text-blue)",
    bgColorVar: "var(--color-background-blue)",
    icon: RotateCw,
    pulse: true,
    label: "Restarting",
  },
  created: {
    tone: "info",
    textColorVar: "var(--color-text-blue)",
    bgColorVar: "var(--color-background-blue)",
    icon: CircleDashed,
    pulse: false,
    label: "Created",
  },
  exited: {
    tone: "error",
    textColorVar: "var(--color-text-red)",
    bgColorVar: "var(--color-background-red)",
    icon: StopCircle,
    pulse: false,
    label: "Exited",
  },
  dead: {
    tone: "error",
    textColorVar: "var(--color-text-red)",
    bgColorVar: "var(--color-background-red)",
    icon: XCircle,
    pulse: false,
    label: "Dead",
  },
  removing: {
    tone: "warning",
    textColorVar: "var(--color-text-yellow)",
    bgColorVar: "var(--color-background-yellow)",
    icon: Loader2,
    pulse: true,
    label: "Removing",
  },
};

const FALLBACK_STATUS: StatusConfig = {
  tone: "neutral",
  textColorVar: "var(--color-text-secondary)",
  bgColorVar: "var(--color-background-muted)",
  icon: HelpCircle,
  pulse: false,
  label: "Unknown",
};

function getStatusConfig(state: string): StatusConfig {
  return STATUS_CONFIG[state.toLowerCase()] ?? FALLBACK_STATUS;
}

// =============================================================================
// StatusPill — a small status indicator: coloured dot + icon + label.
// Renders inline-flex with consistent geometry so all rows line up visually.
// =============================================================================
function StatusPill({ state }: { state: string }) {
  const cfg = getStatusConfig(state);
  const IconComp = cfg.icon;
  return (
    <span
      role="status"
      aria-label={`Status: ${cfg.label}`}
      className="inline-flex items-center gap-1.5 rounded-full text-xs font-medium leading-none px-2 py-1 select-none"
      style={{
        color: cfg.textColorVar,
        backgroundColor: cfg.bgColorVar,
        border: "1px solid color-mix(in srgb, currentColor 30%, transparent)",
      }}
    >
      {/* Pulsing halo for live states (running, restarting, removing) */}
      {cfg.pulse && (
        <span
          aria-hidden
          className="relative inline-flex h-2 w-2"
          style={{ color: cfg.textColorVar }}
        >
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
            style={{ backgroundColor: "currentColor" }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: "currentColor" }}
          />
        </span>
      )}
      {/* Static dot for non-pulsing states */}
      {!cfg.pulse && (
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: cfg.textColorVar }}
        />
      )}
      <IconComp size={12} aria-hidden strokeWidth={2.5} />
      <span>{cfg.label}</span>
    </span>
  );
}

interface ContainerRowProps {
  container: DockerContainer;
  onAction: (action: string, id: string) => void;
}

const ContainerRow = memo(({ container, onAction }: ContainerRowProps) => {
  const isRunning = container.State.toLowerCase() === "running";

  return (
    <div
      className="grid items-center border-b border-default text-sm"
      style={{ gridTemplateColumns: GRID_COLUMNS, height: "100%", width: "100%" }}
    >
      <div className="px-3">
        <DropdownMenu
          button={{
            label: "Row actions",
            icon: <Icon icon={MoreVertical} />,
            variant: "ghost",
            isIconOnly: true,
          }}
          hasChevron={false}
          items={[
            {
              label: "Start",
              icon: <Icon icon={Play} />,
              isDisabled: isRunning,
              onClick: () => onAction("start", container.ID),
            },
            {
              label: "Stop",
              icon: <Icon icon={Square} />,
              isDisabled: !isRunning,
              onClick: () => onAction("stop", container.ID),
            },
            {
              label: "Restart",
              icon: <Icon icon={RotateCw} />,
              isDisabled: !isRunning,
              onClick: () => onAction("restart", container.ID),
            },
            { type: "divider" },
            {
              label: "Remove",
              icon: <Icon icon={Trash2} />,
              isDisabled: isRunning, // Cannot remove running without force
              onClick: () => onAction("remove", container.ID),
            },
            {
              label: "Force Remove",
              icon: <Icon icon={ShieldAlert} className="text-red-500" />,
              onClick: () => onAction("force_remove", container.ID),
            },
          ]}
        />
      </div>
      <div className="truncate px-3">{container.Names}</div>
      <div className="truncate px-3">{container.Image}</div>
      <div className="px-3">
        <StatusPill state={container.State} />
      </div>
      <div className="truncate px-3">{container.Status}</div>
      <div className="truncate px-3">{container.Ports}</div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the container's critical state changes (React.memo optimization)
  return (
    prevProps.container.State === nextProps.container.State &&
    prevProps.container.Status === nextProps.container.Status
  );
});

ContainerRow.displayName = "ContainerRow";

export function ContainerTable() {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: containers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // estimated row height
    overscan: 5,
  });

  const fetchState = async () => {
    try {
      setIsLoading(true);
      const raw: unknown = await invoke("get_global_state");
      const containers = parseContainersFromState(raw);
      if (containers === null) {
        toast({
          type: "error",
          body: "Received an unexpected response from the backend.",
          isAutoHide: false,
        });
        return;
      }
      setContainers(containers);
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to load containers: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let unlisten: () => void = () => {};

    async function setupListener() {
      // 1. Fetch initial state
      await fetchState();

      // 2. Listen for updates — narrow the unknown payload defensively so a
      // backend shape change can't crash the table or feed bad rows.
      unlisten = await listen<unknown>("global-state-updated", (event) => {
        const containers = parseContainersFromState(event.payload);
        if (containers === null) return;
        setContainers(containers);
        setIsLoading(false);
      });
    }

    setupListener();

    return () => {
      unlisten();
    };
  }, []);

  // Re-measure the virtualizer whenever the scroll container resizes (window
  // resize, sidebar collapse, dock position toggle, etc.). Without this the
  // virtualizer may keep a stale measurement and render zero rows.
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      rowVirtualizer.measure();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rowVirtualizer]);

  const handleAction = async (action: string, id: string) => {
    try {
      if (action === "start") {
        await invoke("docker_start_container", { id });
      } else if (action === "stop") {
        await invoke("docker_stop_container", { id });
      } else if (action === "restart") {
        await invoke("docker_restart_container", { id });
      } else if (action === "remove") {
        await invoke("docker_remove_container", { id, force: false });
      } else if (action === "force_remove") {
        await invoke("docker_remove_container", { id, force: true });
      }
      // Trigger a refresh after a small delay to allow docker to process the state change
      setTimeout(fetchState, 500);
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to ${action} container ${shortId(id)}: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    }
  };

  return (
    <Card className="w-full h-full min-h-0 flex flex-col">
      <Toolbar
        label="Container actions"
        size="md"
        dividers={["bottom"]}
        startContent={<Heading level={3}>Live Containers</Heading>}
        endContent={
          <Button
            label="Refresh"
            variant="secondary"
            icon={<Icon icon={RefreshCw} />}
            onClick={fetchState}
          />
        }
      />
      {isLoading && containers.length === 0 ? (
        <div className="p-8 text-center text-gray-500">Loading containers...</div>
      ) : (
        <>
          {/* Header lives OUTSIDE the scroll container so it stays pinned to the top of the Card. */}
          <Table density="spacious" className="shrink-0">
            <TableHeader>
              <TableHeaderCell style={{ width: "80px" }}>
                Actions
              </TableHeaderCell>
              <TableHeaderCell style={{ width: "20%" }}>Name</TableHeaderCell>
              <TableHeaderCell style={{ width: "20%" }}>Image</TableHeaderCell>
              <TableHeaderCell style={{ width: "120px" }}>State</TableHeaderCell>
              <TableHeaderCell style={{ width: "20%" }}>Status</TableHeaderCell>
              <TableHeaderCell style={{ width: "20%" }}>Ports</TableHeaderCell>
            </TableHeader>
          </Table>

          {/* Virtualized body — div-based with absolutely-positioned rows so the
              scroll region reliably fills remaining Card height on both small
              and big screens. */}
          <div ref={parentRef} className="flex-1 min-h-0 overflow-auto">
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: "relative",
                width: "100%",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const container = containers[virtualRow.index];
                return (
                  <div
                    key={container.ID}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <ContainerRow container={container} onAction={handleAction} />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function shortId(id: string): string {
  return id.length > 12 ? id.slice(0, 12) : id;
}

function stringifyError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/**
 * Narrow an unknown payload from `get_global_state` / `global-state-updated`
 * into a `DockerContainer[]`. Returns null on any mismatch — never partially
 * typed data.
 */
function isDockerContainer(value: unknown): value is DockerContainer {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.ID !== "string") return false;
  if (typeof v.Names !== "string") return false;
  if (typeof v.Image !== "string") return false;
  if (typeof v.State !== "string") return false;
  if (typeof v.Status !== "string") return false;
  if (typeof v.Ports !== "string") return false;
  return true;
}

function parseContainersFromState(payload: unknown): DockerContainer[] | null {
  if (!payload || typeof payload !== "object") return null;
  const docker = (payload as Record<string, unknown>).docker;
  if (!docker || typeof docker !== "object") return null;
  const raw = (docker as Record<string, unknown>).containers;
  if (!Array.isArray(raw)) return null;
  const out: DockerContainer[] = [];
  for (const item of raw) {
    if (isDockerContainer(item)) out.push(item);
  }
  return out;
}
