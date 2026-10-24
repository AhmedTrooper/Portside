import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Heading, Text } from "@astryxdesign/core/Text";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { useToast } from "@astryxdesign/core/Toast";
import {
  GitBranch,
  Lock,
  MoreVertical,
  Network,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { DockerGrid } from "../shared/DockerGrid";
import { useDockerSnapshot } from "../shared/useDockerSnapshot";
import {
  parseLabels,
  shortId,
  stringifyError,
  type DockerNetwork,
} from "../shared/types";
import { CreateNetworkDialog } from "./CreateNetworkDialog";

const SYSTEM_NETWORKS = new Set(["bridge", "host", "none"]);

function isSystemNetwork(network: DockerNetwork): boolean {
  return SYSTEM_NETWORKS.has(network.Name);
}

export function NetworkGrid() {
  const { networks, isLoading, error, refresh } = useDockerSnapshot();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<DockerNetwork | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const toast = useToast();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return networks;
    return networks.filter((network) =>
      [
        network.Name,
        network.Driver,
        network.Scope,
        network.ID,
        network.Labels,
        network.IPv4 === "true" ? "ipv4" : "",
        network.IPv6 === "true" ? "ipv6" : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [networks, search]);

  const systemCount = useMemo(
    () => networks.filter(isSystemNetwork).length,
    [networks]
  );

  const handleCreate = async (name: string, driver: string) => {
    try {
      setCreateOpen(false);
      await invoke("docker_create_network", { name, driver });
      toast({
        type: "info",
        body: `Creating ${driver} network ${name}…`,
        autoHideDuration: 3000,
      });
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to start create: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    }
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    setIsRemoving(true);
    try {
      await invoke("docker_remove_network", { name: pendingRemove.Name });
      toast({
        type: "info",
        body: `Removing network ${pendingRemove.Name}…`,
        autoHideDuration: 3000,
      });
      setPendingRemove(null);
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to remove network: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <>
      <DockerGrid
        label="Network actions"
        title="Networks"
        icon={Network}
        meta={`${networks.length} total${systemCount ? ` · ${systemCount} system` : ""}`}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search networks"
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
        emptyTitle={networks.length === 0 ? "No networks found" : "No matching networks"}
        emptyDescription={
          networks.length === 0
            ? "Create a bridge network to connect containers on this host."
            : "Try a different name, driver, scope, or label."
        }
        emptyAction={
          networks.length === 0 ? (
            <Button
              label="Create a network"
              variant="primary"
              size="sm"
              icon={<Plus size={14} aria-hidden />}
              onClick={() => setCreateOpen(true)}
            />
          ) : undefined
        }
      >
        {filtered.map((network) => (
          <NetworkCard
            key={network.ID}
            network={network}
            onRemove={() => setPendingRemove(network)}
          />
        ))}
      </DockerGrid>

      <CreateNetworkDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <AlertDialog
        isOpen={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
        title="Remove network?"
        description={
          pendingRemove
            ? `Remove ${pendingRemove.Name} (${shortId(pendingRemove.ID)})? Containers attached to this network will lose connectivity until they are reconnected.`
            : ""
        }
        actionLabel="Remove network"
        isActionLoading={isRemoving}
        onAction={() => void confirmRemove()}
      />
    </>
  );
}

interface NetworkCardProps {
  network: DockerNetwork;
  onRemove: () => void;
}

function NetworkCard({ network, onRemove }: NetworkCardProps) {
  const system = isSystemNetwork(network);
  const labels = parseLabels(network.Labels);
  const labelEntries = Object.entries(labels).slice(0, 2);
  const internal = network.Internal === "true";

  return (
    <Card padding={4} className="min-w-0 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex items-start gap-2">
          <GitBranch size={18} aria-hidden className="mt-0.5 shrink-0 opacity-80" />
          <div className="min-w-0">
            <Heading level={4} className="truncate">
              {network.Name}
            </Heading>
            <Text type="supporting" color="secondary" className="block truncate">
              {network.Driver} · {network.Scope}
            </Text>
          </div>
        </div>
        <DropdownMenu
          button={{
            label: `Actions for ${network.Name}`,
            icon: <MoreVertical size={16} aria-hidden />,
            variant: "ghost",
            isIconOnly: true,
            size: "sm",
          }}
          hasChevron={false}
          items={[
            {
              label: system ? "System network" : "Remove",
              icon: <Trash2 size={14} aria-hidden />,
              isDisabled: system,
              onClick: onRemove,
            },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {system ? <Tag label="system" /> : <Tag label="user-defined" />}
        {internal ? <Tag label="internal" icon={<Lock size={10} aria-hidden />} /> : null}
        {network.IPv4 === "true" ? <Tag label="IPv4" /> : null}
        {network.IPv6 === "true" ? <Tag label="IPv6" /> : null}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Meta label="Driver" value={network.Driver} />
        <Meta label="Scope" value={network.Scope} />
        <Meta label="Network ID" value={shortId(network.ID, 16)} mono />
        <Meta
          label="Labels"
          value={Object.keys(labels).length ? `${Object.keys(labels).length}` : "None"}
        />
      </div>

      <div className="mt-auto min-w-0">
        <span className="text-[10px] uppercase tracking-wide opacity-60">Configuration</span>
        <div className="mt-1 text-xs truncate" title={network.Labels || "No labels"}>
          {labelEntries.length === 0
            ? "No labels"
            : labelEntries.map(([key, value]) => `${key.replace(/^com\.docker\.compose\./, "")}=${value}`).join(" · ")}
        </div>
      </div>
    </Card>
  );
}

function Tag({ label, icon }: { label: string; icon?: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]"
      style={{
        backgroundColor: "var(--color-background-muted)",
        color: "var(--color-text-secondary)",
      }}
    >
      {icon}
      {label}
    </span>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="text-[10px] uppercase tracking-wide opacity-60">{label}</span>
      <div className={`truncate ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
