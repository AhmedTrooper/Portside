import { Heading, Text, VStack } from "@astryxdesign/core";
import { ContainerGrid } from "./ContainerGrid";

export function ContainerPage() {
  return (
    <VStack gap={4} className="p-6 w-full h-full min-h-0">
      <VStack gap={1} className="w-full">
        <Heading level={1}>Docker Containers</Heading>
        <Text type="body" color="secondary">
          Monitor and manage running or stopped Docker containers.
        </Text>
      </VStack>

      <div className="w-full flex-1 min-h-0">
        <ContainerGrid />
      </div>
    </VStack>
  );
}

export default ContainerPage;
