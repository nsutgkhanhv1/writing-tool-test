import { LLMBuilder } from "@repo/ai";
import { jwtVerify, SignJWT } from "jose";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { SerializePlugin } from "kysely-plugin-serialize";
import { ImplementationContext, ServerContext } from "./context.types";
import { D1KV } from "./db/kv";
import { Tables } from "./db/types";

let singleton: ImplementationContext | undefined;
export const contextTransform = (c: ServerContext): ImplementationContext => {
  if (singleton) {
    return singleton;
  }
  const db = new Kysely<Tables>({
    dialect: new D1Dialect({
      database: c.DB,
    }),
    plugins: [new SerializePlugin()],
  });
  singleton = {
    getLLM(modelName) {
      return new LLMBuilder(modelName ?? "openai/gpt-oss-120b")
        .setApiKey(c.GF_AI_KEY)
        .setProvider("openrouter")
        .setOrProvider("cerebras")
        .setAppName("writing-tool")
        .setUseStructuredOutput(true)
        .build();
    },
    async signJWT(payload) {
      const secret = new TextEncoder().encode(c.JWT_SECRET);
      return await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).sign(secret);
    },
    async verifyJWT(token) {
      const secret = new TextEncoder().encode(c.JWT_SECRET);
      const result = await jwtVerify(token, secret);
      return result.payload as { userId: string };
    },
    async getCurrentUserId() {
      if (!singleton?.token) {
        return undefined;
      }
      return (await singleton.verifyJWT(singleton.token)).userId;
    },
    getLLMThinking(modelName: string | undefined) {
      return (
        new LLMBuilder(modelName ?? "google/gemini-2.5-flash")
          // .setApiKey(env.GF_AI_KEY)
          .setBaseUrl("https://ai-proxy.caliai.fit/proxy")
          .setApiKey(c.GF_AI_KEY)
          .setProvider("openrouter")
          .setMaxReasoningTokens(512)
          .setAppName("writing-tool")
          .setUseStructuredOutput(true)
          .build()
          .setSeed(1)
      );
    },
    db: db,
    kv: new D1KV(db as any),
    serverContext: c,
  };
  return singleton;
};
