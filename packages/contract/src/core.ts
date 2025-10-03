import { ArrayStreamEvent, Stream, StreamEvents, TextStreamEvents } from "@repo/stream";
import { Static, TSchema, Type as t } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import TypedEventEmitter from "typed-emitter";

export type MaybePromise<T> = T | Promise<T>;
export type MaybePromiseOrVoid<T> = T | Promise<T> | void;

export interface EndpointContract {
  payload: unknown;
  response: unknown;
  streamMode?: "object" | "array" | "text";
  // payloadName?: string;
}
export type EndpointMap = Record<string, EndpointContract>;
export type EndpointMapKey<T extends EndpointMap> = keyof T & string;
export type EndpointPayload<T extends EndpointMap, K extends EndpointMapKey<T>> = T[K]["payload"];
export type EndpointResponse<T extends EndpointMap, K extends EndpointMapKey<T>> = T[K]["response"];
export type ContractMap = Record<string, Contract<any, any>>;
export type ContractGroupMap = Record<string, ContractGroup<any, any>>;

export class Contract<FetchableContract, StreamableContract> {
  payloadTypes: { [key: string]: TSchema } = {};
  responseTypes: { [key: string]: TSchema } = {};
  fetchKeys: string[] = [];
  streamKeys: string[] = [];
  streamModes: { [key in string]: "object" | "array" | "text" } = {};
  constructor(public name?: string) {}
  static fetch<K extends string, P extends TSchema, R extends TSchema>(key: K, payload: P, response: R) {
    return new Contract().fetch(key, payload, response);
  }
  static streamObject<K extends string, P extends TSchema, R extends TSchema>(key: K, payload: P, response: R) {
    return new Contract().streamObject(key, payload, response);
  }
  static streamArray<K extends string, P extends TSchema, R extends TSchema>(key: K, payload: P, response: R) {
    return new Contract().streamArray(key, payload, response);
  }
  static streamText<K extends string, P extends TSchema>(key: K, payload: P) {
    return new Contract().streamText(key, payload);
  }
  fetch<K extends string, P extends TSchema, R extends TSchema>(
    key: K,
    payload: P,
    response: R,
  ): Contract<
    FetchableContract & {
      [key in K]: {
        payload: Static<P>;
        response: Static<R>;
      };
    },
    StreamableContract
  > {
    this.payloadTypes[key] = payload;
    this.responseTypes[key] = response;
    this.fetchKeys.push(key);
    return this as any;
  }
  streamObject<K extends string, P extends TSchema, R extends TSchema>(
    key: K,
    payload: P,
    response: R,
  ): Contract<
    FetchableContract,
    StreamableContract & {
      [key in K]: {
        payload: Static<P>;
        response: Static<R>;
        streamMode: "object";
      };
    }
  > {
    this.payloadTypes[key] = payload;
    this.responseTypes[key] = response;
    this.streamKeys.push(key);
    this.streamModes[key] = "object";
    return this as any;
  }
  streamArray<K extends string, P extends TSchema, R extends TSchema>(
    key: K,
    payload: P,
    response: R,
  ): Contract<
    FetchableContract,
    StreamableContract & {
      [key in K]: {
        payload: Static<P>;
        response: Static<R>;
        streamMode: "array";
      };
    }
  > {
    this.payloadTypes[key] = payload;
    this.responseTypes[key] = response;
    this.streamKeys.push(key);
    this.streamModes[key] = "array";
    return this as any;
  }
  streamText<K extends string, P extends TSchema>(
    key: K,
    payload: P,
  ): Contract<
    FetchableContract,
    StreamableContract & {
      [key in K]: {
        payload: Static<P>;
        response: string;
        streamMode: "text";
      };
    }
  > {
    this.payloadTypes[key] = payload;
    this.responseTypes[key] = t.String();
    this.streamKeys.push(key);
    this.streamModes[key] = "text";
    return this as any;
  }
  getPayLoadType(key: string) {
    return this.payloadTypes[key];
  }
  getResponseType(key: string) {
    return this.responseTypes[key];
  }
  getKeys() {
    return { fetchKeys: this.fetchKeys, streamKeys: this.streamKeys };
  }
}

