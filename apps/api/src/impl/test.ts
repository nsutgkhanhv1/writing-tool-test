import { impl } from "../impl";
import { Type as t } from "@sinclair/typebox";

impl.stream("streamTestData", async (c, payload, emitter) => {
  try {
    const userId = await c.getCurrentUserId();

    if (!userId) {
      throw new Error("Unauthorized");
    }

    console.log(userId);

    const llm = c.getLLM();

    llm.prompt("Name 10 animals");

    llm.json(
      t.Object({
        animals: t.Array(t.String()),
      }),
    );

    const stream = llm.streamObject().pipeObject(emitter);

    return stream;
  } catch (error) {
    console.log(error);
  }
});
