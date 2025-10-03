import { ArrayStreamEvent, Stream, StreamEvents, TextStreamEvents } from "@repo/stream";
import { Static, TSchema, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import JSONParser from "@streamparser/json/jsonparser.js";
import EventEmitter from "events";
import OpenAI from "openai";
import {
  ChatCompletionContentPart,
  ChatCompletionContentPartText,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/index.mjs";
import TypedEventEmitter from "typed-emitter";
import { generateJsonOutputGuardrail } from "./util";

export type Message =
  | {
      role: "user";
      content: string | Array<ChatCompletionContentPart>;
      name?: string;
    }
  | {
      role: "assistant" | "system";
      content: string | Array<ChatCompletionContentPartText>;
      name?: string;
    };

export class LLM<ReturnType = string, Usernames = string> {
  public openAi: OpenAI;
  messages: Message[] = [];
  limitTokens: number | undefined = undefined;
  private jsonMode: boolean = false;
  private schema?: TSchema;
  private seed: number = Math.floor(Math.random() * 2147483647);
  private priming: string | undefined = undefined;
  private usernamePrefixEnabled: boolean = false;
  public usernames: string[] = [];
  private withError = true;
  private temperature: number | undefined;

  constructor(
    private modelName: string,
    private baseUrl: string,
    private apiKey: string,
    browser?: boolean,
    provider?: string,
    private appName?: string,
    private appUrl?: string,
    private useStructuredOutput = true,
    private useTextForJson = true,
    private orProvider: string | string[] | undefined = undefined,
    private maxReasoningTokens: number | undefined = undefined,
    private customParams?: any
  ) {
    this.openAi = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
      dangerouslyAllowBrowser: browser,
      defaultHeaders: {
        provider,
        "X-Title": this.appName,
        "HTTP-Referer": this.appUrl,
      },
    });
  }
  json<T extends TSchema>(schema?: T): LLM<Static<T>> {
    this.jsonMode = true;
    this.schema = schema;
    // TODO: implement more strict prompting for claude json
    // if (schema && schema.type === 'array') {
    //   this.arrayMode = true;
    // }
    return this;
  }
  setTemperature(temp: number) {
    this.temperature = temp;
    return this;
  }
  disableError() {
    this.withError = false;
    return this;
  }
  enableError() {
    this.withError = true;
    return this;
  }
  setUsers<NewUsername extends string>(usernames: NewUsername[]): LLM<ReturnType, Usernames & NewUsername> {
    this.usernames = usernames;
    return this;
  }
  enableUsernamePrefix() {
    this.usernamePrefixEnabled = true;
    return this;
  }
  disableUsernamePrefix() {
    this.usernamePrefixEnabled = false;
    return this;
  }
  setPriming(priming: string | undefined) {
    this.priming = priming;
    return this;
  }
  userMessage(content: string, name?: Usernames & string) {
    if (this.usernamePrefixEnabled && name) {
      content = `${name}: ${content}`;
    }
    this.messages.push({ role: "user", content, name });
    return this;
  }
  assistantMessage(content: string, name?: string) {
    if (this.usernamePrefixEnabled && name) {
      content = `${name}: ${content}`;
    }
    this.messages.push({ role: "assistant", content, name });
    return this;
  }
  userImage(url: string, content: string, detail?: "auto" | "low" | "high") {
    return this.userImageDetail([
      { type: "text", text: content },
      { type: "image_url", image_url: { url, detail } },
    ]);
  }
  userImageDetail(content: Array<ChatCompletionContentPart>) {
    this.messages.push({ role: "user", content });
    return this;
  }
  limit(limit: number) {
    this.limitTokens = limit;
    return this;
  }
  prompt(prompt: string, cache = false) {
    if (cache) {
      this.messages.unshift({
        role: "system",
        content: [
          {
            type: "text",
            text: prompt,
            cache_control: {
              type: "ephemeral",
            },
          } as any,
        ],
      });
    } else {
      this.messages.unshift({ role: "system", content: prompt });
    }
    return this;
  }
  async get(): Promise<ReturnType | undefined> {
    if (this.jsonMode) {
      try {
        this.guardSystemMessage();
        const result = await this.getText();
        if (!result) {
          throw new Error("No result content!");
        }
        const parsed = JSON.parse(result);
        if (!this.schema) {
          return parsed as ReturnType;
        }
        if (Value.Check(this.schema!, parsed)) {
          return parsed as ReturnType;
        } else {
          console.log("Invalid schema", this.schema, parsed);
          throw new Error("Invalid schema");
        }
      } catch (error) {
        console.error(error);
        return undefined;
      }
    }
    const text = await this.getText();
    if (!text) {
      throw new Error("No result content!");
    }
    return text as ReturnType;
  }
  setSeed(seed: number) {
    this.seed = seed;
    return this;
  }
  setMaxReasoningTokens(tokens: number) {
    this.maxReasoningTokens = tokens;
    return this;
  }
  streamText(array?: boolean) {
    if (this.priming) {
      this.messages.push({ role: "assistant", content: this.priming });
    }
    const emitter = new EventEmitter() as TypedEventEmitter<TextStreamEvents>;
    const stream = new Stream(emitter);

    (async () => {
      let fullText = "";
      let firstTime = true;
      try {
        const params: ChatCompletionCreateParamsStreaming = {
          model: this.modelName,
          messages: [...this.messages],
          max_tokens: this.limitTokens,
          stream: true,
          temperature: this.temperature,
          seed: this.seed ?? 1,
          response_format:
            this.useStructuredOutput && this.schema
              ? {
                  type: "json_schema",
                  json_schema: {
                    name: "schema",
                    schema: array ? Type.Array(this.schema) : this.schema,
                  },
                }
              : {
                  type: this.jsonMode && !this.useTextForJson ? "json_object" : "text",
                },
        };
        if (this.maxReasoningTokens) {
          // @ts-expect-error
          params.reasoning = { max_tokens: this.maxReasoningTokens };
        }
        if (this.orProvider) {
          // @ts-expect-error
          params.provider = {
            only: Array.isArray(this.orProvider) ? this.orProvider : [this.orProvider],
            allow_fallbacks: false,
            require_parameters: false,
          };
        }
        const res = await this.openAi.chat.completions.create({ ...params, ...this.customParams } as typeof params);
        for await (const chunk of res) {
          if (stream.controller.signal.aborted) {
            res.controller.abort();
            break;
          }
          if (firstTime) {
            firstTime = false;
            if (this.priming) {
              emitter.emit("onChunk", this.priming);
              fullText += this.priming;
              emitter.emit("onPartialResult", fullText);
            }
          }
          // @ts-expect-error
          if (chunk.choices[0]?.delta?.reasoning) {
            // @ts-expect-error
            emitter.emit("onReasoningChunk", chunk.choices[0]?.delta?.reasoning);
          }

          const txt = chunk.choices[0]?.delta?.content || "";
          if (!txt) continue;
          emitter.emit("onChunk", txt);
          fullText += txt;
          emitter.emit("onPartialResult", fullText);
        }
        emitter.emit("onEnd", fullText);
      } catch (error) {
        emitter.emit("onError", error);
        stream.cancel();
      }
    })();

    return stream;
  }

  private guardSystemMessage(array?: boolean) {
    const systemMessage = this.messages.find((message) => message.role === "system");
    if (systemMessage && this.schema && !this.useStructuredOutput) {
      systemMessage.content +=
        "\n\n" + generateJsonOutputGuardrail(array ? Type.Array(this.schema) : this.schema, this.withError);
    }
  }

  streamObject() {
    if (!this.jsonMode) {
      throw new Error("Stream object only works in JSON mode");
    }

    this.guardSystemMessage();

    const emitter = new EventEmitter() as TypedEventEmitter<StreamEvents<ReturnType>>;
    const newStream = new Stream(emitter);

    const stream = this.streamText();
    const parser = new JSONParser({
      stringBufferSize: undefined,
      // TODO: dig deeper
      paths: ["$.*", "$.*.*", "$.*.*.*"],
      emitPartialTokens: true,
      emitPartialValues: true,
    });
    const data: any = {};
    parser.onValue = (value) => {
      let previousLevel = data;
      let currentLevel = data;
      for (let pV of value.stack) {
        if (pV.key !== undefined && pV.key !== "") {
          currentLevel = currentLevel[pV.key];
          if (!currentLevel) {
            if (Array.isArray((pV.value as any)[pV.key])) {
              currentLevel = [];
            } else {
              currentLevel = {};
            }
            previousLevel[pV.key] = currentLevel;
          }
          previousLevel = currentLevel;
        }
      }

      if (value.key !== undefined && value.key !== "") {
        currentLevel[value.key] = value.value;
        emitter.emit("onPartialResult", data);
      }
    };
    stream.on("onChunk", (chunk) => {
      try {
        parser.write(chunk);
      } catch (e) {
        emitter.emit("onError", e);
      }
    });
    stream.on("onReasoningChunk", (chunk) => {
      emitter.emit("onReasoningChunk", chunk);
    });
    stream.on("onError", (error) => {
      emitter.emit("onError", error);
    });
    stream.on("onEnd", (finalResult) => {
      try {
        const data = JSON.parse(finalResult);
        // if (this.schema) {
        //   if (Value.Check(this.schema, data)) {
        //     emitter.emit("onEnd", data as ReturnType);
        //     return;
        //   } else {
        //     console.log("Invalid schema", this.schema, data);
        //     emitter.emit("onError", "Invalid schema");
        //   }
        // }
        emitter.emit("onEnd", data);
      } catch (error) {
        console.log("Invalid result", finalResult);
        emitter.emit("onError", error);
      }
    });
    newStream.controller.signal.onabort = () => {
      stream.cancel();
    };

    return newStream;
  }

  // TODO: retry
  streamArray() {
    if (!this.jsonMode || !this.schema) {
      throw new Error("Stream array only works in JSON mode");
    }
    this.guardSystemMessage(true);
    const itemSchema = this.schema;
    const partialType = Type.Partial(itemSchema);
    const arrayType = Type.Array(itemSchema);

    const emitter = new EventEmitter() as TypedEventEmitter<ArrayStreamEvent<ReturnType>>;
    const newStream = new Stream(emitter);

    const paths: string[] = itemSchema.type === "string" ? ["$.*"] : ["$.*", "$.*.*"];

    const stream = this.streamText(true);
    // TODO: customize this
    const parser = new JSONParser({
      stringBufferSize: undefined,
      // TODO: allow custom paths
      paths,
      emitPartialValues: itemSchema.type !== "string",
      emitPartialTokens: itemSchema.type !== "string",
    });

    const values: any[] = [];
    parser.onValue = (value) => {
      const item = value.value;
      // TODO: check the case the last key has only 1 token
      if (Value.Check(itemSchema, item)) {
        values.push(item);
        emitter.emit("onItem", item as ReturnType);
      } else {
        const k = value.key?.toString();
        const v = value.value;
        const partialItem: any = {
          ...value.parent,
        };
        if (k && v) {
          partialItem[k] = v;
        }
        if (Value.Check(partialType, partialItem)) {
          emitter.emit("onPartialResult", partialItem as Partial<ReturnType>);
        }
      }
    };

    stream.on("onChunk", (chunk) => {
      try {
        parser.write(chunk);
      } catch (e) {
        emitter.emit("onError", e);
      }
    });
    stream.on("onError", (error) => {
      emitter.emit("onError", error);
    });
    stream.on("onEnd", (finalResult) => {
      try {
        const data = JSON.parse(finalResult);
        if (Array.isArray(data)) {
          if (Value.Check(arrayType, data)) {
            emitter.emit("onEnd", data as ReturnType[]);
            return;
          } else {
            console.log("Invalid schema", arrayType, data);
            emitter.emit("onError", "Invalid schema");
          }
        }
        emitter.emit("onEnd", values);
      } catch (error) {
        emitter.emit("onError", error);
      }
    });

    newStream.controller.signal.onabort = () => {
      stream.cancel();
    };

    return newStream;
  }

  private async getText() {
    if (this.priming) {
      this.messages.push({ role: "assistant", content: this.priming });
    }
    const res = await this.openAi.chat.completions
      .create({
        model: this.modelName,
        messages: [...this.messages],
        max_tokens: this.limitTokens,
        seed: this.seed ?? 1,
        temperature: this.temperature,
        provider: this.orProvider
          ? {
              order: Array.isArray(this.orProvider) ? this.orProvider : [this.orProvider],
              allow_fallbacks: false,
            }
          : undefined,
        response_format: this.useStructuredOutput
          ? {
              type: "json_schema",
              json_schema: {
                name: "schema",
                schema: this.schema,
              },
            }
          : {
              type: this.jsonMode && !this.useTextForJson ? "json_object" : "text",
            },
        ...this.customParams,
      })
      .catch((err) => {
        console.error(err);
        return { choices: [] };
      });
    return this.priming ? this.priming + res.choices[0]?.message.content?.trim() : res.choices[0]?.message.content;
  }
}

