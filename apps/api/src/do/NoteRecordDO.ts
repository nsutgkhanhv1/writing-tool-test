import { ServerContext } from "../context.types";
import { contextTransform } from "../contextTransform";
import { createStreamStorage } from "../createStreamStorage";
import { impl } from "../impl";
import { ContractDO } from "../lib/ContractDO";

export class NoteRecordDO extends ContractDO<ServerContext> {
  constructor(ctx: DurableObjectState, env: ServerContext) {
    super(ctx, env);
    this.setImplementation(impl);
    this.setContextTransform(contextTransform);
    this.setStreamStorage(createStreamStorage(env));
  }
}
