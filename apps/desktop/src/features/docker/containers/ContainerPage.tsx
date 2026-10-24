import { Heading, Text, VStack } from "@astryxdesign/core";
import { ContainerGrid } from "./ContainerGrid";

export function ContainerPage() {
  return (
    <VStack gap={4} className="p-3 sm:p-6 w-full min-w-0 min-h-full">
      <VStack gap={1} className="w-full min-w-0 shrink-0 [overflow-wrap:anywhere]">
        <Heading level={1}>Docker Containers</Heading>
        <Text type="body" color="secondary">
          Monitor and manage running or stopped Docker containers.
        </Text>
      </VStack>

      <div className="w-full min-w-0">
        <ContainerGrid />
      </div>
    </VStack>
  );
}

export default ContainerPage;
