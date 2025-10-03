/* eslint-disable no-undef */
/* eslint-disable turbo/no-undeclared-env-vars */
import { Type as t } from "@sinclair/typebox";
import { test } from "bun:test";
import { LLMBuilder } from "../llm";

test(
  "simple test",
  async () => {
    const llm = new LLMBuilder("anthropic/claude-3-haiku").setApiKey(process.env.OPENROUTER_KEY!).build();
    const stream = llm
      .prompt("List 5 things that related to user's message.")
      .userMessage("cat")
      .json(t.String())
      .streamArray();
    const result = await stream.on("onItem", console.log).done();
    console.log("result", result);
  },
  {
    timeout: 60000,
  },
);
