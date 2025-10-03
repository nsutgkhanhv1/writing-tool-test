import { Hono } from "hono";
import { ServerContext } from "./context.types";
import { contextTransform } from "./contextTransform";
import { createStreamStorage } from "./createStreamStorage";
import { impl } from "./impl";
import { serveOnHono } from "./lib/serveOnHono";

export * from "./do/NoteRecordDO";

import "./impl/auth";
import "./impl/test";

const app = new Hono<{
  Bindings: ServerContext;
}>();

serveOnHono(app, impl, contextTransform, (c) => c.NoteRecordDO, createStreamStorage);

export default app;
