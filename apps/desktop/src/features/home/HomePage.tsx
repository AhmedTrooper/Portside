import { Heading, Text, VStack, HStack, Button, Badge } from "@astryxdesign/core";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { DockerCard, DockerCardGrid } from "../docker/shared/DockerCard";
import { useDockerSnapshot } from "../docker/shared/useDockerSnapshot";
import { author, version } from "../../../package.json";

export function HomePage() {
  const { containers, images, networks, volumes, composeProjects, isLoading, error, refresh } = useDockerSnapshot();
  const resources = [
    { to: "/docker/images", title: "Images", count: images.length, description: "Pull, build, inspect, tag, push, and archive images. Start containers directly from an image." },
    { to: "/docker/containers", title: "Containers", count: containers.length, description: "Manage container lifecycle, published ports, and network details." },
    { to: "/docker/compose", title: "Compose", count: composeProjects.length, description: "Deploy a Compose file and manage the entire project's lifecycle." },
    { to: "/docker/networks", title: "Networks", count: networks.length, description: "Create networks, inspect drivers and labels, and manage standalone networks." },
    { to: "/docker/volumes", title: "Volumes", count: volumes.length, description: "Manage persistent storage and prune unused volumes with confirmation." },
  ] as const;
  return (
    <VStack gap={4} className="p-3 sm:p-6 w-full min-w-0">
      <HStack gap={2} wrap="wrap" justify="between" align="start">
        <VStack gap={1} className="flex-1 min-w-0">
          <Heading level={1}>Portside</Heading>
          <Text type="body" color="secondary" display="block" className="docker-card-text">Your local Docker control center. Start with images, containers, or a Compose project.</Text>
          <Text type="supporting" display="block">By {author} · v{version}</Text>
        </VStack>
        <Button label="Refresh" variant="secondary" icon={<RefreshCw size={14} aria-hidden />} onClick={() => void refresh()} isLoading={isLoading} />
      </HStack>

      <HStack gap={2} wrap="wrap" align="center">
        <Badge label={isLoading ? "Checking Docker" : error ? "Docker unavailable" : "Docker connected"} variant={error ? "error" : "info"} />
        <Link to="/docker" className="inline-flex items-center gap-2 font-semibold hover:underline">Open Docker overview <ArrowUpRight size={16} aria-hidden /></Link>
      </HStack>
      {error && <Text display="block" role="alert" className="docker-card-text">Could not read Docker state: {error}</Text>}

      <DockerCardGrid>
        {resources.map(resource => (
          <Link key={resource.to} to={resource.to} className="block min-w-0">
            <DockerCard className="h-full">
              <HStack gap={1} justify="between" align="center">
                <Heading level={3}>{resource.title}</Heading>
                <ArrowUpRight size={18} aria-hidden className="shrink-0" />
              </HStack>
              <Text type="display-3" display="block">{isLoading || error ? "—" : resource.count}</Text>
              <Text type="supporting" color="secondary" display="block" className="docker-card-text">{resource.description}</Text>
            </DockerCard>
          </Link>
        ))}
      </DockerCardGrid>
      <Text type="supporting" color="secondary" display="block" className="docker-card-text">Docker must be installed and its daemon running. Portside executes Docker CLI commands locally; Compose-owned resources use project actions.</Text>
    </VStack>
  );
}

export default HomePage;
