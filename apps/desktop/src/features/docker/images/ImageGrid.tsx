import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Heading, Text } from "@astryxdesign/core/Text";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { usePortsideToast as useToast } from "../../../hooks/usePortsideToast";
import {
  Layers,
  MoreVertical,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Play,
  Tag,
  Upload,
  Download,
  Hammer,
  FileSearch,
  Archive,
  Search,
} from "lucide-react";
import { DockerGrid } from "../shared/DockerGrid";
import { DockerCard, DockerCardHeader, DockerCardIdentity, DockerCardMetaGrid, DockerCardMeta as Meta } from "../shared/DockerCard";
import { useDockerSnapshot } from "../shared/useDockerSnapshot";
import {
  imageReference,
  isDanglingImage,
  repositoryDisplay,
  shortId,
  stringifyError,
  tagDisplay,
  type DockerImage,
} from "../shared/types";
import { PullImageDialog } from "./PullImageDialog";
import { ImageWorkflowDialog, type ImageWorkflow } from "./ImageWorkflowDialog";
import { ImageDetailsDialog } from "./ImageDetailsDialog";
import { useImageOperations } from "./useImageOperations";
import { useUIStore } from "../../../store/uiStore";
import { SearchImagesDialog } from "./SearchImagesDialog";

interface PendingRemove {
  id: string;
  target: string;
  reference: string;
  force: boolean;
}

