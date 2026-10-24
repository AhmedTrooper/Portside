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
  ShieldAlert,
  HardDrive,
  Layers,
} from "lucide-react";
import { useToast } from "@astryxdesign/core/Toast";
import { PullImageDialog } from "./PullImageDialog";

// Match the JSON shape emitted by `docker images --format '{{json .}}'`.
interface DockerImage extends Record<string, unknown> {
  ID: string;
  Repository: string;
  Tag: string;
  Size: string;
  CreatedSince: string;
  Containers: string;
}

// Fixed minimum widths so repo / tag / image ID are always readable
// (≥10–15 chars) before any truncation. The body scrolls horizontally when
// the viewport is narrower than the sum of these columns.
const GRID_COLUMNS = "80px minmax(200px, 1.4fr) minmax(120px, 1fr) minmax(180px, 1fr) 100px";

function repositoryDisplay(image: DockerImage): string {
  if (image.Repository === "<none>") return "<dangling>";
  return image.Repository;
}

function tagDisplay(image: DockerImage): string {
  if (image.Tag === "<none>") return "<dangling>";
  return image.Tag;
}

function isDangling(image: DockerImage): boolean {
  return image.Repository === "<none>" || image.Tag === "<none>";
}

interface ImageRowProps {
  image: DockerImage;
  onRemove: (id: string, force: boolean) => void;
}

import { memo } from "react";

const ImageRow = memo(({ image, onRemove }: ImageRowProps) => {
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
              isDisabled: false,
              onClick: () => onRemove(image.ID, false),
            },
            {
              label: "Force Remove",
              icon: <Icon icon={ShieldAlert} className="text-red-500" />,
              onClick: () => onRemove(image.ID, true),
            },
          ]}
        />
      </div>
      <div className="truncate px-3" title={repositoryDisplay(image)}>
        {repositoryDisplay(image)}
      </div>
      <div className="truncate px-3" title={tagDisplay(image)}>
        {tagDisplay(image)}
      </div>
      <div className="truncate px-3" title={image.ID}>
        <code className="text-xs opacity-80">{image.ID}</code>
      </div>
      <div className="px-3 inline-flex items-center gap-1.5">
        <Layers size={12} className="opacity-60" aria-hidden />
        <span>{image.Size}</span>
      </div>
    </div>
  );
}, (prev, next) => {
  // Image rows are reference-only; only re-render if the underlying id/size
  // (the cells the user can actually see) change.
  return (
    prev.image.ID === next.image.ID &&
    prev.image.Size === next.image.Size &&
    prev.image.Repository === next.image.Repository &&
    prev.image.Tag === next.image.Tag
  );
});

ImageRow.displayName = "ImageRow";

