import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card } from "@astryxdesign/core/Card";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Heading } from "@astryxdesign/core/Text";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import {
  RefreshCw,
  Plus,
  Trash2,
  MoreVertical,
  Network,
  GitBranch,
} from "lucide-react";
import { useToast } from "@astryxdesign/core/Toast";
import { CreateNetworkDialog } from "./CreateNetworkDialog";

// Match the JSON shape emitted by `docker network ls --format '{{json .}}'`.
interface DockerNetwork extends Record<string, unknown> {
  ID: string;
  Name: string;
  Driver: string;
  Scope: string;
  Internal: string;
  IPv4: string;
  IPv6: string;
  Labels: string;
  CreatedAt: string;
}

// Fixed minimum widths so name / driver / scope / id stay readable before
// truncation; the body scrolls horizontally when the viewport is narrower
// than the column track's min-width (sum ≈ 700px).
const GRID_COLUMNS = "80px minmax(180px, 1.4fr) 120px 100px 140px minmax(160px, 1fr)";

const SYSTEM_NETWORKS = new Set(["bridge", "host", "none"]);

function isSystemNetwork(network: DockerNetwork): boolean {
  return SYSTEM_NETWORKS.has(network.Name);
}

interface NetworkRowProps {
  network: DockerNetwork;
  onRemove: (name: string) => void;
}

import { memo } from "react";

const NetworkRow = memo(({ network, onRemove }: NetworkRowProps) => {
  const isSystem = isSystemNetwork(network);
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
              label: "Remove",
              icon: <Icon icon={Trash2} />,
              isDisabled: isSystem,
              onClick: () => {
                if (!isSystem) onRemove(network.Name);
              },
            },
          ]}
        />
      </div>
      <div className="truncate px-3" title={network.Name}>
        <span className="font-medium">{network.Name}</span>
        {isSystem && (
          <span className="ml-2 text-xs opacity-60">(system)</span>
        )}
      </div>
      <div className="truncate px-3" title={network.Driver}>
        {network.Driver}
      </div>
      <div className="truncate px-3" title={network.Scope}>
        {network.Scope}
      </div>
      <div className="truncate px-3" title={network.ID}>
        <code className="text-xs opacity-80">{network.ID}</code>
      </div>
      <div className="truncate px-3" title={network.Labels || "—"}>
        <span className="text-xs opacity-70">{network.Labels || "—"}</span>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.network.ID === next.network.ID && prev.network.Name === next.network.Name;
});

NetworkRow.displayName = "NetworkRow";

function isDockerNetwork(value: unknown): value is DockerNetwork {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.ID !== "string") return false;
  if (typeof v.Name !== "string") return false;
  if (typeof v.Driver !== "string") return false;
  if (typeof v.Scope !== "string") return false;
  if (typeof v.Internal !== "string") return false;
  if (typeof v.IPv4 !== "string") return false;
  if (typeof v.IPv6 !== "string") return false;
  if (typeof v.Labels !== "string") return false;
  if (typeof v.CreatedAt !== "string") return false;
  return true;
}

