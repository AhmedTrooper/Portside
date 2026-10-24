import { Heading, Text, VStack } from "@astryxdesign/core";

export function HomePage() {
  return (
    <VStack className="gap-4 p-6">
      <Heading level={1}>Home Dashboard</Heading>
      <Text type="body" color="secondary">
        Welcome to Portside Control Center. Select options from the sidebar navigation.
      </Text>
    </VStack>
  );
}

export default HomePage;
