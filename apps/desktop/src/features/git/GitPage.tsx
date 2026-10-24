import { Heading, Text, VStack, Card } from "@astryxdesign/core";

/**
 * Git dashboard placeholder. The first real git feature will replace the body
 * with a resource grid (mirroring `docker/DockerPage.tsx`).
 */
export function GitPage() {
  return (
    <VStack gap={4} className="p-6 w-full">
      <Heading level={1}>Git</Heading>
      <Text type="body" color="secondary">
        Manage local repositories, browse commits, and inspect working-tree
        status from one place.
      </Text>

      <Card className="p-6 mt-4">
        <VStack gap={2}>
          <Heading level={3}>Coming soon</Heading>
          <Text type="supporting" color="secondary">
            Git integration is on the roadmap. Resource sub-modules will live
            under <code>src/features/git/</code>.
          </Text>
        </VStack>
      </Card>
    </VStack>
  );
}

export default GitPage;
