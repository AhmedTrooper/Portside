import { Heading, Text, VStack } from "@astryxdesign/core";
import { ComposeGrid } from "./ComposeGrid";

export function ComposePage() {
  return (
    <VStack gap={4} className="p-6 w-full h-full min-h-0">
      <VStack gap={1} className="w-full">
        <Heading level={1}>Docker Compose</Heading>
        <Text type="body" color="secondary">
          Deploy Compose files, start or stop projects, and take a project down
          without leaving Portside.
        </Text>
      </VStack>
      <div className="w-full flex-1 min-h-0">
        <ComposeGrid />
      </div>
    </VStack>
  );
}

export default ComposePage;
