import type { ReactNode } from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/Stack";

interface DockerFormDialogProps {
  isOpen: boolean;
  title: string;
  actionLabel: string;
  onClose: () => void;
  onSubmit: () => void;
  isLoading?: boolean;
  width?: number;
  children: ReactNode;
}

/** Keep actions outside the scrollable content, in Astryx's actual footer slot. */
export function DockerFormDialog({ isOpen, title, actionLabel, onClose, onSubmit, isLoading, width = 520, children }: DockerFormDialogProps) {
  const onOpenChange = (open: boolean) => { if (!open && !isLoading) onClose(); };
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width={width} maxHeight="90dvh" purpose="form">
      <Layout
        header={<DialogHeader title={title} onOpenChange={onOpenChange} />}
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} justify="end" wrap="wrap">
              <Button label="Cancel" variant="secondary" onClick={onClose} isDisabled={isLoading} />
              <Button label={actionLabel} variant="primary" onClick={onSubmit} isLoading={isLoading} />
            </HStack>
          </LayoutFooter>
        }
      >
        <LayoutContent>{children}</LayoutContent>
      </Layout>
    </Dialog>
  );
}
