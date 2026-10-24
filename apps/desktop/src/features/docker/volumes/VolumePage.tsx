import { Heading, Text, VStack } from "@astryxdesign/core";
import { VolumeGrid } from "./VolumeGrid";

export function VolumePage() {
  return (
    <VStack gap={4} className="p-3 sm:p-6 w-full min-w-0 min-h-full">
      <VStack gap={1} className="w-full min-w-0 shrink-0 [overflow-wrap:anywhere]">
        <Heading level={1}>Docker Volumes</Heading>
        <Text type="body" color="secondary">
          Persistent storage created and managed by Docker, including volumes
          owned by Compose projects.
        </Text>
      </VStack>
      <div className="w-full min-w-0">
        <VolumeGrid />
      </div>
    </VStack>
  );
}

export default VolumePage;
