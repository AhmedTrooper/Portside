import { useId, useState } from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Button } from "@astryxdesign/core/Button";
import { Field } from "@astryxdesign/core/Field";
import { TextInput } from "@astryxdesign/core/TextInput";
import { HStack } from "@astryxdesign/core/Stack";
import { Database } from "lucide-react";

interface CreateVolumeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

const DEFAULT_VALUE = "my-volume";

export function CreateVolumeDialog({
  isOpen,
  onClose,
  onSubmit,
}: CreateVolumeDialogProps) {
  const inputId = useId();
  const [value, setValue] = useState(DEFAULT_VALUE);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();

  const submit = () => {
    if (trimmed.length === 0) {
      setError("Volume name cannot be empty.");
      return;
    }
    if (trimmed.includes(" ") || trimmed.includes("/") || trimmed.includes("\\")) {
      setError("Use letters, digits, dots, dashes, and underscores only.");
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
        <DialogHeader title="Create Docker volume" onOpenChange={handleOpenChange} />
        <LayoutContent>
          <Field
            label="Volume name"
            description="Docker creates the volume with the local driver and stores it under /var/lib/docker/volumes."
            inputID={inputId}
            isRequired
            status={error ? { type: "error", message: error } : undefined}
            labelIcon={<Database size={14} />}
          >
            <TextInput
              id={inputId}
              label="Volume name"
              isLabelHidden
              value={value}
              onChange={(next) => {
                setValue(next);
                if (error) setError(null);
              }}
              placeholder="my-volume"
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
