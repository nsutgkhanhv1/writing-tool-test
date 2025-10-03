import { User } from "@repo/common";
import { WritingToolDb } from "../db/types";
import { v4 as uuidv4 } from "uuid";

export const createNewUser = async (db: WritingToolDb, user: Partial<User>) => {
  const newUser = await db
    .insertInto("User")
    .values({
      ...user,
      id: user.id || uuidv4(),
    })
    .returning("id")
    .executeTakeFirst();

  return newUser;
};
