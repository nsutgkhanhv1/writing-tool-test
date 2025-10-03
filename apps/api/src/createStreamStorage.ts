import { ServerContext } from "./context.types";
import { contextTransform } from "./contextTransform";
import { D1KV } from "./db/kv";
import { StreamStorage } from "./lib/types";

export const createStreamStorage = (c: ServerContext): StreamStorage => {
  const implContext = contextTransform(c);
  const d1kv = new D1KV(implContext.db as any);
  return {
    async setObjectId(streamId, objectId) {
      await d1kv.put(`object-for-stream-${streamId}`, objectId);
      await d1kv.put(`stream-for-object-${objectId}`, streamId);
    },
    async getObjectId(streamId) {
      return d1kv.get(`object-for-stream-${streamId}`);
    },
    async getStreamId(objectId) {
      return d1kv.get(`stream-for-object-${objectId}`);
    },
    async markAsStarted(objectId) {
      const inserted = await d1kv.insert(
        `object-started-${objectId}`,
        "started"
      );
      return inserted;
    },
    async saveRequest(streamId, request) {
      await d1kv.put(`request-${streamId}`, request);
    },
    async getRequest(streamId) {
      const request = await d1kv.get(`request-${streamId}`);
      if (!request) {
        return null;
      }
      return request;
    },
    async saveResult(streamId, result) {
      await d1kv.put(`result-${streamId}`, result);
    },
    async getResult(streamId) {
      const result = await d1kv.get(`result-${streamId}`);
      if (!result) {
        return null;
      }
      return result;
    },
    async clearResult(streamId) {
      await d1kv.delete(`result-${streamId}`);
    },
  };
};