export class ContractGroup<Contracts, Groups> {
  contracts: {
    [key in string]: Contract<any, any>;
  } = {} as any;
  subGroups: {
    [key in string]: ContractGroup<any, any>;
  } = {} as any;
  static contract<K extends string, F extends EndpointMap, S extends EndpointMap>(
    key: K,
    contract: Contract<F, S>,
  ): ContractGroup<{ [key in K]: Contract<F, S> }, ContractGroupMap> {
    return new ContractGroup().contract(key, contract) as any;
  }
  static group<K extends string, C extends ContractMap, G extends ContractGroupMap>(
    key: K,
    group: ContractGroup<C, G>,
  ): ContractGroup<ContractMap, { [key in K]: ContractGroup<C, G> }> {
    return new ContractGroup().group(key, group) as any;
  }
  constructor(public name?: string) {}
  contract<K extends string, F extends EndpointMap, S extends EndpointMap>(
    key: K,
    contract: Contract<F, S>,
  ): ContractGroup<Contracts & { [key in K]: Contract<F, S> }, Groups> {
    this.contracts[key] = contract;
    return this as any;
  }
  getContract<K extends keyof Contracts>(key: K & string): Contracts[K] {
    return this.contracts[key] as any;
  }

  group<K extends string, C, G>(
    key: K,
    group: ContractGroup<C, G>,
  ): ContractGroup<Contracts, Groups & { [key in K]: ContractGroup<C, G> }> {
    this.subGroups[key] = group;
    return this as any;
  }
  getGroup<K extends keyof Groups>(key: K & string): Groups[K] {
    return this.subGroups[key] as any;
  }
  get<K extends keyof Contracts | keyof Groups>(
    key: K & string,
  ): K extends keyof Contracts ? Contracts[K] : K extends keyof Groups ? Groups[K] : never {
    return (this.contracts[key] || this.subGroups[key]) as any;
  }
}

export class Implementation<FetchableContract extends EndpointMap, StreamableContract extends EndpointMap, Context> {
  fetchableHandlers: {
    [key in string]: (
      c: Context,
      payload: EndpointPayload<FetchableContract, key>,
    ) => MaybePromise<EndpointResponse<FetchableContract, key>>;
  } = {};
  // TODO: DRY
  streamableHandlers: {
    [K in string]: (
      c: Context,
      payload: EndpointPayload<StreamableContract, K>,
      emitter: StreamableContract[K]["streamMode"] extends "text"
        ? TypedEventEmitter<TextStreamEvents>
        : StreamableContract[K]["streamMode"] extends "array"
          ? TypedEventEmitter<ArrayStreamEvent<StreamableContract[K]["response"]>>
          : TypedEventEmitter<StreamEvents<StreamableContract[K]["response"]>>,
      streamKey?: string,
    ) => void;
  } = {};
  streamIdGenerators: {
    [K in string]: (c: Context, payload: EndpointPayload<StreamableContract, K>) => MaybePromise<string>;
  } = {};
  private constructor(public contract: Contract<FetchableContract, any>) {}
  static create<C>(): <F extends EndpointMap, T extends EndpointMap>(
    contract: Contract<F, T>,
  ) => Implementation<F, T, C> {
    return (contract: Contract<any, any>) => new Implementation(contract);
  }
  stream<K extends EndpointMapKey<StreamableContract>>(
    key: K,
    handler: (
      c: Context,
      payload: EndpointPayload<StreamableContract, K>,
      emitter: StreamableContract[K]["streamMode"] extends "text"
        ? TypedEventEmitter<TextStreamEvents>
        : StreamableContract[K]["streamMode"] extends "array"
          ? TypedEventEmitter<ArrayStreamEvent<StreamableContract[K]["response"]>>
          : TypedEventEmitter<StreamEvents<StreamableContract[K]["response"]>>,
      streamId?: string,
    ) => void,
    idGenerator?: (c: Context, payload: EndpointPayload<StreamableContract, K>) => MaybePromise<string>,
  ) {
    const wrappedHandler: typeof handler = (c: Context, payload, emitter, streamId) => {
      const payloadType = this.contract.getPayLoadType(key);
      if (!payloadType) {
        throw new Error("Payload type not found for key " + key);
      }

      Promise.resolve(handler(c, payload, emitter, streamId)).catch((e) => {
        console.error(e);
        (emitter as any).emit("onError", e.message || "Unknown error");
      });
    };
    this.streamableHandlers[key] = wrappedHandler;
    if (idGenerator) {
      this.streamIdGenerators[key] = idGenerator;
    }
    return this;
  }
  fetch<K extends EndpointMapKey<FetchableContract>>(
    key: K,
    handler: undefined extends EndpointPayload<FetchableContract, K>
      ? (c: Context) => MaybePromise<EndpointResponse<FetchableContract, K>>
      : (
          c: Context,
          payload: EndpointPayload<FetchableContract, K>,
        ) => MaybePromise<EndpointResponse<FetchableContract, K>>,
  ) {
    this.fetchableHandlers[key] = async (c: Context, payload: EndpointPayload<FetchableContract, K>) => {
      const payloadType = this.contract.getPayLoadType(key);
      if (!payloadType) {
        throw new Error("Payload type not found for key " + key);
      }
      if (payloadType.type !== "undefined") {
        const valid = Value.Check(payloadType, payload);
        if (!valid) {
          throw new Error("Invalid payload for key " + key);
        }
      }
      const result = await handler(c, payload);
      const responseType = this.contract.getResponseType(key);
      if (!responseType) {
        throw new Error("Response type not found for key " + key);
      }
      const validResponse = Value.Check(responseType, result);
      if (!validResponse) {
        throw new Error("Invalid response for key " + key);
      }
      return result;
    };
    return this;
  }
  handleFetch(key: string) {
    if (!this.fetchableHandlers[key]) {
      throw new Error("Operation not supported: " + key);
    }
    return this.fetchableHandlers[key];
  }
  handleStream(key: string) {
    if (!this.streamableHandlers[key]) {
      throw new Error("Operation not supported: " + key);
    }
    return this.streamableHandlers[key];
  }
  getStatus() {
    const { fetchKeys, streamKeys } = this.contract.getKeys();
    const fetchables: { [key in string]: any } = {};
    const streamables: { [key in string]: any } = {};
    fetchKeys.forEach((key) => {
      fetchables[key] = {
        info: {
          payloadType: this.contract.getPayLoadType(key),
          responseType: this.contract.getResponseType(key),
        },
        supported: !!this.fetchableHandlers[key],
      };
    });
    streamKeys.forEach((key) => {
      streamables[key] = {
        info: {
          payloadType: this.contract.getPayLoadType(key),
          responseType: this.contract.getResponseType(key),
          streamMode: this.contract.streamModes[key],
        },
        supported: !!this.streamableHandlers[key],
      };
    });
    return {
      contractName: this.contract.name,
      fetch: fetchables,
      stream: streamables,
    };
  }
}

