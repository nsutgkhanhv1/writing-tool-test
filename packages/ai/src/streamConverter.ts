import { Stream, StreamEvents } from "@repo/stream";
import JSONParser from "@streamparser/json/jsonparser.js";
import EventEmitter from "events";
import TypedEventEmitter from "typed-emitter";

export type StreamConverter<T> = {
  report: (chunk: string) => void;
  finish: () => void;
  error: (error: Error) => void;
  reportReasoning: (reasoning: string) => void;
  getStream: () => Stream<StreamEvents<T>>;
};

export const createStreamConverter = <T>() => {
  const emitter = new EventEmitter() as TypedEventEmitter<StreamEvents<T>>;
  const stream = new Stream<StreamEvents<T>>(emitter);

  const parser = new JSONParser({
    stringBufferSize: undefined,
    // TODO: dig deeper
    paths: ["$.*", "$.*.*", "$.*.*.*"],
    emitPartialTokens: true,
    emitPartialValues: true,
  });
  const data: any = {};
  parser.onValue = (value) => {
    let previousLevel = data;
    let currentLevel = data;
    for (let pV of value.stack) {
      if (pV.key !== undefined && pV.key !== "") {
        currentLevel = currentLevel[pV.key];
        if (!currentLevel) {
          if (Array.isArray((pV.value as any)[pV.key])) {
            currentLevel = [];
          } else {
            currentLevel = {};
          }
          previousLevel[pV.key] = currentLevel;
        }
        previousLevel = currentLevel;
      }
    }

    if (value.key !== undefined && value.key !== "") {
      currentLevel[value.key] = value.value;
      emitter.emit("onPartialResult", data);
    }
  };

  return {
    report: (chunk: string) => {
      parser.write(chunk);
    },
    finish: () => {
      emitter.emit("onEnd", data);
    },
    error: (error: Error) => {
      emitter.emit("onError", error);
    },
    reportReasoning: (reasoning: string) => {
      emitter.emit("onReasoningChunk", reasoning);
    },
    getStream: () => stream,
  };
};

export const createSingleValueStream = <T>(value: T) => {
  const emitter = new EventEmitter() as TypedEventEmitter<StreamEvents<T>>;
  const stream = new Stream<StreamEvents<T>>(emitter);
  setTimeout(() => {
    emitter.emit("onPartialResult", value);
    emitter.emit("onEnd", value);
  }, 0);
  return stream;
};

export const createSingleErrorStream = <T>(error: Error) => {
  const emitter = new EventEmitter() as TypedEventEmitter<StreamEvents<T>>;
  const stream = new Stream<StreamEvents<T>>(emitter);
  setTimeout(() => {
    emitter.emit("onError", error);
  }, 0);
  return stream;
};
