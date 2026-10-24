import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Boxes,
  Container as ContainerIcon,
  Database,
  Layers,
  Network,
  RefreshCw,
} from "lucide-react";
import { Heading, Text, VStack } from "@astryxdesign/core";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { Link } from "@tanstack/react-router";
import { useDockerSnapshot } from "./shared/useDockerSnapshot";
import { composeBaseState } from "./shared/types";

interface ResourceCardProps {
  to: "/docker/containers" | "/docker/images" | "/docker/networks" | "/docker/volumes" | "/docker/compose";
  icon: LucideIcon;
  title: string;
  description: string;
  count: number;
  detail: string;
  isLoading: boolean;
}

export function DockerPage() {
  const {
    containers,
    images,
    networks,
    volumes,
    composeProjects,
    isLoading,
    error,
    refresh,
  } = useDockerSnapshot();

  const runningContainers = containers.filter(
    (container) => container.State.toLowerCase() === "running"
  ).length;
  const runningProjects = composeProjects.filter(
    (project) => composeBaseState(project.Status) === "running"
  ).length;
  const danglingImages = images.filter(
    (image) => image.Repository === "<none>" || image.Tag === "<none>"
  ).length;

  return (
    <VStack gap={4} className="p-6 w-full min-h-full">
      <div className="flex items-start justify-between gap-4">
        <VStack gap={1}>
          <Heading level={1}>Docker Management</Heading>
          <Text type="body" color="secondary">
            Live overview of containers, images, networks, volumes, and Compose
            projects on this host.
          </Text>
        </VStack>
        <Button
          label="Refresh"
          variant="secondary"
          icon={<RefreshCw size={14} aria-hidden />}
          onClick={() => void refresh()}
          isLoading={isLoading}
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md px-3 py-2 text-sm"
          style={{
            color: "var(--color-text-red)",
            backgroundColor: "var(--color-background-red)",
            border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
          }}
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 w-full mt-2">
        <ResourceCard
          to="/docker/containers"
          icon={ContainerIcon}
          title="Containers"
          description="Inspect state, networks, ports, and run lifecycle actions."
          count={containers.length}
          detail={`${runningContainers} running`}
          isLoading={isLoading}
        />
        <ResourceCard
          to="/docker/images"
          icon={Layers}
          title="Images"
          description="Pull, tag, and remove local images with streaming progress."
          count={images.length}
          detail={danglingImages ? `${danglingImages} dangling` : "No dangling layers"}
          isLoading={isLoading}
        />
        <ResourceCard
          to="/docker/networks"
          icon={Network}
          title="Networks"
          description="Browse drivers, create user-defined bridges, and remove networks."
          count={networks.length}
          detail="Bridge, overlay, macvlan, ipvlan"
          isLoading={isLoading}
        />
        <ResourceCard
          to="/docker/volumes"
          icon={Database}
          title="Volumes"
          description="Manage persistent data, inspect mountpoints, and prune unused volumes."
          count={volumes.length}
          detail="Persistent storage"
          isLoading={isLoading}
        />
        <ResourceCard
          to="/docker/compose"
          icon={Boxes}
          title="Compose"
          description="Deploy Compose files and start, stop, restart, or take projects down."
          count={composeProjects.length}
          detail={`${runningProjects} running`}
          isLoading={isLoading}
        />
      </div>
    </VStack>
  );
}

function ResourceCard({
  to,
  icon: IconComponent,
  title,
  description,
  count,
  detail,
  isLoading,
}: ResourceCardProps) {
  return (
    <Link to={to} className="block min-w-0 rounded-[var(--radius-container)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
      <Card
        padding={5}
        className="h-full min-w-0 transition-transform hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
            style={{
              backgroundColor: "var(--color-background-muted)",
              color: "var(--color-text-primary)",
            }}
          >
            <IconComponent size={20} aria-hidden />
          </span>
          <ArrowUpRight size={18} aria-hidden className="opacity-40" />
        </div>
        <Heading level={3} className="mt-4">
          {title}
        </Heading>
        <Text type="supporting" color="secondary" className="mt-1 block">
          {description}
        </Text>
        <div className="mt-5 flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">
            {isLoading && count === 0 ? "—" : count}
          </span>
          <span className="text-xs opacity-60">{detail}</span>
        </div>
      </Card>
    </Link>
  );
}

export default DockerPage;
