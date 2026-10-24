import { useId, useState } from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Button } from "@astryxdesign/core/Button";
import { Field } from "@astryxdesign/core/Field";
import { TextInput } from "@astryxdesign/core/TextInput";
import { HStack } from "@astryxdesign/core/Stack";

interface PullImageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (repository: string) => void;
}

const DEFAULT_VALUE = "alpine:latest";

/**
 * Modal dialog for entering a `repository[:tag]` to `docker pull`.
 *
 * Built with the native `<dialog>` element via Astryx's Dialog so we get
 * focus trapping, Escape dismissal, and accessible labelling for free.
 * Inline validation prevents submitting an empty/blank repository.
 */
export function PullImageDialog({ isOpen, onClose, onSubmit }: PullImageDialogProps) {
  const inputId = useId();
  const [value, setValue] = useState(DEFAULT_VALUE);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();

  const submit = () => {
    if (trimmed.length === 0) {
      setError("Repository cannot be empty.");
      return;
    }
    if (trimmed.includes(" ")) {
      setError("Repository must not contain spaces.");
      return;
    }
    setError(null);
    onSubmit(trimmed);
  };

  const reset = () => {
    setError(null);
    setValue(DEFAULT_VALUE);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset();
      onClose();
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={handleOpenChange} width="420px" purpose="form">
      <Layout height="auto">
        <DialogHeader title="Pull Docker image" onOpenChange={handleOpenChange} />
        <LayoutContent>
          <Field
            label="Repository"
            description="e.g. nginx, redis:7-alpine, ghcr.io/me/app:1.0"
            inputID={inputId}
            isRequired
            status={error ? { type: "error", message: error } : undefined}
          >
            <TextInput
              id={inputId}
              label="Repository"
              isLabelHidden
              value={value}
              onChange={(next) => {
                setValue(next);
                if (error) setError(null);
              }}
              placeholder="alpine:latest"
              onEnter={submit}
              hasAutoFocus
            />
          </Field>
        </LayoutContent>
        <LayoutFooter hasDivider>
          <HStack gap={2} justify="end">
            <Button
              label="Cancel"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
            />
            <Button label="Pull" variant="primary" onClick={submit} />
          </HStack>
        </LayoutFooter>
      </Layout>
    </Dialog>
  );
}