export function ImageGrid() {
  const { images, isLoading, error, refresh } = useDockerSnapshot();
  const [search, setSearch] = useState("");
  const [pullOpen, setPullOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [workflow, setWorkflow] = useState<{ kind: ImageWorkflow; image?: DockerImage } | null>(null);
  const [details, setDetails] = useState<DockerImage | null>(null);
  const [prune, setPrune] = useState<boolean | null>(null);
  const [isPruning, setIsPruning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { operations } = useImageOperations(true);
  const setOpsPanelOpen = useUIStore(state => state.setOpsPanelOpen);
  const toast = useToast();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return images;
    return images.filter((image) =>
      [image.Repository, image.Tag, image.ID, image.Size, image.CreatedSince]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [images, search]);

  const danglingCount = useMemo(
    () => images.filter(isDanglingImage).length,
    [images]
  );

  const handlePull = async (repository: string) => {
    try {
      setPullOpen(false);
      await invoke("docker_pull_image", { repository });
      setOpsPanelOpen(true);
      toast({
        type: "info",
        body: `Pulling ${repository}…`,
        autoHideDuration: 3000,
      });
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to start pull: ${stringifyError(e)}`,
        isAutoHide: true,
        autoHideDuration: 6000,
      });
      await refresh();
    }
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    setIsRemoving(true);
    try {
      await invoke("docker_remove_image", {
        id: pendingRemove.target,
        force: pendingRemove.force,
      });
      setOpsPanelOpen(true);
      toast({
        type: "info",
        body: `${pendingRemove.force ? "Force-removing" : "Removing"} ${pendingRemove.reference}…`,
        autoHideDuration: 3000,
      });
      setPendingRemove(null);
    } catch (e) {
      toast({
        type: "error",
        body: `Failed to remove image: ${stringifyError(e)}`,
        isAutoHide: true,
        autoHideDuration: 6000,
      });
    } finally {
      await refresh();
      setIsRemoving(false);
    }
  };

  const submitWorkflow = async (kind: ImageWorkflow, command: string, args: Record<string, unknown>) => {
    setBusyId(workflow?.image?.ID ?? null);
    try {
      const result = await invoke(command, args);
      const streaming = !["tag", "run"].includes(kind);
      if (streaming) setOpsPanelOpen(true);
      toast({ type: "info", isAutoHide: true, autoHideDuration: 3000,
        body: streaming ? `Started ${kind}. Watch Operations for the result.` : kind === "run" ? `Created container ${shortId(String(result))}.` : "Tagged image." });
    } catch (e) {
      toast({ type: "error", body: `Failed to ${kind}: ${stringifyError(e)}`, isAutoHide: true, autoHideDuration: 6000 });
      throw e;
    } finally { await refresh(); setBusyId(null); }
  };

  const confirmPrune = async () => {
    if (prune === null) return;
    setIsPruning(true);
    try {
      await invoke("docker_prune_images", { all: prune });
      setOpsPanelOpen(true);
      setPrune(null);
      toast({ type: "info", body: "Pruning started. Watch Operations for the result.", isAutoHide: true, autoHideDuration: 3000 });
    } catch (e) {
      toast({ type: "error", body: `Failed to prune images: ${stringifyError(e)}`, isAutoHide: true, autoHideDuration: 6000 });
    } finally { await refresh(); setIsPruning(false); }
  };

  return (
    <>
      <DockerGrid
        label="Image actions"
        title="Images"
        icon={Layers}
        meta={`${images.length} total${danglingCount ? ` · ${danglingCount} dangling` : ""}`}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search images"
        toolbarActions={
          <div className="inline-flex flex-wrap items-center gap-2">
            <Button
              label="Pull"
              variant="primary"
              size="sm"
              icon={<Plus size={14} aria-hidden />}
              onClick={() => setPullOpen(true)}
            />
            <Button
              label="Search registry"
              variant="secondary"
              size="sm"
              icon={<Search size={14} aria-hidden />}
              onClick={() => setSearchOpen(true)}
            />
            <Button
              label="Build"
              variant="secondary"
              size="sm"
              icon={<Hammer size={14} aria-hidden />}
              onClick={() => setWorkflow({ kind: "build" })}
            />
            <Button
              label="Load"
              variant="secondary"
              size="sm"
              icon={<Archive size={14} aria-hidden />}
              onClick={() => setWorkflow({ kind: "load" })}
            />
            <DropdownMenu
              button={{ label: "Prune", variant: "secondary", size: "sm", icon: <Trash2 size={14} aria-hidden /> }}
              items={[
                { label: "Prune dangling images", onClick: () => setPrune(false) },
                { label: "Prune all unused images", onClick: () => setPrune(true) },
              ]}
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
        emptyTitle={images.length === 0 ? "No images found" : "No matching images"}
        emptyDescription={
          images.length === 0
            ? "Pull an image from Docker Hub or a registry to get started."
            : "Try a different repository, tag, or image ID."
        }
        emptyAction={
          images.length === 0 ? (
            <Button
              label="Pull an image"
              variant="primary"
              size="sm"
              icon={<Plus size={14} aria-hidden />}
              onClick={() => setPullOpen(true)}
            />
          ) : undefined
        }
      >
        {filtered.map((image) => (
          <ImageCard
            key={`${image.ID}:${image.Repository}:${image.Tag}`}
            image={image}
            isBusy={busyId === image.ID || operations.some(op => op.status === "running" && (op.target === image.ID || op.target === imageReference(image)))}
            onInspect={() => setDetails(image)}
            onWorkflow={kind => setWorkflow({ kind, image })}
            onRemove={(force) =>
              setPendingRemove({
                id: image.ID,
                target: force || isDanglingImage(image) ? image.ID : imageReference(image),
                reference: imageReference(image),
                force,
              })
            }
          />
        ))}
      </DockerGrid>

      <PullImageDialog
        isOpen={pullOpen}
        onClose={() => setPullOpen(false)}
        onSubmit={handlePull}
      />

      {workflow && <ImageWorkflowDialog key={`${workflow.kind}:${workflow.image?.ID ?? ""}`} workflow={workflow.kind} image={workflow.image} onClose={() => setWorkflow(null)} onSubmit={submitWorkflow} />}
      {details && <ImageDetailsDialog key={details.ID} image={details} onClose={() => setDetails(null)} />}
      {searchOpen && <SearchImagesDialog onClose={() => setSearchOpen(false)} onPull={repository => void handlePull(repository)} />}
      <AlertDialog
        isOpen={prune !== null}
        onOpenChange={open => { if (!open && !isPruning) setPrune(null); }}
        title={prune ? "Prune all unused images?" : "Prune dangling images?"}
        description={prune ? "Docker will delete every image not referenced by a container, including tagged images. This cannot be undone." : "Docker will delete unused, untagged image layers. This cannot be undone."}
        actionLabel="Prune"
        isActionLoading={isPruning}
        onAction={() => void confirmPrune()}
      />

      <AlertDialog
        isOpen={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
        title={pendingRemove?.force ? "Force remove image?" : "Remove image?"}
        description={
          pendingRemove
            ? `Remove ${pendingRemove.reference} (${shortId(pendingRemove.id)})?${
                pendingRemove.force
                  ? " Docker will remove it even when a container references it."
                  : " Docker removes this tag; it also deletes image data when no other tags or containers reference it."
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

interface ImageCardProps {
  image: DockerImage;
  onRemove: (force: boolean) => void;
  isBusy: boolean;
  onInspect: () => void;
  onWorkflow: (kind: ImageWorkflow) => void;
}

function ImageCard({ image, onRemove, isBusy, onInspect, onWorkflow }: ImageCardProps) {
  const dangling = isDanglingImage(image);
  const reference = imageReference(image);
  const containerCount = Number.parseInt(image.Containers, 10);

  return (
    <DockerCard>
      <DockerCardHeader>
        <DockerCardIdentity>
          <Layers size={18} aria-hidden className="mt-0.5 shrink-0 opacity-80" />
          <div className="min-w-0 flex-1">
            <Heading level={4} className="docker-card-text">
              {dangling ? "Dangling image" : repositoryDisplay(image)}
            </Heading>
            <Text type="supporting" color="secondary" className="docker-card-text block">
              {dangling ? shortId(image.ID) : `${tagDisplay(image)} · ${shortId(image.ID)}`}
            </Text>
          </div>
        </DockerCardIdentity>
        <DropdownMenu
          button={{
            label: `Actions for ${reference}`,
            icon: <MoreVertical size={16} aria-hidden />,
            variant: "ghost",
            isIconOnly: true,
            size: "sm",
            isDisabled: isBusy,
          }}
          hasChevron={false}
          items={[
            { label: "Inspect and layer history", icon: <FileSearch size={14} aria-hidden />, onClick: onInspect },
            { label: "Run container", icon: <Play size={14} aria-hidden />, onClick: () => onWorkflow("run") },
            { label: "Tag image", icon: <Tag size={14} aria-hidden />, onClick: () => onWorkflow("tag") },
            { label: "Push to registry", icon: <Upload size={14} aria-hidden />, isDisabled: dangling, onClick: () => onWorkflow("push") },
            { label: "Save archive", icon: <Download size={14} aria-hidden />, onClick: () => onWorkflow("save") },
            { type: "divider" as const },
            {
              label: dangling ? "Remove image" : "Remove tag",
              icon: <Trash2 size={14} aria-hidden />,
              onClick: () => onRemove(false),
            },
            {
              label: "Force remove",
              icon: <ShieldAlert size={14} aria-hidden />,
              onClick: () => onRemove(true),
            },
          ]}
        />
      </DockerCardHeader>

      {dangling ? (
        <div
          className="rounded px-2 py-1 text-[11px] self-start"
          style={{
            color: "var(--color-text-yellow)",
            backgroundColor: "var(--color-background-yellow)",
          }}
        >
          Untagged layer cache
        </div>
      ) : null}

      <DockerCardMetaGrid>
        <Meta label="Size" value={image.Size} />
        <Meta label="Created" value={image.CreatedSince} />
        <Meta
          label="Containers"
          value={
            Number.isFinite(containerCount) && containerCount >= 0
              ? image.Containers
              : "Unknown"
          }
        />
        <Meta label="Image ID" value={shortId(image.ID, 16)} />
      </DockerCardMetaGrid>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button label="Run" variant="secondary" size="sm" icon={<Play size={14} aria-hidden />} onClick={() => onWorkflow("run")} isDisabled={isBusy} />
        <span className="max-w-full [overflow-wrap:anywhere] text-[11px] opacity-50 font-mono" title={image.ID}>
          {image.Digest && image.Digest !== "<none>"
            ? `digest ${shortId(image.Digest.replace("sha256:", ""), 12)}`
            : reference}
        </span>
      </div>
    </DockerCard>
  );
}
