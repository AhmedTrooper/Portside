import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { imageWorkflowRequest, ImageWorkflowDialog, type ImageWorkflow } from "../src/features/docker/images/ImageWorkflowDialog";
import { isImageOperation, IMAGE_OPERATION_KINDS } from "../src/features/docker/images/imageOperations";
import type { DockerImage } from "../src/features/docker/shared/types";

const image: DockerImage = { ID: "sha256:123456789abcdef", Repository: "team/app", Tag: "latest", Size: "10MB", CreatedSince: "1 hour ago", Containers: "0" };

describe("image workflow requests", () => {
  test("tags the selected image rather than a shell command", () => {
    expect(imageWorkflowRequest("tag", { reference: "ghcr.io/team/app:v2" }, image)).toEqual({ command: "docker_tag_image", args: { id: image.ID, reference: "ghcr.io/team/app:v2" } });
  });
  test("run arguments are a string array and environment values stay intact", () => {
    const request = imageWorkflowRequest("run", { command: '["sh","-c","echo hi"]', ports: "8080:80\n8443:443", environment: "MESSAGE=hello world" }, image);
    expect(request.args.options.command).toEqual(["sh", "-c", "echo hi"]);
    expect(request.args.options.environment).toEqual(["MESSAGE=hello world"]);
    expect(request.args.options.ports).toEqual(["8080:80", "8443:443"]);
    expect(() => imageWorkflowRequest("run", { command: '{"command":"sh"}' }, image)).toThrow();
  });
  test("builds carry tags, context, build arguments and cache options", () => {
    const request = imageWorkflowRequest("build", { context: "/project", tags: "app:v1\napp:latest", buildArgs: "VERSION=1", cache: "No cache", pull: "Pull latest base images" });
    expect(request.args.options.tags).toEqual(["app:v1", "app:latest"]);
    expect(request.args.options.noCache).toBe(true);
    expect(request.args.options.pull).toBe(true);
    expect(() => imageWorkflowRequest("build", { context: "/project", tags: "" })).toThrow();
  });
  test("dangling archives use the image ID, not a display placeholder", () => {
    expect(imageWorkflowRequest("save", { path: "/exports/image.tar" }, { ...image, Repository: "<none>", Tag: "<none>" }).args.id).toBe(image.ID);
  });
  test("load and push map to their dedicated CLI commands", () => {
    expect(imageWorkflowRequest("load", { path: "/exports/image.tar" }).command).toBe("docker_load_images");
    expect(imageWorkflowRequest("push", { reference: "team/app:latest" }, image).command).toBe("docker_push_image");
  });
});

describe("explicit submit controls", () => {
  for (const workflow of ["tag", "run", "push", "build", "save", "load"] as ImageWorkflow[]) {
    test(`${workflow} has a visible named submit action in a footer`, () => {
      const html = renderToStaticMarkup(<ImageWorkflowDialog workflow={workflow} image={image} onClose={() => {}} onSubmit={async () => {}} />);
      const label = workflow[0].toUpperCase() + workflow.slice(1);
      expect(html).toContain(`>${label}</span>`);
      expect(html).toContain("astryx-layout-footer");
    });
  }
});

test("operation guards accept every workflow and reject corrupt layer counters", () => {
  const operation = { id: "op", target: "app", status: "running", started_at_ms: 1, finished_at_ms: null, message: null, layers: {}, log: "" };
  for (const kind of IMAGE_OPERATION_KINDS) expect(isImageOperation({ ...operation, kind })).toBe(true);
  expect(isImageOperation({ ...operation, kind: "build", layers: { bad: { id: "bad", current: "oops", total: 2 } } })).toBe(false);
});
