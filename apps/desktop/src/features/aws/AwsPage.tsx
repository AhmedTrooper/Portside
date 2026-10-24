import { Heading, Text, VStack, Card } from "@astryxdesign/core";

/**
 * AWS dashboard placeholder. The first real AWS feature will replace the body
 * with a resource grid (mirroring `docker/DockerPage.tsx`).
 */
export function AwsPage() {
  return (
    <VStack gap={4} className="p-6 w-full">
      <Heading level={1}>AWS</Heading>
      <Text type="body" color="secondary">
        Manage AWS resources: EC2 instances, S3 buckets, IAM, Lambda, and more.
      </Text>

      <Card className="p-6 mt-4">
        <VStack gap={2}>
          <Heading level={3}>Coming soon</Heading>
          <Text type="supporting" color="secondary">
            AWS integration is on the roadmap. Resource sub-modules will live
            under <code>src/features/aws/</code>.
          </Text>
        </VStack>
      </Card>
    </VStack>
  );
}

export default AwsPage;