export function ImageTable() {
  const [images, setImages] = useState<DockerImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pullOpen, setPullOpen] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const fetchImages = async () => {
    try {
      setIsLoading(true);
      const raw: unknown = await invoke("get_global_state");
      const images = parseImagesFromState(raw);
      if (images === null) {
        toast({
          type: "error",
          body: "Received an unexpected response from the backend.",
          isAutoHide: false,
        });
        return;
      }
      setImages(images);
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to load images: ${stringifyError(e)}`,
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
      await fetchImages();
      if (cancelled) return;

      unlistenState = await listen<unknown>("global-state-updated", (event) => {
        const images = parseImagesFromState(event.payload);
        if (images === null) return;
        setImages(images);
        setIsLoading(false);
      });

      unlistenChanged = await listen("docker-images-changed", () => {
        // Background poller will pick it up within ~60s; force an immediate
        // refresh so the user doesn't wait.
        fetchImages();
      });
    }

    setup();

    return () => {
      cancelled = true;
      unlistenState();
      unlistenChanged();
    };
  }, []);

  // Re-measure the virtualizer when the scroll container resizes. Without
  // this the virtualizer can keep a stale measurement and render zero rows.
  const rowVirtualizer = useVirtualizer({
    count: images.length,
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

  const handleRemove = async (id: string, force: boolean) => {
    try {
      await invoke("docker_remove_image", { id, force });
      toast({
        type: "info",
        body: force ? `Force-removing image ${shortId(id)}…` : `Removing image ${shortId(id)}…`,
        autoHideDuration: 3000,
      });
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to remove image: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    }
  };

  const handlePull = async (repository: string) => {
    try {
      setPullOpen(false);
      await invoke("docker_pull_image", { repository });
      toast({
        type: "info",
        body: `Pulling ${repository}…`,
        autoHideDuration: 3000,
      });
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to start pull: ${stringifyError(e)}`,
        isAutoHide: false,
      });
    }
  };

  const totalCount = images.length;
  const danglingCount = useMemo(() => images.filter(isDangling).length, [images]);

  return (
    <Card className="w-full h-full min-h-0 flex flex-col">
      <Toolbar
        label="Image actions"
        size="md"
        dividers={["bottom"]}
        startContent={
          <div className="inline-flex items-center gap-2">
            <Heading level={3}>Images</Heading>
            <span className="text-xs opacity-70 inline-flex items-center gap-1">
              <HardDrive size={12} aria-hidden />
              {totalCount} total
              {danglingCount > 0 ? ` · ${danglingCount} dangling` : ""}
            </span>
          </div>
        }
        endContent={
          <div className="inline-flex items-center gap-2">
            <Button
              label="Pull"
              variant="primary"
              icon={<Icon icon={Plus} />}
              onClick={() => setPullOpen(true)}
            />
            <Button
              label="Refresh"
              variant="secondary"
              icon={<Icon icon={RefreshCw} />}
              onClick={fetchImages}
            />
          </div>
        }
      />

      {isLoading && images.length === 0 ? (
        <div className="p-8 text-center text-gray-500">Loading images…</div>
      ) : images.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <div className="mb-2">No images found.</div>
          <Button
            label="Pull your first image"
            variant="primary"
            icon={<Icon icon={Plus} />}
            onClick={() => setPullOpen(true)}
          />
        </div>
      ) : (
        <>
          {/* Single scroll container — both axes scroll on the same element
              so the header (sticky-top) and rows move together. The inner
              column has a min-width so when the viewport is narrower than
              the column track (sum of min-widths ≈ 780px) the row scrolls
              horizontally instead of truncating mid-word. The header sticks
              to the top of this container while the body scrolls vertically
              underneath it. */}
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
                <div className="px-3">Repository</div>
                <div className="px-3">Tag</div>
                <div className="px-3">Image ID</div>
                <div className="px-3">Size</div>
              </div>
              <div
                style={{
                  height: rowVirtualizer.getTotalSize(),
                  position: "relative",
                  width: "100%",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const image = images[virtualRow.index];
                  return (
                    <div
                      key={image.ID}
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
                      <ImageRow image={image} onRemove={handleRemove} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      <PullImageDialog
        isOpen={pullOpen}
        onClose={() => setPullOpen(false)}
        onSubmit={handlePull}
      />
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
 * into a `DockerImage[]`. Returns null on any mismatch — never partially
 * typed data.
 */
function isDockerImage(value: unknown): value is DockerImage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.ID !== "string") return false;
  if (typeof v.Repository !== "string") return false;
  if (typeof v.Tag !== "string") return false;
  if (typeof v.Size !== "string") return false;
  if (typeof v.CreatedSince !== "string") return false;
  if (typeof v.Containers !== "string") return false;
  return true;
}

function parseImagesFromState(payload: unknown): DockerImage[] | null {
  if (!payload || typeof payload !== "object") return null;
  const docker = (payload as Record<string, unknown>).docker;
  if (!docker || typeof docker !== "object") return null;
  const raw = (docker as Record<string, unknown>).images;
  if (!Array.isArray(raw)) return null;
  const out: DockerImage[] = [];
  for (const item of raw) {
    if (isDockerImage(item)) out.push(item);
  }
  return out;
}
