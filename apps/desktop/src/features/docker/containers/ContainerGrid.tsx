import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Heading, Text } from "@astryxdesign/core/Text";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { useToast } from "@astryxdesign/core/Toast";
import {
  Container as ContainerIcon,
  MoreVertical,
  Pause,
  Play,
  PlayCircle,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  Square,
  Trash2,
} from "lucide-react";
import { DockerGrid } from "../shared/DockerGrid";
import { StatusPill } from "../shared/StatusPill";
import { useDockerSnapshot } from "../shared/useDockerSnapshot";
import {
  containerComposeProject,
  parsePorts,
  shortId,
  stringifyError,
  type DockerContainer,
} from "../shared/types";

interface PendingRemove {
  id: string;
  name: string;
  force: boolean;
}

export function ContainerGrid() {
  const { containers, isLoading, error, refresh } = useDockerSnapshot();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const toast = useToast();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return containers;
    return containers.filter((container) => {
      const project = containerComposeProject(container) ?? "";
      return [
        container.Names,
        container.Image,
        container.State,
        container.Status,
        container.Ports,
        container.Networks ?? "",
        project,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [containers, search]);

  const runningCount = useMemo(
    () => containers.filter((container) => container.State.toLowerCase() === "running").length,
    [containers]
  );

  const runAction = async (action: string, container: DockerContainer) => {
    setBusyId(container.ID);
    try {
      if (action === "start") {
        await invoke("docker_start_container", { id: container.ID });
      } else if (action === "stop") {
        await invoke("docker_stop_container", { id: container.ID });
      } else if (action === "restart") {
        await invoke("docker_restart_container", { id: container.ID });
      } else if (action === "pause") {
        await invoke("docker_pause_container", { id: container.ID });
      } else if (action === "unpause") {
        await invoke("docker_unpause_container", { id: container.ID });
      }
      toast({
        type: "info",
        body: `${labelForAction(action)} ${container.Names}…`,
        autoHideDuration: 2500,
      });
      await refresh();
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to ${action} ${container.Names}: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    setIsRemoving(true);
    try {
      await invoke("docker_remove_container", {
        id: pendingRemove.id,
        force: pendingRemove.force,
      });
      toast({
        type: "info",
        body: `${pendingRemove.force ? "Force-removed" : "Removed"} ${pendingRemove.name}.`,
        autoHideDuration: 2500,
      });
      setPendingRemove(null);
      await refresh();
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to remove ${pendingRemove.name}: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <>
      <DockerGrid
        label="Container actions"
        title="Containers"
        icon={ContainerIcon}
        meta={`${containers.length} total · ${runningCount} running`}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search containers"
        toolbarActions={
          <Button
            label="Refresh"
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} aria-hidden />}
            onClick={() => void refresh()}
            isLoading={isLoading}
          />
        }
        isLoading={isLoading}
        error={error}
        itemCount={filtered.length}
        emptyTitle={containers.length === 0 ? "No containers found" : "No matching containers"}
        emptyDescription={
          containers.length === 0
            ? "Create a container with Docker, or pull an image and start one."
            : "Try a different name, image, state, port, or Compose project."
        }
      >
        {filtered.map((container) => (
          <ContainerCard
            key={container.ID}
            container={container}
            isBusy={busyId === container.ID}
            onAction={(action) => void runAction(action, container)}
            onRemove={(force) =>
              setPendingRemove({ id: container.ID, name: container.Names, force })
            }
          />
        ))}
      </DockerGrid>

      <AlertDialog
        isOpen={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
        title={pendingRemove?.force ? "Force remove container?" : "Remove container?"}
        description={
          pendingRemove
            ? `Remove ${pendingRemove.name} (${shortId(pendingRemove.id)})?${
                pendingRemove.force
                  ? " Docker will stop it if necessary and delete it immediately."
                  : " The container must already be stopped."
              }`
            : ""
        }
        actionLabel={pendingRemove?.force ? "Force remove" : "Remove"}
        isActionLoading={isRemoving}
        onAction={() => void confirmRemove()}
      />
    </>
  );
}

interface ContainerCardProps {
  container: DockerContainer;
  isBusy: boolean;
  onAction: (action: string) => void;
  onRemove: (force: boolean) => void;
}

function ContainerCard({ container, isBusy, onAction, onRemove }: ContainerCardProps) {
  const state = container.State.toLowerCase();
  const isRunning = state === "running";
  const isPaused = state === "paused";
  const ports = parsePorts(container.Ports);
  const composeProject = containerComposeProject(container);
  const primaryAction = isPaused ? "unpause" : isRunning ? "stop" : "start";
  const primaryLabel = isPaused ? "Resume" : isRunning ? "Stop" : "Start";

  const menuItems = [
    {
      label: "Start",
      icon: <Play size={14} aria-hidden />,
      isDisabled: isRunning || state === "restarting",
      onClick: () => onAction("start"),
    },
    {
      label: "Stop",
      icon: <Square size={14} aria-hidden />,
      isDisabled: !isRunning,
      onClick: () => onAction("stop"),
    },
    {
      label: "Restart",
      icon: <RotateCw size={14} aria-hidden />,
      isDisabled: !isRunning && !isPaused,
      onClick: () => onAction("restart"),
    },
    {
      label: "Pause",
      icon: <Pause size={14} aria-hidden />,
      isDisabled: !isRunning,
      onClick: () => onAction("pause"),
    },
    {
      label: "Unpause",
      icon: <PlayCircle size={14} aria-hidden />,
      isDisabled: !isPaused,
      onClick: () => onAction("unpause"),
    },
    { type: "divider" as const },
    {
      label: "Remove",
      icon: <Trash2 size={14} aria-hidden />,
      isDisabled: isRunning,
      onClick: () => onRemove(false),
    },
    {
      label: "Force remove",
      icon: <ShieldAlert size={14} aria-hidden />,
      onClick: () => onRemove(true),
    },
  ];

  return (
    <Card padding={4} className="min-w-0 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex items-start gap-2">
          <ContainerIcon size={18} aria-hidden className="mt-0.5 shrink-0 opacity-80" />
          <div className="min-w-0" title={container.Names}>
            <Heading level={4} className="truncate">
              {container.Names}
            </Heading>
            <div title={container.Image}>
              <Text
                type="supporting"
                color="secondary"
                className="block truncate"
              >
                {container.Image}
              </Text>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <StatusPill state={container.State} />
          <DropdownMenu
            button={{
              label: `Actions for ${container.Names}`,
              icon: <MoreVertical size={16} aria-hidden />,
              variant: "ghost",
              isIconOnly: true,
              size: "sm",
            }}
            hasChevron={false}
            items={menuItems}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Meta label="Status" value={container.Status} />
        <Meta
          label="Created"
          value={container.RunningFor ?? container.CreatedAt ?? "Unknown"}
        />
        <Meta
          label="Project"
          value={composeProject ?? "Standalone"}
          icon={composeProject ? "compose" : undefined}
        />
        <Meta label="Networks" value={container.Networks || "None"} />
      </div>

      <div className="min-w-0">
        <span className="text-[10px] uppercase tracking-wide opacity-60">Ports</span>
        {ports.length === 0 ? (
          <div className="text-xs opacity-70 mt-1">No published ports</div>
        ) : (
          <div className="mt-1 flex flex-wrap gap-1">
            {ports.slice(0, 4).map((port) => (
              <span
                key={port}
                className="rounded px-1.5 py-0.5 text-[11px]"
                style={{
                  backgroundColor: "var(--color-background-muted)",
                  color: "var(--color-text-secondary)",
                }}
                title={port}
              >
                {port}
              </span>
            ))}
            {ports.length > 4 ? (
              <span className="text-[11px] opacity-60">+{ports.length - 4} more</span>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <Button
          label={primaryLabel}
          variant={isRunning ? "secondary" : "primary"}
          size="sm"
          icon={
            isPaused ? (
              <PlayCircle size={14} aria-hidden />
            ) : isRunning ? (
              <Square size={14} aria-hidden />
            ) : (
              <Play size={14} aria-hidden />
            )
          }
          isLoading={isBusy}
          onClick={() => onAction(primaryAction)}
        />
        <span className="text-[11px] opacity-50 font-mono" title={container.ID}>
          {shortId(container.ID)}
        </span>
      </div>
    </Card>
  );
}

function Meta({ label, value, icon }: { label: string; value: string; icon?: "compose" }) {
  return (
    <div className="min-w-0">
      <span className="text-[10px] uppercase tracking-wide opacity-60">{label}</span>
      <div className="truncate" title={value}>
        {icon === "compose" ? <span className="opacity-60">compose · </span> : null}
        {value}
      </div>
    </div>
  );
}

function labelForAction(action: string): string {
  switch (action) {
    case "start":
      return "Starting";
    case "stop":
      return "Stopping";
    case "restart":
      return "Restarting";
    case "pause":
      return "Pausing";
    case "unpause":
      return "Resuming";
    default:
      return "Updating";
  }
}
