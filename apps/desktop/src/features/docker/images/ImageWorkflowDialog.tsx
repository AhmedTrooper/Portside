import { useId, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Field } from "@astryxdesign/core/Field";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { DockerFormDialog } from "../shared/DockerFormDialog";
import { imageReference, isDanglingImage, stringifyError, type DockerImage } from "../shared/types";

export type ImageWorkflow = "tag" | "run" | "push" | "build" | "save" | "load";
interface WorkflowField {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
  multiline?: boolean;
  picker?: "file" | "folder" | "save";
  options?: string[];
}

const FIELDS: Record<ImageWorkflow, WorkflowField[]> = {
  tag: [{ key: "reference", label: "New image tag", description: "repository:tag or registry.example.com/team/image:tag", required: true }],
  push: [{ key: "reference", label: "Image tag to push", description: "Uses your existing Docker registry login. The image must already have this tag.", required: true }],
  save: [{ key: "path", label: "Save image archive", required: true, picker: "save" }],
  load: [{ key: "path", label: "Load image archive", required: true, picker: "file" }],
  build: [
    { key: "context", label: "Build context folder", required: true, picker: "folder" },
    { key: "dockerfile", label: "Dockerfile", description: "Optional. Defaults to Dockerfile in the build context.", picker: "file" },
    { key: "tags", label: "Image tags", description: "One repository:tag per line.", required: true, multiline: true },
    { key: "buildArgs", label: "Build arguments", description: "One KEY=value per line. Do not use build arguments for secrets.", multiline: true },
    { key: "target", label: "Build target", description: "Optional multi-stage target." },
    { key: "cache", label: "Cache", options: ["Use cache", "No cache"] },
    { key: "pull", label: "Base images", options: ["Use local base images", "Pull latest base images"] },
  ],
  run: [
    { key: "name", label: "Container name", description: "Optional. Docker can generate a name." },
    { key: "ports", label: "Published ports", description: "One host:container mapping per line, e.g. 8080:80 or 127.0.0.1:8080:80/tcp.", multiline: true },
    { key: "environment", label: "Environment", description: "One KEY=value per line.", multiline: true },
    { key: "volumes", label: "Volume mappings", description: "One source:/container/path[:ro] mapping per line.", multiline: true },
    { key: "network", label: "Network", description: "Optional existing network name." },
    { key: "command", label: "Command arguments", description: 'Optional JSON array, e.g. ["sh", "-c", "echo hello"]. No shell is used for Docker arguments.', multiline: true },
    { key: "autoRemove", label: "After the container exits", options: ["Keep container", "Remove container"] },
  ],
};

const LABELS: Record<ImageWorkflow, [string, string]> = {
  tag: ["Tag Docker image", "Tag"], run: ["Run a container from this image", "Run"],
  push: ["Push Docker image", "Push"], build: ["Build Docker image", "Build"],
  save: ["Save Docker image", "Save"], load: ["Load Docker images", "Load"],
};

const lines = (value = "") => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

export function imageWorkflowRequest(workflow: ImageWorkflow, values: Record<string, string>, image?: DockerImage) {
  for (const field of FIELDS[workflow]) {
    if (field.required && !values[field.key]?.trim()) throw new Error(`${field.label} is required.`);
  }
  if (workflow === "build") return {
    command: "docker_build_image", args: { options: {
      context: values.context.trim(), dockerfile: values.dockerfile?.trim() || null,
      tags: lines(values.tags), buildArgs: lines(values.buildArgs), target: values.target?.trim() || null,
      noCache: values.cache === "No cache", pull: values.pull === "Pull latest base images",
    } },
  };
  if (workflow === "load") return { command: "docker_load_images", args: { path: values.path.trim() } };
  if (!image) throw new Error("Choose an image first.");
  if (workflow === "run") {
    const command: unknown = values.command?.trim() ? JSON.parse(values.command) : [];
    if (!Array.isArray(command) || !command.every(arg => typeof arg === "string")) throw new Error("Command arguments must be a JSON array of strings.");
    return { command: "docker_run_image", args: { options: {
      image: image.ID, name: values.name?.trim() || null, ports: lines(values.ports),
      environment: lines(values.environment), volumes: lines(values.volumes), network: values.network?.trim() || null,
      command, autoRemove: values.autoRemove === "Remove container",
    } } };
  }
  if (workflow === "tag") return { command: "docker_tag_image", args: { id: image.ID, reference: values.reference.trim() } };
  if (workflow === "push") return { command: "docker_push_image", args: { reference: values.reference.trim() } };
  return { command: "docker_save_image", args: { id: isDanglingImage(image) ? image.ID : imageReference(image), path: values.path.trim() } };
}

