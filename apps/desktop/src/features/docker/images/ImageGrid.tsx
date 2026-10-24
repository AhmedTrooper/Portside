import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Heading, Text } from "@astryxdesign/core/Text";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { useToast } from "@astryxdesign/core/Toast";
import {
  Layers,
  MoreVertical,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
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

interface PendingRemove {
  id: string;
  reference: string;
  force: boolean;
}

export function ImageGrid() {
  const { images, isLoading, error, refresh } = useDockerSnapshot();
  const [search, setSearch] = useState("");
  const [pullOpen, setPullOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
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

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    setIsRemoving(true);
    try {
      await invoke("docker_remove_image", {
        id: pendingRemove.id,
        force: pendingRemove.force,
      });
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
        isAutoHide: false,
      });
    } finally {
      setIsRemoving(false);
    }
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
            key={image.ID}
            image={image}
            onRemove={(force) =>
              setPendingRemove({
                id: image.ID,
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
                  : " The image must not be used by any container."
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
}

function ImageCard({ image, onRemove }: ImageCardProps) {
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
          }}
          hasChevron={false}
          items={[
            {
              label: "Remove",
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
        <span className="max-w-full [overflow-wrap:anywhere] text-[11px] opacity-50 font-mono" title={image.ID}>
          {image.Digest && image.Digest !== "<none>"
            ? `digest ${shortId(image.Digest.replace("sha256:", ""), 12)}`
            : reference}
        </span>
      </div>
    </DockerCard>
  );
}
