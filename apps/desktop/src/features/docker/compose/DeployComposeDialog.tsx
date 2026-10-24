import { useId, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Button } from "@astryxdesign/core/Button";
import { Field } from "@astryxdesign/core/Field";
import { TextInput } from "@astryxdesign/core/TextInput";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { FileCode2, Play } from "lucide-react";

interface DeployComposeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (path: string, project: string | null) => void;
}

export function DeployComposeDialog({
  isOpen,
  onClose,
  onSubmit,
}: DeployComposeDialogProps) {
  const pathId = useId();
  const projectId = useId();
  const [path, setPath] = useState("");
  const [project, setProject] = useState("");
  const [error, setError] = useState<string | null>(null);

  const browse = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        title: "Choose a Compose file",
        filters: [{ name: "Compose", extensions: ["yml", "yaml"] }],
      });
      if (typeof selected === "string") {
        setPath(selected);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const submit = () => {
    if (!path.trim()) {
      setError("Choose a docker-compose.yml or compose.yaml file first.");
      return;
    }
    setError(null);
    onSubmit(path.trim(), project.trim() || null);
  };

  const reset = () => {
    setPath("");
    setProject("");
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      reset();
      onClose();
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={handleOpenChange} width="520px" maxHeight="90dvh" purpose="form">
      <Layout
        header={<DialogHeader title="Deploy Compose project" onOpenChange={handleOpenChange} />}
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} justify="end" wrap="wrap">
              <Button
                label="Cancel"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
              />
              <Button
                label="Start"
                variant="primary"
                icon={<Play size={14} aria-hidden />}
                onClick={submit}
              />
            </HStack>
          </LayoutFooter>
        }
      >
        <LayoutContent>
          <VStack gap={3}>
            <Field
              label="Compose file"
              description="Portside runs docker compose up -d from the selected file."
              inputID={pathId}
              isRequired
              status={error ? { type: "error", message: error } : undefined}
              labelIcon={<FileCode2 size={14} />}
            >
              <HStack gap={2} align="end" wrap="wrap">
                <div className="flex-1 basis-[240px] min-w-0">
                  <TextInput
                    id={pathId}
                    label="Compose file"
                    isLabelHidden
                    value={path}
                    onChange={setPath}
                    placeholder="/path/to/docker-compose.yml"
                    onEnter={submit}
                  />
                </div>
                <Button label="Browse" variant="secondary" onClick={() => void browse()} />
              </HStack>
            </Field>

            <Field
              label="Project name"
              description="Optional. Docker uses the containing folder name when this is blank."
              inputID={projectId}
            >
              <TextInput
                id={projectId}
                label="Project name"
                isLabelHidden
                value={project}
                onChange={setProject}
                placeholder="my-project"
                onEnter={submit}
              />
            </Field>
          </VStack>
        </LayoutContent>
      </Layout>
    </Dialog>
  );
}
