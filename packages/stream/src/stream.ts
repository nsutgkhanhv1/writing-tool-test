import TypedEventEmitter, { EventMap } from "typed-emitter";

export type StreamEvents<T> = {
  onStart(id?: string): void;
  onReasoningChunk(chunk: string): void;
  onPartialResult(result: Partial<T>): void;
  onError(reason?: any): void;
  onEnd(finalResult: T): void;
};

export type ArrayStreamEvent<T> = {
  onPartialResult(result: Partial<T>): void;
  onItem(item: T): void;
  onError(reason?: any): void;
  onEnd(finalResult: T[]): void;
};

export type TextStreamEvents = StreamEvents<string> & {
  onChunk(chunk: string): void;
};

export class Stream<EM extends EventMap> {
  controller: AbortController;
  constructor(protected emitter: TypedEventEmitter<EM>) {
    this.controller = new AbortController();
  }
  on<K extends keyof EM>(event: K, listener: EM[K] | undefined) {
    listener && this.emitter.on(event, listener);
    return this;
  }
  off<K extends keyof EM>(event: K, listener: EM[K]) {
    this.emitter.off(event, listener);
    return this;
  }
  once<K extends keyof EM>(event: K, listener: EM[K] | undefined) {
    listener && this.emitter.once(event, listener);
    return this;
  }
  pipeText(
    emitter: TypedEventEmitter<TextStreamEvents>,
    cb?: (result: string) => Promise<void>,
  ) {
    const ownEmitter = this.emitter as TypedEventEmitter<TextStreamEvents>;
    ownEmitter.on("onPartialResult", (result) => {
      emitter.emit("onPartialResult", result);
    });
    ownEmitter.on("onError", (reason) => {
      emitter.emit("onError", reason);
    });
    ownEmitter.on("onEnd", async (finalResult) => {
      cb && (await cb(finalResult));
      emitter.emit("onEnd", finalResult);
    });
    ownEmitter.on("onChunk", (chunk) => {
      emitter.emit("onChunk", chunk);
    });
    ownEmitter.on("onReasoningChunk", (chunk) => {
      emitter.emit("onReasoningChunk", chunk);
    });
    return this;
  }
  pipeArray<T>(
    emitter: TypedEventEmitter<ArrayStreamEvent<T>>,
    cb?: (result: T[]) => Promise<void>,
  ) {
    const ownEmitter = this.emitter as TypedEventEmitter<ArrayStreamEvent<T>>;
    ownEmitter.on("onPartialResult", (result) => {
      emitter.emit("onPartialResult", result);
    });
    ownEmitter.on("onItem", (item) => {
      emitter.emit("onItem", item);
    });
    ownEmitter.on("onError", (reason) => {
      emitter.emit("onError", reason);
    });
    ownEmitter.on("onEnd", async (finalResult) => {
      cb && (await cb(finalResult));
      emitter.emit("onEnd", finalResult);
    });
    return this;
  }
  pipeObject<T>(
    emitter: TypedEventEmitter<StreamEvents<T>>,
    cb?: (result: T) => Promise<T>,
    partialModifier?: (partial: Partial<T>) => Partial<T> | Promise<Partial<T>>,
  ) {
    const ownEmitter = this.emitter as TypedEventEmitter<StreamEvents<T>>;
    ownEmitter.on("onPartialResult", async (result) => {
      const modifiedPartial =
        partialModifier && (await partialModifier(result));
      emitter.emit("onPartialResult", modifiedPartial ?? result);
    });
    ownEmitter.on("onError", (reason) => {
      emitter.emit("onError", reason);
    });
    ownEmitter.on("onEnd", async (finalResult) => {
      const result = cb && (await cb(finalResult));
      emitter.emit("onEnd", result ?? finalResult);
    });
    ownEmitter.on("onReasoningChunk", (chunk) => {
      emitter.emit("onReasoningChunk", chunk);
    });
    ownEmitter.on("onStart", (id) => {
      emitter.emit("onStart", id);
    });
    return this;
  }
  cancel() {
    this.controller.abort();
  }
  waitFor<K extends keyof EM>(event: K): Promise<Parameters<EM[K]>> {
    return new Promise((resolve, reject) => {
      const handler: EM[K] = ((...args: any[]) => {
        resolve(args as any);
      }) as any;
      const errorHandler: EM["onError"] = ((reason?: any) => {
        reject(reason);
      }) as any;
      this.emitter.once(event, handler);
      this.emitter.once("onError", errorHandler);
    });
  }
  finish(): Promise<Parameters<EM["onEnd"]>[0]> {
    return this.waitFor("onEnd").then(([data]) => data);
  }
  done() {
    return this.finish();
  }
}
