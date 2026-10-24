import { Heading, Text, VStack } from "@astryxdesign/core";
import { VolumeGrid } from "./VolumeGrid";

export function VolumePage() {
  return (
    <VStack gap={4} className="p-6 w-full h-full min-h-0">
      <VStack gap={1} className="w-full">
        <Heading level={1}>Docker Volumes</Heading>
        <Text type="body" color="secondary">
          Persistent storage created and managed by Docker, including volumes
          owned by Compose projects.
        </Text>
      </VStack>
      <div className="w-full flex-1 min-h-0">
        <VolumeGrid />
      </div>
    </VStack>
  );
}

export default VolumePage;