interface ImageWorkflowDialogProps {
  workflow: ImageWorkflow;
  image?: DockerImage;
  onClose: () => void;
  onSubmit: (workflow: ImageWorkflow, command: string, args: Record<string, unknown>) => Promise<void>;
}

export function ImageWorkflowDialog({ workflow, image, onClose, onSubmit }: ImageWorkflowDialogProps) {
  const id = useId();
  const [values, setValues] = useState<Record<string, string>>(() => ({
    reference: workflow === "push" && image ? imageReference(image) : "",
    cache: "Use cache", pull: "Use local base images", autoRemove: "Keep container",
  }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setValue = (key: string, value: string) => { setValues(prev => ({ ...prev, [key]: value })); setError(null); };
  const submit = async () => {
    if (busy) return;
    try {
      const request = imageWorkflowRequest(workflow, values, image);
      setBusy(true);
      await onSubmit(workflow, request.command, request.args);
      onClose();
    } catch (e) { setError(stringifyError(e)); }
    finally { setBusy(false); }
  };
  const choose = async (field: WorkflowField) => {
    try {
      const selected = field.picker === "save"
        ? await save({ title: field.label, defaultPath: "image.tar", filters: [{ name: "Docker image archive", extensions: ["tar"] }] })
        : await open({ title: field.label, directory: field.picker === "folder", multiple: false });
      if (typeof selected === "string") setValue(field.key, selected);
    } catch (e) { setError(stringifyError(e)); }
  };
  const [title, actionLabel] = LABELS[workflow];
  return (
    <DockerFormDialog isOpen title={title} actionLabel={actionLabel} onClose={onClose} onSubmit={() => void submit()} isLoading={busy} width={620}>
      <VStack gap={3}>
        {image && <Text type="supporting" display="block" className="docker-card-text">{imageReference(image)}</Text>}
        {error && <Text type="body" color="primary" display="block" role="alert" className="docker-card-text">{error}</Text>}
        {FIELDS[workflow].map(field => (
          <Field key={field.key} label={field.label} description={field.description} inputID={`${id}-${field.key}`} isRequired={field.required}>
            {field.options ? (
              <Selector label={field.label} isLabelHidden options={field.options} value={values[field.key]} onChange={value => setValue(field.key, value)} isDisabled={busy} />
            ) : field.multiline ? (
              <TextArea id={`${id}-${field.key}`} label={field.label} isLabelHidden value={values[field.key] ?? ""} onChange={value => setValue(field.key, value)} isDisabled={busy} />
            ) : (
              <HStack gap={1} wrap="wrap" align="center">
                <div className="flex-1 basis-[240px] min-w-0">
                  <TextInput id={`${id}-${field.key}`} label={field.label} isLabelHidden value={values[field.key] ?? ""} onChange={value => setValue(field.key, value)} onEnter={() => void submit()} isDisabled={busy} />
                </div>
                {field.picker && <Button label="Browse" variant="secondary" onClick={() => void choose(field)} isDisabled={busy} />}
              </HStack>
            )}
          </Field>
        ))}
      </VStack>
    </DockerFormDialog>
  );
}
