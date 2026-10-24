import { useId, useState } from "react";
import { Field } from "@astryxdesign/core/Field";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Selector } from "@astryxdesign/core/Selector";
import { VStack } from "@astryxdesign/core/Stack";
import { DockerFormDialog } from "../shared/DockerFormDialog";
import { Network as NetworkIcon } from "lucide-react";

interface CreateNetworkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, driver: string) => void;
}

const DEFAULT_VALUE = "my-network";
const DEFAULT_DRIVER = "bridge";
const DRIVERS = ["bridge", "overlay", "macvlan", "ipvlan"];

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
  const [driver, setDriver] = useState(DEFAULT_DRIVER);
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
    onSubmit(trimmed, driver);
  };

  const reset = () => {
    setError(null);
    setValue(DEFAULT_VALUE);
    setDriver(DEFAULT_DRIVER);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset();
      onClose();
    }
  };

  return (
    <DockerFormDialog isOpen={isOpen} title="Create Docker network" actionLabel="Create" width={420} onClose={() => handleOpenChange(false)} onSubmit={submit}>
          <VStack gap={3}>
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
            <Field
              label="Driver"
              description="Bridge is local to this host. Overlay, macvlan, and ipvlan need extra daemon/network setup."
              inputID={`${inputId}-driver`}
            >
              <Selector
                label="Driver"
                isLabelHidden
                options={DRIVERS}
                value={driver}
                onChange={setDriver}
              />
            </Field>
          </VStack>
    </DockerFormDialog>
  );
}