export class LLMBuilder {
  private baseUrl: string = "https://ai.gamefox.vn/proxy";
  private apiKey?: string;
  private browser?: boolean = true;
  private provider?: string;
  private appName?: string;
  private appUrl?: string;
  private useStructuredOutput = true;
  private useTextForJson = true;
  private orProvider?: string | string[];
  private maxReasoningTokens?: number;
  private customParams?: any;

  constructor(private modelName: string) {
    if (modelName.startsWith("openai")) {
      this.provider = "openai";
    } else {
      this.provider = "openrouter";
    }
  }
  setCustomParams(customParams: any) {
    this.customParams = customParams;
    return this;
  }
  setUseStructuredOutput(useStructuredOutput: boolean) {
    this.useStructuredOutput = useStructuredOutput;
    return this;
  }
  setUseTextForJson(useTextForJson: boolean) {
    this.useTextForJson = useTextForJson;
    return this;
  }
  setAppName(appName?: string, appUrl: string = "https://example.com") {
    this.appName = appName;
    this.appUrl = appUrl;
    return this;
  }
  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl;
    return this;
  }
  setBrowser(browser: boolean) {
    this.browser = browser;
    return this;
  }
  setProvider(provider: string) {
    this.provider = provider;
    return this;
  }
  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    return this;
  }
  setOrProvider(orProvider: string | string[]) {
    this.orProvider = orProvider;
    return this;
  }
  setMaxReasoningTokens(maxReasoningTokens: number) {
    this.maxReasoningTokens = maxReasoningTokens;
    return this;
  }
  build() {
    if (!this.apiKey) {
      throw new Error("API key is required");
    }
    return new LLM(
      this.modelName,
      this.baseUrl,
      this.apiKey,
      this.browser,
      this.provider,
      this.appName,
      this.appUrl,
      this.useStructuredOutput,
      this.useTextForJson,
      this.orProvider,
      this.maxReasoningTokens,
      this.customParams
    );
  }
}

export const checkToken = async (apiKey: string, baseUrl: string, modelName: string) => {
  const openAi = new OpenAI({
    apiKey,
    baseURL: baseUrl || undefined,
    dangerouslyAllowBrowser: true,
  });
  try {
    const res = await openAi.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: "You're a helpful assistant that respond with 'Test'",
        },
        { role: "user", content: "Hello" },
      ],
    });
    const text = res.choices[0]?.message.content;
    return text !== undefined;
  } catch (e) {
    console.error(e);
    return false;
  }
};
