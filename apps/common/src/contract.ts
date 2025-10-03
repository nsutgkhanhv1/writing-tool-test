import { Contract } from "@repo/contract";
import { Type as t } from "@sinclair/typebox";

export const WritingToolContract = new Contract()
  .fetch("authentication:anonymousLogin", t.Object({}), t.String())
  .streamObject(
    "streamTestData",
    t.Object({}),
    t.Object({
      animals: t.Array(t.String()),
    }),
  );
