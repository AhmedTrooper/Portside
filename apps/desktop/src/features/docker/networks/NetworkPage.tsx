import { Heading, Text, VStack } from "@astryxdesign/core";
import { HStack } from "@astryxdesign/core/Stack";
import { NetworkGrid } from "./NetworkGrid";
import { ActiveNetworkOpsPanel } from "./ActiveNetworkOpsPanel";
import { useUIStore } from "../../../store/uiStore";

export function NetworkPage() {
  const isOpsPanelOpen = useUIStore((s) => s.isOpsPanelOpen);

  return (
    <VStack gap={4} className="p-3 sm:p-6 w-full min-w-0 min-h-full">
      <VStack gap={1} className="w-full min-w-0 shrink-0 [overflow-wrap:anywhere]">
        <Heading level={1}>Docker Networks</Heading>
        <Text type="body" color="secondary">
          Browse networks, create user-defined bridges, and watch long
          operations stream their progress here.
        </Text>
      </VStack>

      <HStack gap={4} wrap="wrap" align="stretch" className="w-full min-w-0">
        <div className="flex-1 basis-[560px] min-w-0">
          <NetworkGrid />
        </div>
        {isOpsPanelOpen && (
          <div className="flex-1 basis-[340px] min-w-0 h-[320px]">
            <ActiveNetworkOpsPanel />
          </div>
        )}
      </HStack>
    </VStack>
  );
}

export default NetworkPage;
