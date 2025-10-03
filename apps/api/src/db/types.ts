import { User } from "@repo/common";
import { Kysely } from "kysely";

export interface KV {
  key: string;
  value: string;
}

export type Tables = {
  KV: KV;
  User: User;
};

export type WritingToolDb = Kysely<Tables>;
