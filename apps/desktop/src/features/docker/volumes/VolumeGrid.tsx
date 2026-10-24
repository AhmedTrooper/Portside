import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Heading, Text } from "@astryxdesign/core/Text";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { useToast } from "@astryxdesign/core/Toast";
import {
  Database,
  MoreVertical,
  Plus,
  RefreshCw,
  Trash2,
  Wind,
} from "lucide-react";
import { DockerGrid } from "../shared/DockerGrid";
import { DockerCard } from "../shared/DockerCard";
import { useDockerSnapshot } from "../shared/useDockerSnapshot";
import {
  parseLabels,
  stringifyError,
  type DockerVolume,
} from "../shared/types";
import { CreateVolumeDialog } from "./CreateVolumeDialog";

export function VolumeGrid() {
  const { volumes, isLoading, error, refresh } = useDockerSnapshot();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<DockerVolume | null>(null);
  const [pruneOpen, setPruneOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isPruning, setIsPruning] = useState(false);
  const toast = useToast();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return volumes;
    return volumes.filter((volume) =>
      [volume.Name, volume.Driver, volume.Scope, volume.Mountpoint, volume.Labels ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [volumes, search]);

  const handleCreate = async (name: string) => {
    try {
      setCreateOpen(false);
      await invoke("docker_create_volume", { name });
      toast({
        type: "info",
        body: `Created volume ${name}.`,
        autoHideDuration: 2500,
      });
      await refresh();
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to create volume: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    }
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    setIsRemoving(true);
    try {
      await invoke("docker_remove_volume", { name: pendingRemove.Name });
      toast({
        type: "info",
        body: `Removed volume ${pendingRemove.Name}.`,
        autoHideDuration: 2500,
      });
      setPendingRemove(null);
      await refresh();
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to remove volume: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const confirmPrune = async () => {
    setIsPruning(true);
    try {
      const output = await invoke<string>("docker_prune_volumes");
      toast({
        type: "info",
        body: output || "Pruned unused volumes.",
        autoHideDuration: 4000,
      });
      setPruneOpen(false);
      await refresh();
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to prune volumes: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    } finally {
      setIsPruning(false);
    }
  };

  return (
    <>
      <DockerGrid
        label="Volume actions"
        title="Volumes"
        icon={Database}
        meta={`${volumes.length} total`}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search volumes"
        toolbarActions={
          <div className="inline-flex items-center gap-2">
            <Button
              label="Create"
              variant="primary"
              size="sm"
              icon={<Plus size={14} aria-hidden />}
              onClick={() => setCreateOpen(true)}
            />
            <Button
              label="Prune"
              variant="secondary"
              size="sm"
              icon={<Wind size={14} aria-hidden />}
              onClick={() => setPruneOpen(true)}
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
        emptyTitle={volumes.length === 0 ? "No volumes found" : "No matching volumes"}
        emptyDescription={
          volumes.length === 0
            ? "Create a volume to persist data independently of a container."
            : "Try a different name, driver, or mount path."
        }
        emptyAction={
          volumes.length === 0 ? (
            <Button
              label="Create a volume"
              variant="primary"
              size="sm"
              icon={<Plus size={14} aria-hidden />}
              onClick={() => setCreateOpen(true)}
            />
          ) : undefined
        }
      >
        {filtered.map((volume) => (
          <VolumeCard
            key={volume.Name}
            volume={volume}
            onRemove={() => setPendingRemove(volume)}
          />
        ))}
      </DockerGrid>

      <CreateVolumeDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(name) => void handleCreate(name)}
      />

      <AlertDialog
        isOpen={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
        title="Remove volume?"
        description={
          pendingRemove
            ? `Remove ${pendingRemove.Name}? This permanently deletes the data stored at ${pendingRemove.Mountpoint}.`
            : ""
        }
        actionLabel="Remove volume"
        isActionLoading={isRemoving}
        onAction={() => void confirmRemove()}
      />

      <AlertDialog
        isOpen={pruneOpen}
        onOpenChange={setPruneOpen}
        title="Prune unused volumes?"
        description="Docker will permanently delete every volume that is not attached to a container. Volumes in use are left alone."
        actionLabel="Prune volumes"
        isActionLoading={isPruning}
        onAction={() => void confirmPrune()}
      />
    </>
  );
}

interface VolumeCardProps {
  volume: DockerVolume;
  onRemove: () => void;
}

function VolumeCard({ volume, onRemove }: VolumeCardProps) {
  const labels = parseLabels(volume.Labels);
  const composeProject = labels["com.docker.compose.project"];
  const mountpoint = volume.Mountpoint || "Unknown";

  return (
    <DockerCard>
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex items-start gap-2">
          <Database size={18} aria-hidden className="mt-0.5 shrink-0 opacity-80" />
          <div className="min-w-0">
            <Heading level={4} className="truncate">
              {volume.Name}
            </Heading>
            <Text type="supporting" color="secondary" className="block truncate">
              {volume.Driver} · {volume.Scope}
            </Text>
          </div>
        </div>
        <DropdownMenu
          button={{
            label: `Actions for ${volume.Name}`,
            icon: <MoreVertical size={16} aria-hidden />,
            variant: "ghost",
            isIconOnly: true,
            size: "sm",
          }}
          hasChevron={false}
          items={[
            {
              label: "Remove",
              icon: <Trash2 size={14} aria-hidden />,
              onClick: onRemove,
            },
          ]}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {composeProject ? <Tag label={`compose · ${composeProject}`} /> : <Tag label="standalone" />}
        <Tag label={volume.Driver} />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Meta label="Scope" value={volume.Scope} />
        <Meta label="Size" value={volume.Size && volume.Size !== "N/A" ? volume.Size : "Unknown"} />
      </div>

      <div className="mt-auto min-w-0">
        <span className="text-[10px] uppercase tracking-wide opacity-60">Mountpoint</span>
        <div className="mt-1 font-mono text-[11px] break-all opacity-80">{mountpoint}</div>
      </div>
    </DockerCard>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[11px]"
      style={{
        backgroundColor: "var(--color-background-muted)",
        color: "var(--color-text-secondary)",
      }}
    >
      {label}
    </span>
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
