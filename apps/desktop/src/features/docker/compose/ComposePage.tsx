import { Heading, Text, VStack } from "@astryxdesign/core";
import { ComposeGrid } from "./ComposeGrid";

export function ComposePage() {
  return (
    <VStack gap={4} className="p-3 sm:p-6 w-full min-w-0 min-h-full">
      <VStack gap={1} className="w-full min-w-0 shrink-0 [overflow-wrap:anywhere]">
        <Heading level={1}>Docker Compose</Heading>
        <Text type="body" color="secondary">
          Deploy Compose files, start or stop projects, and take a project down
          without leaving Portside.
        </Text>
      </VStack>
      <div className="w-full min-w-0">
        <ComposeGrid />
      </div>
    </VStack>
  );
}

export default ComposePage;