function parseNetworksFromState(payload: unknown): DockerNetwork[] | null {
  if (!payload || typeof payload !== "object") return null;
  const docker = (payload as Record<string, unknown>).docker;
  if (!docker || typeof docker !== "object") return null;
  const raw = (docker as Record<string, unknown>).networks;
  if (!Array.isArray(raw)) return null;
  const out: DockerNetwork[] = [];
  for (const item of raw) {
    if (isDockerNetwork(item)) out.push(item);
  }
  return out;
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

export function NetworkTable() {
  const [networks, setNetworks] = useState<DockerNetwork[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const fetchNetworks = async () => {
    try {
      setIsLoading(true);
      const raw: unknown = await invoke("get_global_state");
      const parsed = parseNetworksFromState(raw);
      if (parsed === null) {
        toast({
          type: "error",
          body: "Received an unexpected response from the backend.",
          isAutoHide: false,
        });
        return;
      }
      setNetworks(parsed);
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to load networks: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let unlistenState: () => void = () => {};
    let unlistenChanged: () => void = () => {};
    let cancelled = false;

    async function setup() {
      await fetchNetworks();
      if (cancelled) return;

      unlistenState = await listen<unknown>("global-state-updated", (event) => {
        const parsed = parseNetworksFromState(event.payload);
        if (parsed === null) return;
        setNetworks(parsed);
        setIsLoading(false);
      });

      unlistenChanged = await listen("docker-networks-changed", () => {
        fetchNetworks();
      });
    }

    setup();

    return () => {
      cancelled = true;
      unlistenState();
      unlistenChanged();
    };
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: networks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => rowVirtualizer.measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [rowVirtualizer]);

  const handleRemove = async (name: string) => {
    try {
      await invoke("docker_remove_network", { name });
      toast({
        type: "info",
        body: `Removing network ${name}…`,
        autoHideDuration: 3000,
      });
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to remove network: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    }
  };

  const handleCreate = async (name: string) => {
    try {
      setCreateOpen(false);
      await invoke("docker_create_network", { name });
      toast({
        type: "info",
        body: `Creating network ${name}…`,
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

  const systemCount = useMemo(
    () => networks.filter(isSystemNetwork).length,
    [networks]
  );

  return (
    <Card className="w-full h-full min-h-0 flex flex-col">
      <Toolbar
        label="Network actions"
        size="md"
        dividers={["bottom"]}
        startContent={
          <div className="inline-flex items-center gap-2">
            <Heading level={3}>Networks</Heading>
            <span className="text-xs opacity-70 inline-flex items-center gap-1">
              <Network size={12} aria-hidden />
              {networks.length} total
              {systemCount > 0 ? ` · ${systemCount} system` : ""}
            </span>
          </div>
        }
        endContent={
          <div className="inline-flex items-center gap-2">
            <Button
              label="Create"
              variant="primary"
              icon={<Icon icon={Plus} />}
              onClick={() => setCreateOpen(true)}
            />
            <Button
              label="Refresh"
              variant="secondary"
              icon={<Icon icon={RefreshCw} />}
              onClick={fetchNetworks}
            />
          </div>
        }
      />

      {isLoading && networks.length === 0 ? (
        <div className="p-8 text-center text-gray-500">Loading networks…</div>
      ) : networks.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <div className="mb-2">No networks found.</div>
          <Button
            label="Create your first network"
            variant="primary"
            icon={<Icon icon={Plus} />}
            onClick={() => setCreateOpen(true)}
          />
        </div>
      ) : (
        <>
          {/* Single scroll container for both axes. The header sticks to the
              top of this container while the body scrolls vertically
              underneath, and both scroll horizontally together when the
              viewport is narrower than the column track's min-width. */}
          <div ref={parentRef} className="flex-1 min-h-0 overflow-auto">
            <div style={{ minWidth: "780px", width: "100%" }}>
              <div
                className="grid items-center border-b border-default text-xs font-semibold opacity-80"
                style={{
                  gridTemplateColumns: GRID_COLUMNS,
                  height: "40px",
                  position: "sticky",
                  top: 0,
                  backgroundColor: "var(--color-surface, transparent)",
                  zIndex: 1,
                }}
              >
                <div className="px-3">Actions</div>
                <div className="px-3 inline-flex items-center gap-1.5">
                  <GitBranch size={12} aria-hidden />
                  Name
                </div>
                <div className="px-3">Driver</div>
                <div className="px-3">Scope</div>
                <div className="px-3">Network ID</div>
                <div className="px-3">Labels</div>
              </div>
              <div
                style={{
                  height: rowVirtualizer.getTotalSize(),
                  position: "relative",
                  width: "100%",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const network = networks[virtualRow.index];
                  return (
                    <div
                      key={network.ID}
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
                      <NetworkRow network={network} onRemove={handleRemove} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      <CreateNetworkDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </Card>
  );
}
