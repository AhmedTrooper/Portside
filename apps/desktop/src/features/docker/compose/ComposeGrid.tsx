import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Heading, Text } from "@astryxdesign/core/Text";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { useToast } from "@astryxdesign/core/Toast";
import {
  Boxes,
  MoreVertical,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Square,
  Trash2,
} from "lucide-react";
import { DockerGrid } from "../shared/DockerGrid";
import { StatusPill } from "../shared/StatusPill";
import { useDockerSnapshot } from "../shared/useDockerSnapshot";
import {
  composeBaseState,
  composeFiles,
  composeServiceCount,
  stringifyError,
  type ComposeProject,
} from "../shared/types";
import { DeployComposeDialog } from "./DeployComposeDialog";

interface ComposeTarget {
  project: ComposeProject;
  action: "stop" | "restart" | "down";
}

export function ComposeGrid() {
  const { composeProjects, isLoading, error, refresh } = useDockerSnapshot();
  const [search, setSearch] = useState("");
  const [deployOpen, setDeployOpen] = useState(false);
  const [busyProject, setBusyProject] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [pendingAction, setPendingAction] = useState<ComposeTarget | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const toast = useToast();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return composeProjects;
    return composeProjects.filter((project) =>
      [project.Name, project.Status, project.ConfigFiles]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [composeProjects, search]);

  const runningCount = useMemo(
    () =>
      composeProjects.filter(
        (project) => composeBaseState(project.Status) === "running"
      ).length,
    [composeProjects]
  );

  const runAction = async (
    project: ComposeProject,
    action: "up" | "stop" | "restart" | "down"
  ) => {
    setBusyProject(project.Name);
    try {
      if (action === "up") {
        await invoke("docker_compose_up", {
          project: project.Name,
          files: composeFiles(project),
        });
      } else if (action === "stop") {
        await invoke("docker_compose_stop", {
          project: project.Name,
          files: composeFiles(project),
        });
      } else if (action === "restart") {
        await invoke("docker_compose_restart", {
          project: project.Name,
          files: composeFiles(project),
        });
      } else {
        await invoke("docker_compose_down", {
          project: project.Name,
          files: composeFiles(project),
        });
      }

      toast({
        type: "info",
        body: `${actionLabel(action)} ${project.Name}…`,
        autoHideDuration: 3000,
      });
      await refresh();
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to ${action} ${project.Name}: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    } finally {
      setBusyProject(null);
    }
  };

  const deploy = async (path: string, project: string | null) => {
    setDeployOpen(false);
    setIsDeploying(true);
    try {
      await invoke("docker_compose_up", { project, files: [path] });
      toast({
        type: "info",
        body: `Deployed ${project ?? baseName(path)}…`,
        autoHideDuration: 3000,
      });
      await refresh();
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to deploy Compose file: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const confirmPending = async () => {
    if (!pendingAction) return;
    setIsConfirming(true);
    await runAction(pendingAction.project, pendingAction.action);
    setIsConfirming(false);
    setPendingAction(null);
  };

  return (
    <>
      <DockerGrid
        label="Compose project actions"
        title="Compose projects"
        icon={Boxes}
        meta={`${composeProjects.length} total · ${runningCount} running`}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search Compose projects"
        toolbarActions={
          <div className="inline-flex items-center gap-2">
            <Button
              label="Deploy"
              variant="primary"
              size="sm"
              icon={<Plus size={14} aria-hidden />}
              onClick={() => setDeployOpen(true)}
              isLoading={isDeploying}
            />
            <Button
              label="Refresh"
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} aria-hidden />}
              onClick={() => void refresh()}
              isLoading={isLoading}
            />
          </div>
        }
        isLoading={isLoading}
        error={error}
        itemCount={filtered.length}
        emptyTitle={
          composeProjects.length === 0
            ? "No Compose projects found"
            : "No matching projects"
        }
        emptyDescription={
          composeProjects.length === 0
            ? "Deploy a docker-compose.yml or compose.yaml file to create your first project."
            : "Try a different project name, status, or file path."
        }
        emptyAction={
          composeProjects.length === 0 ? (
            <Button
              label="Deploy a Compose file"
              variant="primary"
              size="sm"
              icon={<Plus size={14} aria-hidden />}
              onClick={() => setDeployOpen(true)}
            />
          ) : undefined
        }
      >
        {filtered.map((project) => (
          <ComposeCard
            key={project.Name}
            project={project}
            isBusy={busyProject === project.Name}
            onAction={(action) => {
              if (action === "down") {
                setPendingAction({ project, action });
              } else {
                void runAction(project, action);
              }
            }}
          />
        ))}
      </DockerGrid>

      <DeployComposeDialog
        isOpen={deployOpen}
        onClose={() => setDeployOpen(false)}
        onSubmit={(path, project) => void deploy(path, project)}
      />

      <AlertDialog
        isOpen={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        title="Take Compose project down?"
        description={
          pendingAction
            ? `Stop and remove the containers and default network for ${pendingAction.project.Name}. Named volumes are kept.`
            : ""
        }
        actionLabel="Take down"
        isActionLoading={isConfirming}
        onAction={() => void confirmPending()}
      />
    </>
  );
}

interface ComposeCardProps {
  project: ComposeProject;
  isBusy: boolean;
  onAction: (action: "up" | "stop" | "restart" | "down") => void;
}

function ComposeCard({ project, isBusy, onAction }: ComposeCardProps) {
  const state = composeBaseState(project.Status);
  const isRunning = state === "running" || state === "restarting";
  const serviceCount = composeServiceCount(project.Status);
  const files = composeFiles(project);
  const statusLabel = `${capitalize(state)}${
    serviceCount !== null ? ` · ${serviceCount} service${serviceCount === 1 ? "" : "s"}` : ""
  }`;

  return (
    <Card padding={4} className="min-w-0 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex items-start gap-2">
          <Boxes size={18} aria-hidden className="mt-0.5 shrink-0 opacity-80" />
          <div className="min-w-0">
            <Heading level={4} className="truncate">
              {project.Name}
            </Heading>
            <Text type="supporting" color="secondary" className="block truncate">
              {files.length === 1 ? baseName(files[0]) : `${files.length} Compose files`}
            </Text>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <StatusPill state={state} label={statusLabel} />
          <DropdownMenu
            button={{
              label: `Actions for ${project.Name}`,
              icon: <MoreVertical size={16} aria-hidden />,
              variant: "ghost",
              isIconOnly: true,
              size: "sm",
            }}
            hasChevron={false}
            items={[
              {
                label: "Up",
                icon: <Play size={14} aria-hidden />,
                isDisabled: isBusy,
                onClick: () => onAction("up"),
              },
              {
                label: "Restart",
                icon: <RotateCw size={14} aria-hidden />,
                isDisabled: !isRunning || isBusy,
                onClick: () => onAction("restart"),
              },
              {
                label: "Stop",
                icon: <Square size={14} aria-hidden />,
                isDisabled: !isRunning || isBusy,
                onClick: () => onAction("stop"),
              },
              { type: "divider" as const },
              {
                label: "Take down",
                icon: <Trash2 size={14} aria-hidden />,
                isDisabled: isBusy,
                onClick: () => onAction("down"),
              },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Meta label="Status" value={project.Status} />
        <Meta
          label="Config files"
          value={files.length === 1 ? baseName(files[0]) : `${files.length} files`}
        />
      </div>

      <div className="mt-auto min-w-0">
        <span className="text-[10px] uppercase tracking-wide opacity-60">Compose file</span>
        <div className="mt-1 space-y-1">
          {files.slice(0, 2).map((file) => (
            <div
              key={file}
              className="font-mono text-[11px] truncate opacity-80"
              title={file}
            >
              {file}
            </div>
          ))}
          {files.length > 2 ? (
            <div className="text-[11px] opacity-60">+{files.length - 2} more</div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button
          label={isRunning ? "Stop" : "Up"}
          variant={isRunning ? "secondary" : "primary"}
          size="sm"
          icon={
            isRunning ? <Square size={14} aria-hidden /> : <Play size={14} aria-hidden />
          }
          isLoading={isBusy}
          onClick={() => onAction(isRunning ? "stop" : "up")}
        />
        <span className="text-[11px] opacity-50 truncate" title={project.ConfigFiles}>
          {files.length ? baseName(files[0]) : "No config file"}
        </span>
      </div>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-[10px] uppercase tracking-wide opacity-60">{label}</span>
      <div className="truncate">{value}</div>
    </div>
  );
}

function capitalize(value: string): string {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value;
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function actionLabel(action: string): string {
  switch (action) {
    case "up":
      return "Starting";
    case "stop":
      return "Stopping";
    case "restart":
      return "Restarting";
    case "down":
      return "Taking down";
    default:
      return "Updating";
  }
}