type extractContractGeneric<T> =
  T extends Contract<infer F, infer S>
    ? [F extends EndpointMap ? F : EndpointMap, S extends EndpointMap ? S : EndpointMap]
    : never;
type extractGroupContractGeneric<T> =
  T extends ContractGroup<infer C, infer G>
    ? [C extends ContractMap ? C : ContractMap, G extends ContractGroupMap ? G : ContractGroupMap]
    : never;
// type ImplementationType<C> =
//   C extends Contract<infer F, infer S>
//     ? Implementation<F extends EndpointMap ? F : EndpointMap, S extends EndpointMap ? S : EndpointMap, any>
//     : never;
// type GroupImplementationType<C> =
//   C extends ContractGroup<infer C, infer G>
//     ? GroupImplementation<
//         C extends ContractMap ? C : ContractMap,
//         G extends ContractGroupMap ? G : ContractGroupMap,
//         any
//       >
//     : never;

export class GroupImplementation<
  Contracts extends ContractMap | unknown,
  Groups extends ContractGroupMap | unknown,
  Context,
> {
  constructor(public groupContract: ContractGroup<Contracts, Groups>) {}
  implementations: {
    [key in string]: Implementation<any, any, Context>;
  } = {} as any;
  groupImplementations: {
    [key in string]: GroupImplementation<any, any, Context>;
  } = {} as any;
  static create<C>(): <Contracts extends ContractMap | unknown, Groups extends ContractGroupMap | unknown>(
    group: ContractGroup<Contracts, Groups>,
  ) => GroupImplementation<Contracts, Groups, C> /*  & {
    [key in keyof Contracts]: ImplementationType<Contracts[key]>;
  } & {
    [key in keyof Groups]: GroupImplementationType<Groups[key]>;
  } */ {
    return (group: ContractGroup<any, any>) => {
      const impl = new GroupImplementation(group);
      // for (const key in group.contracts) {
      //   Object.defineProperty(impl, key, {
      //     get() {
      //       return impl.contract(key);
      //     },
      //   });
      // }
      // for (const key in group.subGroups) {
      //   Object.defineProperty(impl, key, {
      //     get() {
      //       return impl.group(key);
      //     },
      //   });
      // }
      return impl as any;
    };
  }
  contract<K extends keyof Contracts, FS extends extractContractGeneric<Contracts[K]>>(
    key: K & string,
    impl?: Implementation<FS[0], FS[1], Context>,
  ): FS extends never ? never : Implementation<FS[0], FS[1], Context> {
    if (this.implementations[key] && !impl) {
      return this.implementations[key] as any;
    }
    if (!impl) {
      const contract = this.groupContract.getContract(key) as any;
      impl = Implementation.create<Context>()(contract);
    }
    this.implementations[key] = impl;
    return impl as any;
  }
  group<K extends keyof Groups, CG extends extractGroupContractGeneric<Groups[K]>>(
    key: K & string,
    impl?: GroupImplementation<CG[0], CG[1], Context>,
  ): GroupImplementation<CG[0], CG[1], Context> {
    if (this.groupImplementations[key] && !impl) {
      return this.groupImplementations[key] as any;
    }
    if (!impl) {
      const group = this.groupContract.getGroup(key) as any;
      impl = GroupImplementation.create<Context>()(group);
    }
    this.groupImplementations[key] = impl;
    return impl as any;
  }
  getStatus() {
    return {};
  }
}

