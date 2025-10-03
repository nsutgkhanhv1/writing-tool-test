import { LLM } from "@repo/ai";
import { D1KV } from "./db/kv";
import { WritingToolDb } from "./db/types";
import { NoteRecordDO } from "./do/NoteRecordDO";

export type ServerContext = {
  GF_AI_KEY: string;
  NoteRecordDO: DurableObjectNamespace<NoteRecordDO>;
  DB: D1Database;
  GEMINI_KEY: string;
  JWT_SECRET: string;
  OR_KEY: string;
  YOUTUBE_API_KEY: string;
  R2: R2Bucket;
  R2_URL: string;
};

export type ImplementationContext = {
  token?: string;
  signJWT: (payload: { userId: string; email?: string }) => Promise<string>;
  verifyJWT: (token: string) => Promise<{ userId: string; email?: string }>;
  getCurrentUserId: () => Promise<string | undefined>;
  getLLMThinking: (modelName?: string) => LLM;
  getLLM: (modelName?: string) => LLM;
  db: WritingToolDb;
  kv: D1KV;
  serverContext: ServerContext;
};
