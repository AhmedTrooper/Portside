import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Button } from "@astryxdesign/core/Button";
import { VStack, HStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { stringifyError, imageReference, type DockerImage } from "../shared/types";

export function ImageDetailsDialog({ image, onClose }: { image: DockerImage; onClose: () => void }) {
  const [details, setDetails] = useState<unknown>(null);
  const [history, setHistory] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"details" | "history">("details");
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      invoke("docker_inspect_image", { id: image.ID }),
      invoke("docker_image_history", { id: image.ID }),
    ]).then(([data, layers]) => { if (!cancelled) { setDetails(data); setHistory(layers); } })
      .catch(e => { if (!cancelled) setError(stringifyError(e)); });
    return () => { cancelled = true; };
  }, [image.ID]);
  return (
    <Dialog isOpen onOpenChange={open => { if (!open) onClose(); }} width={820} maxHeight="90dvh" purpose="info">
      <Layout
        header={<DialogHeader title="Image details" onOpenChange={open => { if (!open) onClose(); }} />}
        footer={<LayoutFooter hasDivider><Button label="Close" onClick={onClose} /></LayoutFooter>}
      >
        <LayoutContent>
          <VStack gap={2}>
            <Heading level={4} className="docker-card-text">{imageReference(image)}</Heading>
            <HStack gap={1} wrap="wrap">
              <Button label="Inspect" variant={tab === "details" ? "primary" : "secondary"} onClick={() => setTab("details")} />
              <Button label="Layer history" variant={tab === "history" ? "primary" : "secondary"} onClick={() => setTab("history")} />
            </HStack>
            {error ? <Text role="alert" display="block" className="docker-card-text">{error}</Text> : details === null ? <Text>Loading image details…</Text> : (
              <pre className="select-text whitespace-pre-wrap break-all text-xs leading-relaxed">{JSON.stringify(tab === "details" ? details : history, null, 2)}</pre>
            )}
          </VStack>
        </LayoutContent>
      </Layout>
    </Dialog>
  );
}
