import { Heading, Text, VStack, Card } from "@astryxdesign/core";
import { Link } from "@tanstack/react-router";
import { Container as ContainerIcon, Layers, Network } from "lucide-react";

export function DockerPage() {
  return (
    <VStack gap={4} className="p-6 w-full">
      <Heading level={1}>Docker Management</Heading>
      <Text type="body" color="secondary">
        Select a resource to manage.
      </Text>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 w-full">
        <Link to="/docker/containers">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <VStack gap={2}>
              <div className="inline-flex items-center gap-2">
                <ContainerIcon size={18} aria-hidden />
                <Heading level={3}>Containers</Heading>
              </div>
              <Text type="supporting" color="secondary">Monitor and manage running containers.</Text>
            </VStack>
          </Card>
        </Link>

        <Link to="/docker/images">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <VStack gap={2}>
              <div className="inline-flex items-center gap-2">
                <Layers size={18} aria-hidden />
                <Heading level={3}>Images</Heading>
              </div>
              <Text type="supporting" color="secondary">Browse, pull, and remove local images.</Text>
            </VStack>
          </Card>
        </Link>

        <Link to="/docker/networks">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <VStack gap={2}>
              <div className="inline-flex items-center gap-2">
                <Network size={18} aria-hidden />
                <Heading level={3}>Networks</Heading>
              </div>
              <Text type="supporting" color="secondary">Browse, create, and remove networks.</Text>
            </VStack>
          </Card>
        </Link>
      </div>
    </VStack>
  );
}

export default DockerPage;
