import { Implementation, MaybePromise } from "@repo/contract";
import { DurableObject } from "cloudflare:workers";
import { EventEmitter } from "events";
import { v4 as uuid } from "uuid";
import { StreamStorage } from "./types";

export class ContractDO<C extends object> extends DurableObject<C> {
  impl?: Implementation<any, any, any>;
  contextTransform?: (context: C) => MaybePromise<any>;
  streamStorage?: StreamStorage;
  constructor(ctx: DurableObjectState, env: C) {
    super(ctx, env);
  }
  setImplementation(impl: Implementation<any, any, any>) {
    this.impl = impl;
  }
  setContextTransform(contextTransform: (context: C) => MaybePromise<any>) {
    this.contextTransform = contextTransform;
  }
  setStreamStorage(streamStorage: StreamStorage) {
    this.streamStorage = streamStorage;
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const data = JSON.parse(message.toString());
    if (data.type !== "request") {
      return;
    }

    const shouldStart = await this.streamStorage?.markAsStarted(
      this.ctx.id.toString()
    );
    if (!shouldStart) {
      return;
    }

    const payload = data.payload;
    const token = ws.deserializeAttachment();

    await this.handleRequest(data.key, payload, token, true);
  }

  private async handleRequest(
    key: string,
    payload: any,
    token: string | undefined,
    isFirstRun = false,
    streamId?: string
  ) {
    const emitter = new EventEmitter();
    const context = await this.contextTransform?.(this.env);

    if (token) {
      context.token = token;
    }

    const handler = this.impl?.handleStream(key);

    if (!handler) {
      return;
    }

    if (!streamId) {
      const streamIdGenerator = this.impl?.streamIdGenerators[key];
      streamId =
        (await streamIdGenerator?.(context, payload)) || `${key}:${uuid()}`;

      await this.streamStorage?.setObjectId(streamId, this.ctx.id.toString());
    }

    if (isFirstRun) {
      await this.streamStorage?.saveRequest(streamId, {
        key,
        payload,
        streamId,
      });
    }

    handler(context, payload, emitter as any, streamId);
    const ALL_EVENTS = [
      "onStart",
      "onChunk",
      "onPartialResult",
      "onItem",
      "onError",
      "onEnd",
      "onReasoningChunk",
    ];
    const websockets = this.ctx.getWebSockets();
    for (const ws of websockets) {
      ws.send(JSON.stringify({ type: "onStart", id: streamId }));
    }
    for (const event of ALL_EVENTS) {
      emitter.on(event, async (data: any) => {
        const websockets = this.ctx.getWebSockets();
        for (const ws of websockets) {
          ws.send(JSON.stringify({ type: event, payload: data }));
          if (event === "onEnd") {
            ws.close();
          }
        }
        if (event === "onEnd") {
          await this.streamStorage?.saveResult(streamId, {
            type: "onEnd",
            payload: data,
          });
        } else if (event === "onError") {
          await this.streamStorage?.saveResult(streamId, {
            type: "onError",
            payload: data,
          });
        }
      });
    }
  }

  async retry(streamId: string, token?: string) {
    const savedRequest = await this.streamStorage?.getRequest(streamId);

    if (!savedRequest) {
      console.log("No saved request found for retry");
      return;
    }

    console.log(`Retrying request for streamId: ${streamId}`);
    await this.handleRequest(
      savedRequest.key,
      savedRequest.payload,
      token,
      false,
      streamId
    );
  }

  async fetch(request: Request) {
    const [client, server] = Object.values(new WebSocketPair());
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (token) {
      server.serializeAttachment(token);
    }

    this.ctx.acceptWebSocket(server);
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
}
