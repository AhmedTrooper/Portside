import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Heading, Text } from "@astryxdesign/core/Text";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { usePortsideToast as useToast } from "../../../hooks/usePortsideToast";
import {
  Boxes,
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
import { DockerCard, DockerCardHeader, DockerCardIdentity, DockerCardMetaGrid, DockerCardMeta as Meta } from "../shared/DockerCard";
import { StatusPill } from "../shared/StatusPill";
import { useDockerSnapshot } from "../shared/useDockerSnapshot";
import {
  containerComposeProject,
  parseLabels,
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

type ContainerAction = "start" | "stop" | "restart" | "pause" | "unpause";
type ProjectAction = "stop" | "restart";

export function ContainerGrid() {
  const { containers, isLoading, error, refresh } = useDockerSnapshot();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

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

  const runAction = async (action: ContainerAction, container: DockerContainer) => {
    const project = containerComposeProject(container);
    if (project) {
      toast({
        type: "error",
        body: `${container.Names} belongs to Compose project ${project}. Use the project actions instead.`,
        isAutoHide: false,
      });
      return;
    }

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
        body: `${labelForAction(action)} ${container.Names}.`,
        autoHideDuration: 2500,
      });
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to ${action} ${container.Names}: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    } finally {
      // Refresh even when Docker reports a failure: a stop can time out after
      // the container has already exited, so the card must show the real state.
      await refresh();
      setBusyId(null);
    }
  };

  const runProjectAction = async (action: ProjectAction, container: DockerContainer) => {
    const project = containerComposeProject(container);
    if (!project) return;

    setBusyId(container.ID);
    try {
      await invoke(`docker_compose_${action}`, { project, files: [] });
      toast({
        type: "info",
        body: `${action === "stop" ? "Stopped" : "Restarted"} Compose project ${project}.`,
        autoHideDuration: 3000,
      });
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to ${action} Compose project ${project}: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    } finally {
      await refresh();
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
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to remove ${pendingRemove.name}: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    } finally {
      await refresh();
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
            onProjectAction={(action) => void runProjectAction(action, container)}
            onOpenCompose={() => void navigate({ to: "/docker/compose" })}
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
  onAction: (action: ContainerAction) => void;
  onProjectAction: (action: ProjectAction) => void;
  onOpenCompose: () => void;
  onRemove: (force: boolean) => void;
}

function ContainerCard({
  container,
  isBusy,
  onAction,
  onProjectAction,
  onOpenCompose,
  onRemove,
}: ContainerCardProps) {
  const state = container.State.toLowerCase();
  const isRunning = state === "running";
  const isPaused = state === "paused";
  const ports = parsePorts(container.Ports);
  const composeProject = containerComposeProject(container);
  const isCompose = composeProject !== null;
  const projectActive =
    isRunning || isPaused || state === "restarting";
  const labels = parseLabels(container.Labels);
  const composeService = labels["com.docker.compose.service"] ?? null;
  const primaryAction: ContainerAction = isPaused
    ? "unpause"
    : isRunning
      ? "stop"
      : "start";

  const primaryLabel = isCompose
    ? projectActive
      ? "Stop project"
      : "Open Compose"
    : isPaused
      ? "Resume"
      : isRunning
        ? "Stop"
        : "Start";

  const menuItems = isCompose
    ? [
        {
          label: "Stop project",
          icon: <Square size={14} aria-hidden />,
          isDisabled: isBusy || !projectActive,
          onClick: () => onProjectAction("stop"),
        },
        {
          label: "Restart project",
          icon: <RotateCw size={14} aria-hidden />,
          isDisabled: isBusy || !projectActive,
          onClick: () => onProjectAction("restart"),
        },
        { type: "divider" as const },
        {
          label: "Open Compose page",
          icon: <Boxes size={14} aria-hidden />,
          onClick: onOpenCompose,
        },
      ]
    : [
        {
          label: "Start",
          icon: <Play size={14} aria-hidden />,
          isDisabled: isBusy || isRunning || state === "restarting",
          onClick: () => onAction("start"),
        },
        {
          label: "Stop",
          icon: <Square size={14} aria-hidden />,
          isDisabled: isBusy || !isRunning,
          onClick: () => onAction("stop"),
        },
        {
          label: "Restart",
          icon: <RotateCw size={14} aria-hidden />,
          isDisabled: isBusy || (!isRunning && !isPaused),
          onClick: () => onAction("restart"),
        },
        {
          label: "Pause",
          icon: <Pause size={14} aria-hidden />,
          isDisabled: isBusy || !isRunning,
          onClick: () => onAction("pause"),
        },
        {
          label: "Unpause",
          icon: <PlayCircle size={14} aria-hidden />,
          isDisabled: isBusy || !isPaused,
          onClick: () => onAction("unpause"),
        },
        { type: "divider" as const },
        {
          label: "Remove",
          icon: <Trash2 size={14} aria-hidden />,
          isDisabled: isBusy || isRunning,
          onClick: () => onRemove(false),
        },
        {
          label: "Force remove",
          icon: <ShieldAlert size={14} aria-hidden />,
          isDisabled: isBusy,
          onClick: () => onRemove(true),
        },
      ];

  return (
    <DockerCard>
      <DockerCardHeader>
        <DockerCardIdentity>
          <ContainerIcon size={18} aria-hidden className="mt-0.5 shrink-0 opacity-80" />
          <div className="min-w-0 flex-1" title={container.Names}>
            <Heading level={4} className="docker-card-text">
              {container.Names}
            </Heading>
            <div title={container.Image}>
              <Text
                type="supporting"
                color="secondary"
                className="docker-card-text block"
              >
                {container.Image}
              </Text>
            </div>
          </div>
        </DockerCardIdentity>
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <StatusPill state={container.State} />
          <DropdownMenu
            button={{
              label: `Actions for ${container.Names}`,
              icon: <MoreVertical size={16} aria-hidden />,
              variant: "ghost",
              isIconOnly: true,
              size: "sm",
              isDisabled: isBusy,
            }}
            hasChevron={false}
            items={menuItems}
          />
        </div>
      </DockerCardHeader>

      {isCompose ? (
        <div className="flex items-center gap-1.5 text-[11px] opacity-70 min-w-0">
          <Boxes size={12} aria-hidden className="shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]" title={`Compose project ${composeProject}`}>
            Managed by Compose · {composeProject}
          </span>
        </div>
      ) : null}

      <DockerCardMetaGrid>
        <Meta label="Status" value={container.Status} />
        <Meta
          label="Created"
          value={container.RunningFor ?? container.CreatedAt ?? "Unknown"}
        />
        <Meta
          label={isCompose ? "Service" : "Project"}
          value={composeService ?? composeProject ?? "Standalone"}
        />
        <Meta label="Networks" value={container.Networks || "None"} />
      </DockerCardMetaGrid>

      <div className="min-w-0">
        <Text type="docker-meta-label" display="block" color="secondary">Ports</Text>
        {ports.length === 0 ? (
          <div className="text-xs opacity-70 mt-1">No published ports</div>
        ) : (
          <div className="mt-1 flex flex-wrap gap-1">
            {ports.slice(0, 4).map((port) => (
              <span
                key={port}
                className="max-w-full [overflow-wrap:anywhere] rounded px-1.5 py-0.5 text-[11px]"
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

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1 shrink-0">
        <Button
          label={primaryLabel}
          variant={
            isCompose ? "secondary" : isRunning ? "secondary" : "primary"
          }
          size="sm"
          icon={
            isCompose ? (
              projectActive ? (
                <Square size={14} aria-hidden />
              ) : (
                <Boxes size={14} aria-hidden />
              )
            ) : isPaused ? (
              <PlayCircle size={14} aria-hidden />
            ) : isRunning ? (
              <Square size={14} aria-hidden />
            ) : (
              <Play size={14} aria-hidden />
            )
          }
          isLoading={isBusy}
          onClick={() => {
            if (isCompose) {
              if (projectActive) {
                onProjectAction("stop");
              } else {
                onOpenCompose();
              }
            } else {
              onAction(primaryAction);
            }
          }}
        />
        <span className="max-w-full [overflow-wrap:anywhere] text-[11px] opacity-50 font-mono" title={container.ID}>
          {shortId(container.ID)}
        </span>
      </div>
    </DockerCard>
  );
}

function labelForAction(action: ContainerAction): string {
  switch (action) {
    case "start":
      return "Started";
    case "stop":
      return "Stopped";
    case "restart":
      return "Restarted";
    case "pause":
      return "Paused";
    case "unpause":
      return "Resumed";
    default:
      return "Updated";
  }
}