type FetchInputType<T> = undefined extends T ? [] : [payload: T];

export interface ClientHandler {
  fetch(key: string, payload: unknown): Promise<unknown>;
  stream(key: string, payload: unknown): Stream<TextStreamEvents | StreamEvents<any> | ArrayStreamEvent<any>>;
  resumeStream(streamId: string): Stream<StreamEvents<any>>;
  retryStream(streamId: string): Promise<void>;
}

/** @deprecated */
export class Client<FetchableContract extends EndpointMap, StreamableContract extends EndpointMap> {
  private constructor(
    private contract: Contract<FetchableContract, StreamableContract>,
    private handler: ClientHandler,
  ) {}
  static create<F extends EndpointMap, T extends EndpointMap>(
    contract: Contract<F, T>,
    handler: ClientHandler,
  ): Client<F, T> {
    return new Client(contract, handler);
  }
  public get fetchables(): {
    [K in EndpointMapKey<FetchableContract>]: (
      ...payload: FetchInputType<EndpointPayload<FetchableContract, K>>
    ) => Promise<EndpointResponse<FetchableContract, K>>;
  } {
    const fetchable: any = {};
    this.contract.fetchKeys.forEach((key) => {
      fetchable[key] = async (...payload: any) => {
        return this.fetch(key, ...payload);
      };
    });
    return fetchable;
  }
  public get streamables(): {
    [K in EndpointMapKey<StreamableContract>]: (
      ...payload: FetchInputType<EndpointPayload<StreamableContract, K>>
    ) => StreamableContract[K]["streamMode"] extends "text"
      ? Stream<TextStreamEvents>
      : StreamableContract[K]["streamMode"] extends "array"
        ? Stream<ArrayStreamEvent<StreamableContract[K]["response"]>>
        : Stream<StreamEvents<StreamableContract[K]["response"]>>;
  } {
    const streamable: any = {};
    this.contract.streamKeys.forEach((key) => {
      streamable[key] = (...payload: any) => {
        return this.stream(key, ...payload);
      };
    });
    return streamable;
  }
  async fetch<K extends EndpointMapKey<FetchableContract>>(
    key: K,
    ...payloadArgs: FetchInputType<EndpointPayload<FetchableContract, K>>
  ): Promise<EndpointResponse<FetchableContract, K>> {
    const payload = payloadArgs[0];
    const payloadType = this.contract.getPayLoadType(key);
    if (!payloadType) {
      throw new Error("Payload type not found for key " + key);
    }
    const valid = Value.Check(payloadType, payload);
    if (!valid) {
      throw new Error("Invalid payload for key " + key);
    }
    const response = await this.handler.fetch(key, payload);
    const responseType = this.contract.getResponseType(key);
    if (!responseType) {
      throw new Error("Response type not found for key " + key);
    }
    const validResponse = Value.Check(responseType, response);
    if (!validResponse) {
      throw new Error("Invalid response for key " + key);
    }
    return response as EndpointResponse<FetchableContract, K>;
  }
  stream<K extends EndpointMapKey<StreamableContract>>(
    key: K,
    ...rest: FetchInputType<EndpointPayload<StreamableContract, K>>
  ) {
    const payload = rest.length === 1 ? rest[0] : undefined;
    const payloadType = this.contract.getPayLoadType(key);
    if (!payloadType) {
      throw new Error("Payload type not found for key " + key);
    }
    const valid = Value.Check(payloadType, payload);
    if (!valid) {
      throw new Error("Invalid payload for key " + key);
    }
    return this.handler.stream(key, payload) as unknown as StreamableContract[K]["streamMode"] extends "text"
      ? Stream<TextStreamEvents>
      : StreamableContract[K]["streamMode"] extends "array"
        ? Stream<ArrayStreamEvent<StreamableContract[K]["response"]>>
        : Stream<StreamEvents<StreamableContract[K]["response"]>>;
  }
}

