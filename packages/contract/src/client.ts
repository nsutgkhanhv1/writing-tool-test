import { Stream } from "@repo/stream";
import EventEmitter from "events";
import { ClientHandler, MaybePromise } from "./core";

export const createHttpHandler = (
  baseUrl: string,
  token: string | undefined | (() => MaybePromise<string | undefined>),
): ClientHandler => {
  return {
    async fetch(key, payload) {
      const calculatedToken = typeof token === "function" ? await token() : token;
      const res = await fetch(`${baseUrl}/fetchables/${key}`, {
        method: "POST",
        headers: calculatedToken
          ? {
              "Content-Type": "application/json",
              Authorization: `Bearer ${calculatedToken}`,
            }
          : {
              "Content-Type": "application/json",
            },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(res.statusText);
      }
      return await res.json();
    },
    stream(key, payload) {
      const emitter = new EventEmitter() as any;
      const wsBaseUrl = baseUrl.replace("http", "ws");
      (async () => {
        const calculatedToken = typeof token === "function" ? await token() : token;
        const url = calculatedToken
          ? `${wsBaseUrl}/streamables/${key}?token=${calculatedToken}`
          : `${wsBaseUrl}/streamables/${key}`;
        const ws = new WebSocket(url);
        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "request",
              key,
              payload,
            }),
          );
        };
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === "onStart") {
            emitter.emit("onStart", data.id);
          } else {
            emitter.emit(data.type, data.payload);
          }
        };
      })();

      return new Stream(emitter);
    },
    async retryStream(streamId) {
      const calculatedToken = typeof token === "function" ? await token() : token;
      await fetch(`${baseUrl}/retryStream/${streamId}`, {
        method: "POST",
        headers: calculatedToken
          ? {
              "Content-Type": "application/json",
              Authorization: `Bearer ${calculatedToken}`,
            }
          : {
              "Content-Type": "application/json",
            },
        body: JSON.stringify({}),
      });
    },
    resumeStream(streamId) {
      const emitter = new EventEmitter() as any;
      const wsBaseUrl = baseUrl.replace("http", "ws");
      (async () => {
        const calculatedToken = typeof token === "function" ? await token() : token;
        const url = calculatedToken
          ? `${wsBaseUrl}/resumeStream/${streamId}?token=${calculatedToken}`
          : `${wsBaseUrl}/resumeStream/${streamId}`;
        const ws = new WebSocket(url);
        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "request",
              streamId,
            }),
          );
        };
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          emitter.emit(data.type, data.payload);
        };
      })();

      return new Stream(emitter);
    },
  };
};

// export const createLocalHandler = <
//   FetchableContract extends EndpointMap,
//   StreamableContract extends EndpointMap,
//   Context
// >(
//   impl: Implementation<FetchableContract, StreamableContract, Context>,
//   c: Context,
// ): ClientHandler => {
//   return {
//     async fetch(key, payload) {
//       return impl.handleFetch(key)!(c, payload);
//     },
//     stream(key, payload) {
//       const emitter = new EventEmitter() as TypedEventEmitter<
//         TextStreamEvents | StreamEvents<any> | ArrayStreamEvent<any>
//       >;
//       impl.handleStream(key)!(c, payload, emitter);
//       return new Stream(emitter);
//     },
//     async retryStream(streamId) {
//       throw new Error("Not implemented");
//     },
//     async resumeStream(streamId) {
//       throw new Error("Not implemented");
//     },
//   };
// };
