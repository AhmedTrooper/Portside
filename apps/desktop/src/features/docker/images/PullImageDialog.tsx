import { useId, useState } from "react";
import { Field } from "@astryxdesign/core/Field";
import { TextInput } from "@astryxdesign/core/TextInput";
import { DockerFormDialog } from "../shared/DockerFormDialog";

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
    <DockerFormDialog isOpen={isOpen} title="Pull Docker image" actionLabel="Pull" width={420} onClose={() => handleOpenChange(false)} onSubmit={submit}>
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
    </DockerFormDialog>
  );
}