export const createClient = <F extends EndpointMap, T extends EndpointMap>(
  contract: Contract<F, T>,
  handler: ClientHandler,
): {
  [K in keyof F]: (...payload: FetchInputType<F[K]["payload"]>) => Promise<F[K]["response"]>;
} & {
  [K in keyof T]: (
    ...payload: FetchInputType<T[K]["payload"]>
  ) => T[K]["streamMode"] extends "text"
    ? Stream<TextStreamEvents>
    : T[K]["streamMode"] extends "array"
      ? Stream<ArrayStreamEvent<T[K]["response"]>>
      : Stream<StreamEvents<T[K]["response"]>>;
} & {
  resumeStream: <K extends keyof T>(key: K, streamId: string) => Stream<StreamEvents<T[K]["response"]>>;
  retryStream: (streamId: string) => Promise<void>;
} => {
  const obj: any = {};
  for (const key of contract.fetchKeys) {
    obj[key] = (payload: any) => {
      return handler.fetch(key, payload);
    };
  }
  for (const key of contract.streamKeys) {
    obj[key] = (payload: any) => {
      return handler.stream(key, payload);
    };
  }
  obj.resumeStream = (_key: keyof T, streamId: string) => {
    return handler.resumeStream(streamId);
  };
  obj.retryStream = (streamId: string) => {
    return handler.retryStream(streamId);
  };
  return obj;
};

export type StreamInputType<T extends EndpointMap, K extends keyof T> = undefined extends T[K]["payload"]
  ? [
      emitter: T[K]["streamMode"] extends "text"
        ? TypedEventEmitter<TextStreamEvents>
        : T[K]["streamMode"] extends "array"
          ? TypedEventEmitter<ArrayStreamEvent<T[K]["response"]>>
          : TypedEventEmitter<StreamEvents<T[K]["response"]>>,
    ]
  : [
      payload: T[K]["payload"],
      emitter: T[K]["streamMode"] extends "text"
        ? TypedEventEmitter<TextStreamEvents>
        : T[K]["streamMode"] extends "array"
          ? TypedEventEmitter<ArrayStreamEvent<T[K]["response"]>>
          : TypedEventEmitter<StreamEvents<T[K]["response"]>>,
    ];

export const createImplementation = <Context>() => {
  return <F extends EndpointMap, S extends EndpointMap>(
    contract: Contract<F, S>,
    _handler: {
      [K in keyof F]: (c: Context, payload: FetchInputType<F[K]["payload"]>) => Promise<F[K]["response"]>;
    } & {
      [K in keyof S]: (c: Context, payload: StreamInputType<S, K>) => void;
    },
  ): Implementation<F, S, Context> => {
    const impl = Implementation.create<Context>()(contract);
    for (const key of contract.fetchKeys) {
      const handler = async (c: any, payload: any) => {
        const handler = _handler[key];
        if (!handler) {
          throw new Error("Handler not found for key " + key);
        }
        return handler(c, payload as any) as any;
      };
      impl.fetch(key, handler as any);
    }
    for (const key of contract.streamKeys) {
      const handler = async (c: any, payload: any) => {
        const handler = _handler[key];
        if (!handler) {
          throw new Error("Handler not found for key " + key);
        }
        handler(c, payload as any);
      };
      impl.stream(key, handler as any);
    }
    return impl;
  };
};
