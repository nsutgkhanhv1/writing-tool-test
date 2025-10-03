import { Kysely } from "kysely";
import { KV } from "./types";

export class D1KV {
  constructor(private db: Kysely<{ KV: KV }>) {}

  put(key: string, value: any) {
    return this.db
      .insertInto("KV")
      .values({ key, value })
      .onConflict((oc) => oc.doUpdateSet({ value }))
      .execute();
  }

  /**
   * Insert a new record, return true if inserted, false if already exists
   */
  async insert(key: string, value: any): Promise<boolean> {
    try {
      await this.db
        .insertInto("KV")
        .values({ key, value })
        .executeTakeFirstOrThrow();
      return true;
    } catch (e) {
      return false;
    }
  }

  async get(key: string): Promise<any> {
    const record = await this.db
      .selectFrom("KV")
      .where("key", "=", key)
      .select("value")
      .executeTakeFirst();
    return record?.value ?? null;
  }

  async delete(key: string): Promise<void> {
    await this.db.deleteFrom("KV").where("key", "=", key).execute();
  }
}
