import * as fal from "@fal-ai/serverless-client";
import { Stream } from "@repo/stream";
import { EventEmitter } from "events";
import { v4 as uuid } from "uuid";

// TODO: endable, multiple image as output
export type ImageGenerationEvent = {
  onProgress: (value: number, max: number) => void;
  onError: (error: any) => void;
  onEnd: (url: string) => void;
};

export type MultiImageGenerationEvent = {
  onProgress: (value: number, max: number) => void;
  onError: (error: any) => void;
  onEnd: (urls: string[], rawData: any[]) => void;
};

export type WorkflowFile = {
  key: string[];
  url: string;
};

export const runWorkflow = <IndexType extends number | "all">(
  workflow: any,
  files: WorkflowFile[],
  imageIndex: IndexType,
): IndexType extends "all" ? Stream<MultiImageGenerationEvent> : Stream<ImageGenerationEvent> => {
  const devInfo: any = {};
  const inputs: any = {};

  for (const file of files) {
    const name = "file_" + uuid();
    inputs[name] = file.url;
    devInfo[name] = {
      key: file.key,
      class_type: "LoadImage",
    };
  }

  const emitter = new EventEmitter();
  const stream = new Stream(emitter as any);

  (async () => {
    const falStream = await fal.stream("fal-ai/comfy-server", {
      input: {
        prompt: workflow,
        fal_inputs_dev_info: devInfo,
        fal_inputs: inputs,
      },
    });
    falStream.on("error", (error) => {
      emitter.emit("onError", "FAL Error: " + error.message);
    });
    const outputData: { node: string; output: unknown }[] = [];
    let hasError = false;
    falStream.on("message", (message) => {
      if (message.type === "executed") {
        outputData.push({ node: message.data.node, output: message.data.output });
        console.log(message.data.output);
      } else if (message.type === "progress") {
        emitter.emit("onProgress", message.data.value, message.data.max);
      } else if (message.type === "fal-execution-error") {
        hasError = true;
        emitter.emit("onError", new Error(message.data));
      } else if (message.type === "execution_error") {
        hasError = true;
        emitter.emit("onError", new Error(JSON.stringify(message.data)));
      }
    });
    falStream.on("done", () => {
      if (hasError) return;
      const images: string[] = [];
      outputData.forEach((data) => {
        const imagesOutput = data.output as { images?: { url: string }[] };
        if (imagesOutput.images) {
          imagesOutput.images.forEach((image) => {
            images.push(image.url);
          });
        }
      });
      if (imageIndex === "all") {
        emitter.emit("onEnd", images, outputData);
      } else {
        const image = images[imageIndex as number];
        emitter.emit("onEnd", image);
      }
    });
  })();

  return stream as any;
};

export const uploadFileToComfy = async (domain: string, url: string) => {
  const imageName = "file_" + uuid();
  const formData = new FormData();
  const blob = await fetch(url).then((res) => res.blob());
  formData.append("image", blob, imageName);
  formData.append("overwrite", "true");
  const res = await fetch(`https://${domain}/upload/image`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  return data.name as string;
};

export type ComfyImage = {
  filename: string;
  subfolder: string;
  type: string;
};

export const getImageViewUrl = (domain: string, img: ComfyImage | undefined) => {
  if (!img) {
    return "";
  }
  return `https://${domain}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`;
};

export const setImageToWorkflow = (workflow: any, key: string[], imageName: string) => {
  let node = workflow;
  for (let i = 0; i < key.length - 1; i++) {
    node = node[key[i] as string];
  }
  node[key[key.length - 1] as string] = imageName;
};

export const runWorkflowComfy = <IndexType extends number | "all">(
  domain: string,
  workflow: any,
  files: WorkflowFile[],
  imageIndex: IndexType,
): IndexType extends "all" ? Stream<MultiImageGenerationEvent> : Stream<ImageGenerationEvent> => {
  const clientId = uuid();
  const ws = new WebSocket(`wss://${domain}/ws?clientId=${clientId}`);
  let promptId: string | undefined;
  const emitter = new EventEmitter();
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "progress") {
      if (data.data) {
        emitter.emit("onProgress", data.data.value, data.data.max);
      }
    } else if (data.type === "executed") {
      const executedPromptId = data?.data?.prompt_id;
      if (executedPromptId === promptId) {
        const images = data?.data?.output?.images;
        if (!images) {
          emitter.emit("onError", new Error("No images!"));
        }
        if (imageIndex === "all") {
          emitter.emit(
            "onEnd",
            images.map((img: any) => getImageViewUrl(domain, img)),
            images,
          );
        } else {
          const url = getImageViewUrl(domain, images[imageIndex]);
          emitter.emit("onEnd", url);
        }
        ws.close();
      }
    }
  };
  ws.onopen = async () => {
    workflow = JSON.parse(JSON.stringify(workflow));
    for (const file of files) {
      const name = await uploadFileToComfy(domain, file.url);
      setImageToWorkflow(workflow, file.key, name);
    }
    fetch(`https://${domain}/prompt`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
    })
      .then((res) => res.json())
      .then((data) => (promptId = data.prompt_id));
  };
  ws.onerror = (error) => {
    emitter.emit("onError", error);
  };
  return new Stream(emitter as any) as any;
};

export const MAX_SEED = 4294967295;
export const randomSeed = (workflow: any, index = 0) => {
  const seed = Math.floor(Math.random() * MAX_SEED);
  const matched = Object.keys(workflow).filter((k) => {
    return !!workflow[k].inputs && workflow[k].inputs.seed;
  });
  if (matched.length <= index) {
    throw new Error("Seed not found");
  }
  workflow[matched[index] as string].inputs.seed = seed;
  return seed;
};
export const setPrompt = (workflow: any, prompt: string, index = 0) => {
  const matched = Object.keys(workflow).filter((k) => {
    return !!workflow[k].inputs && workflow[k].inputs.text;
  });
  if (matched.length <= index) {
    throw new Error("Prompt not found");
  }
  workflow[matched[index] as string].inputs.text = prompt;
};

export type RunnerType = "comfy" | "fal";

export class WorkflowRunner {
  static create(runnerType: RunnerType, comfyDomain?: string) {
    return new WorkflowRunner(runnerType, comfyDomain || "comfy.fal.ai");
  }
  private constructor(
    private runnerType: RunnerType,
    private comfyDomain: string,
  ) {}

  runWorkflow(workflow: any, files: WorkflowFile[] = [], imageIndex = 0): Stream<ImageGenerationEvent> {
    // TODO: handle cached case
    if (this.runnerType === "fal") {
      return runWorkflow(workflow, files, imageIndex);
    } else {
      return runWorkflowComfy(this.comfyDomain, workflow, files, imageIndex) as any;
    }
  }
  runMultiImageWorkflow(workflow: any, files: WorkflowFile[] = []): Stream<MultiImageGenerationEvent> {
    if (this.runnerType === "fal") {
      return runWorkflow(workflow, files, "all");
    }
    return runWorkflowComfy(this.comfyDomain, workflow, files, "all");
  }
}
