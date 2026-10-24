import { Heading, Text, VStack } from "@astryxdesign/core";
import { HStack } from "@astryxdesign/core/Stack";
import { ImageTable } from "./ImageTable";
import { ActiveOpsPanel } from "./ActiveOpsPanel";
import { useUIStore } from "../../../store/uiStore";

export function ImagePage() {
  const isOpsPanelOpen = useUIStore((s) => s.isOpsPanelOpen);

  return (
    <VStack gap={4} className="p-6 w-full h-full">
      <VStack gap={1} className="w-full">
        <Heading level={1}>Docker Images</Heading>
        <Text type="body" color="secondary">
          Browse local images, pull new ones, and watch long operations stream
          their progress here.
        </Text>
      </VStack>

      {/* Main column = ImageTable (flex-1); right rail = ActiveOpsPanel.
          The ops panel is collapsible and starts hidden so the table owns
          the screen by default. When opened it eats a fixed 340px. */}
      <HStack gap={4} align="stretch" className="w-full h-full min-h-0 flex-1">
        <div className="flex-1 min-h-0 min-w-0">
          <ImageTable />
        </div>
        {isOpsPanelOpen && (
          <div className="w-[340px] min-h-0 shrink-0">
            <ActiveOpsPanel />
          </div>
        )}
      </HStack>
    </VStack>
  );
}

export default ImagePage;
