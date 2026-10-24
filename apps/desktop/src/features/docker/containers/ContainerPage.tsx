import { Heading, Text, VStack } from "@astryxdesign/core";
import { ContainerTable } from "./ContainerTable";

export function ContainerPage() {
  return (
    <VStack gap={4} className="p-6 w-full h-full">
      <Heading level={1}>Docker Containers</Heading>
      <Text type="body" color="secondary">
        Monitor and manage running or stopped Docker containers.
      </Text>
      
      <ContainerTable />
    </VStack>
  );
}

export default ContainerPage;
