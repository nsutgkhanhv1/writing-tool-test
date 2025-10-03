import { EndpointMap, Implementation, MaybePromise } from "@repo/contract";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { v4 as uuid } from "uuid";
import { ContractDO } from "./ContractDO";
import { StreamStorage } from "./types";

export const serveOnHono = <
  C extends object,
  F extends EndpointMap,
  S extends EndpointMap,
  IC extends {
    token?: string;
  },
>(
  hono: Hono<{ Bindings: C }>,
  impl: Implementation<F, S, IC>,
  contextTransform: (context: C) => MaybePromise<Omit<IC, "token">>,
  getDurableObject: (context: C) => DurableObjectNamespace<ContractDO<any>>,
  streamStorageFactory?: (context: C) => StreamStorage,
  baseUrl: string = ""
) => {
  hono.use(cors());
  hono.get(`${baseUrl}/status`, async (c) => {
    return c.json(impl.getStatus());
  });
  hono.post(`${baseUrl}/fetchables/:key`, async (c) => {
    let payload: any = undefined;
    try {
      payload = await c.req.json();
    } catch (e) {
      console.error(e);
    }
    const key = c.req.param("key");
    const handler = impl.handleFetch(key);
    if (!handler) {
      return c.text("Not Found", 404);
    }

    const context = (await contextTransform(c.env)) as IC;
    const authHeader = c.req.header("Authorization");
    if (authHeader) {
      const token = authHeader.split(" ")[1];
      context.token = token;
    } else {
      context.token = undefined;
    }
    try {
      const result = await handler(context, payload);
      return c.json(result as any);
    } catch (e) {
      console.error(e);
      c.status(500);
      return c.json({ error: (e as any).message });
    }
  });

  hono.get(`${baseUrl}/streamables/:key`, async (c) => {
    if (c.req.header("Upgrade") !== "websocket") {
      return c.text("Expected websocket", 400);
    }
    const key = c.req.param("key");

    const durableObjectNS = getDurableObject(c.env);

    const context = (await contextTransform(c.env)) as IC;
    const tokenQs = c.req.query("token");
    context.token = tokenQs;

    const requestId = uuid();
    const id = durableObjectNS.idFromName(`${key}-${requestId}`);
    const durableObject = durableObjectNS.get(id);
    return durableObject.fetch(c.req.raw);
  });

  hono.post(`${baseUrl}/retryStream/:key`, async (c) => {
    const key = c.req.param("key");
    if (!streamStorageFactory) {
      return c.text("Internal Server Error", 500);
    }
    const streamStorage = streamStorageFactory(c.env);
    const objectId = await streamStorage.getObjectId(key);
    if (!objectId) {
      return c.text("Not Found", 404);
    }

    await streamStorage.clearResult(key);

    const authHeader = c.req.header("Authorization");
    const token = authHeader?.split(" ")[1];

    const durableObjectNS = getDurableObject(c.env);
    const durableObjectId = durableObjectNS.idFromString(objectId);
    const durableObject = durableObjectNS.get(durableObjectId);
    await durableObject.retry(key, token);
    return c.text("ok");
  });

  hono.get(`${baseUrl}/resumeStream/:key`, async (c) => {
    const key = c.req.param("key");
    if (!streamStorageFactory) {
      return c.status(500);
    }
    const streamStorage = streamStorageFactory(c.env);

    const result = await streamStorage.getResult(key);

    if (result) {
      const [client, server] = Object.values(new WebSocketPair());
      server.accept();
      server.addEventListener("message", (e) => {
        const data = JSON.parse(e.data.toString());
        if (data.type === "request") {
          if (result.type === "onEnd") {
            server.send(
              JSON.stringify({ type: "onEnd", payload: result.payload })
            );
          } else if (result.type === "onError") {
            server.send(
              JSON.stringify({ type: "onError", payload: result.payload })
            );
          }
          server.close();
        }
      });
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    const id = await streamStorage.getObjectId(key);
    if (!id) {
      return c.status(404);
    }
    const durableObjectNS = getDurableObject(c.env);
    const durableObjectId = durableObjectNS.idFromString(id);
    const durableObject = durableObjectNS.get(durableObjectId);
    return durableObject.fetch(c.req.raw);
  });
};
