import { Heading, Text, VStack } from "@astryxdesign/core";

export function WorkspacesPage() {
  return (
    <VStack className="gap-4 p-6">
      <Heading level={1}>Workspaces Dashboard</Heading>
      <Text type="body" color="secondary">
        Manage workspace environments, projects, and active developer setups.
      </Text>
    </VStack>
  );
}

export default WorkspacesPage;
