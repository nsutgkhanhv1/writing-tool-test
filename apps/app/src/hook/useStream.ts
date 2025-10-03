import { Stream, type StreamEvents } from "@repo/stream";
import { useCallback, useEffect, useRef, useState } from "react";

export type MaybePromise<T> = T | Promise<T>;
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export const useStream = <T>(
  streamInitCallback: () => MaybePromise<Stream<StreamEvents<T>> | undefined>,
  autoStart: boolean | (() => MaybePromise<boolean>) = true,
) => {
  // Store the latest callback in a ref
  const callbackRef = useRef(streamInitCallback);

  // Update the ref when the callback changes
  useEffect(() => {
    callbackRef.current = streamInitCallback;
  }, [streamInitCallback]);
  const streamRef = useRef<Stream<StreamEvents<T>> | null>(null);
  const [finalResult, setFinalResult] = useState<T | undefined>();
  const [thinking, setThinking] = useState(false);
  const [thoughts, setThoughts] = useState<string>("");
  const [data, setData] = useState<DeepPartial<T> | undefined>(undefined);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [isStarted, setIsStarted] = useState(false);

  const shouldWaitRef = useRef(false);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.cancel();
      streamRef.current = null;
    }
    setData(undefined);
    setFinalResult(undefined);
    setError(undefined);
    setDone(false);
  }, []);

  const startStream = useCallback(async () => {
    if (shouldWaitRef.current) {
      return;
    }
    cleanup();
    setIsStarted(true);

    shouldWaitRef.current = true;
    try {
      const stream = await callbackRef.current();
      setThinking(true);
      if (!stream) {
        setError(new Error("Stream not found"));
        setDone(true);
        return;
      }
      shouldWaitRef.current = false;

      streamRef.current = stream;

      stream.on("onReasoningChunk", (reasoningChunk) => {
        setThinking(true);
        setThoughts((prev) => prev + reasoningChunk);
      });

      stream.on("onPartialResult", (partialResult) => {
        setThinking(false);
        setData((prev) => ({ ...prev, ...partialResult }) as DeepPartial<T>);
      });

      stream.on("onEnd", (finalResult) => {
        setData((prev) => ({ ...prev, ...finalResult }) as DeepPartial<T>);
        setFinalResult(finalResult);
        setDone(true);
      });

      stream.on("onError", (reason) => {
        setError(reason);
        setDone(true);
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setDone(true);
    }
  }, [cleanup]); // No more dependency on the callback

  useEffect(() => {
    (async () => {
      const autoStartValue = typeof autoStart === "function" ? await autoStart() : autoStart;
      if (autoStartValue && !shouldWaitRef.current) {
        if (streamRef.current) {
          return;
        }
        startStream();
      }
    })();

    return () => {
      cleanup();
    };
  }, [autoStart, startStream, cleanup]);

  const restart = useCallback(() => {
    return startStream();
  }, [startStream]);

  return {
    data,
    thinking,
    thoughts,
    done,
    error,
    finalResult,
    isStarted,
    start: startStream,
    restart,
  };
};
