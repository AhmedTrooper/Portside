/**
 * Wire types for the Docker payload produced by the Rust global-state poller.
 *
 * Every shape below mirrors one Docker CLI `--format '{{json .}}'` record.
 * The parsers are the trust boundary: anything malformed is dropped rather
 * than leaking into React as partially-typed data.
 */

export interface DockerContainer extends Record<string, unknown> {
  ID: string;
  Names: string;
  Image: string;
  State: string;
  Status: string;
  Ports: string;
  Command?: string;
  CreatedAt?: string;
  Labels?: string;
  LocalVolumes?: string;
  Mounts?: string;
  Networks?: string;
  RunningFor?: string;
  Size?: string;
}

export interface DockerImage extends Record<string, unknown> {
  ID: string;
  Repository: string;
  Tag: string;
  Size: string;
  CreatedSince: string;
  Containers: string;
  CreatedAt?: string;
  Digest?: string;
  SharedSize?: string;
  UniqueSize?: string;
}

export interface DockerNetwork extends Record<string, unknown> {
  ID: string;
  Name: string;
  Driver: string;
  Scope: string;
  Internal: string;
  IPv4: string;
  IPv6: string;
  Labels: string;
  CreatedAt: string;
}

export interface DockerVolume extends Record<string, unknown> {
  Name: string;
  Driver: string;
  Scope: string;
  Mountpoint: string;
  Availability?: string;
  Group?: string;
  Labels?: string;
  Links?: string;
  Size?: string;
  Status?: string;
}

export interface ComposeProject extends Record<string, unknown> {
  Name: string;
  Status: string;
  ConfigFiles: string;
}

export interface DockerSnapshot {
  containers: DockerContainer[];
  images: DockerImage[];
  networks: DockerNetwork[];
  volumes: DockerVolume[];
  composeProjects: ComposeProject[];
}

export function emptyDockerSnapshot(): DockerSnapshot {
  return {
    containers: [],
    images: [],
    networks: [],
    volumes: [],
    composeProjects: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function hasStrings(value: unknown, keys: string[]): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return keys.every((key) => typeof value[key] === "string");
}

export function isDockerContainer(value: unknown): value is DockerContainer {
  return hasStrings(value, ["ID", "Names", "Image", "State", "Status", "Ports"]);
}

export function isDockerImage(value: unknown): value is DockerImage {
  return hasStrings(value, [
    "ID",
    "Repository",
    "Tag",
    "Size",
    "CreatedSince",
    "Containers",
  ]);
}

export function isDockerNetwork(value: unknown): value is DockerNetwork {
  return hasStrings(value, [
    "ID",
    "Name",
    "Driver",
    "Scope",
    "Internal",
    "IPv4",
    "IPv6",
    "Labels",
    "CreatedAt",
  ]);
}

export function isDockerVolume(value: unknown): value is DockerVolume {
  return hasStrings(value, ["Name", "Driver", "Scope", "Mountpoint"]);
}

export function isComposeProject(value: unknown): value is ComposeProject {
  return hasStrings(value, ["Name", "Status", "ConfigFiles"]);
}

function parseList<T>(value: unknown, guard: (item: unknown) => item is T): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(guard);
}

/** Parse the unwrapped `GlobalStateData` shape used by both the command and event. */
export function parseDockerSnapshot(payload: unknown): DockerSnapshot | null {
  if (!isRecord(payload)) return null;
  const docker = payload.docker;
  if (!isRecord(docker)) return null;

  return {
    containers: parseList(docker.containers, isDockerContainer),
    images: parseList(docker.images, isDockerImage),
    networks: parseList(docker.networks, isDockerNetwork),
    volumes: parseList(docker.volumes, isDockerVolume),
    composeProjects: parseList(docker.compose_projects, isComposeProject),
  };
}

export function shortId(id: string, length = 12): string {
  return id.length > length ? id.slice(0, length) : id;
}

export function repositoryDisplay(image: DockerImage): string {
  if (image.Repository === "<none>") return "<dangling>";
  return image.Repository;
}

export function tagDisplay(image: DockerImage): string {
  if (image.Tag === "<none>") return "<dangling>";
  return image.Tag;
}

export function imageReference(image: DockerImage): string {
  return `${repositoryDisplay(image)}:${tagDisplay(image)}`;
}

export function isDanglingImage(image: DockerImage): boolean {
  return image.Repository === "<none>" || image.Tag === "<none>";
}

/** Parse Docker's label string (`key=value,key=value`) into a map. */
export function parseLabels(labels: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!labels) return out;
  for (const pair of labels.split(",")) {
    const at = pair.indexOf("=");
    if (at <= 0) continue;
    out[pair.slice(0, at)] = pair.slice(at + 1);
  }
  return out;
}

export function containerComposeProject(container: DockerContainer): string | null {
  const labels = parseLabels(container.Labels);
  return labels["com.docker.compose.project"] ?? null;
}

export function composeFiles(project: ComposeProject): string[] {
  return project.ConfigFiles.split(",")
    .map((file) => file.trim())
    .filter(Boolean);
}

export function composeBaseState(status: string): string {
  const match = /^([a-z]+)/i.exec(status);
  return match ? match[1].toLowerCase() : status.toLowerCase();
}

export function composeServiceCount(status: string): number | null {
  const match = /\((\d+)\)/.exec(status);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePorts(ports: string): string[] {
  if (!ports) return [];
  return ports
    .split(",")
    .map((port) => port.trim())
    .filter(Boolean);
}

export function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
