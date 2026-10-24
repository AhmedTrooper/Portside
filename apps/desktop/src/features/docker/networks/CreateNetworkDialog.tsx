import { useId, useState } from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Button } from "@astryxdesign/core/Button";
import { Field } from "@astryxdesign/core/Field";
import { TextInput } from "@astryxdesign/core/TextInput";
import { HStack } from "@astryxdesign/core/Stack";
import { Network as NetworkIcon } from "lucide-react";

interface CreateNetworkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

const DEFAULT_VALUE = "my-network";

/**
 * Modal dialog for entering a name to pass to `docker network create`.
 *
 * Validates the name client-side (non-empty, no whitespace) so the user
 * sees the rejection immediately. The Rust side validates again as a
 * defence-in-depth check.
 */
export function CreateNetworkDialog({ isOpen, onClose, onSubmit }: CreateNetworkDialogProps) {
  const inputId = useId();
  const [value, setValue] = useState(DEFAULT_VALUE);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();

  const submit = () => {
    if (trimmed.length === 0) {
      setError("Network name cannot be empty.");
      return;
    }
    if (trimmed.includes(" ")) {
      setError("Network name must not contain spaces.");
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
        <DialogHeader title="Create Docker network" onOpenChange={handleOpenChange} />
        <LayoutContent>
          <Field
            label="Network name"
            description="Lowercase letters, digits, and dashes. Must not collide with bridge/host/none."
            inputID={inputId}
            isRequired
            status={error ? { type: "error", message: error } : undefined}
            labelIcon={<NetworkIcon size={14} />}
          >
            <TextInput
              id={inputId}
              label="Network name"
              isLabelHidden
              value={value}
              onChange={(next) => {
                setValue(next);
                if (error) setError(null);
              }}
              placeholder="my-network"
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
            <Button label="Create" variant="primary" onClick={submit} />
          </HStack>
        </LayoutFooter>
      </Layout>
    </Dialog>
  );
}
