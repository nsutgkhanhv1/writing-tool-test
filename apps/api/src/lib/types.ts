export type StreamRequest = {
  key: string;
  payload: any;
  streamId?: string;
};

export type StreamStorage = {
  setObjectId(streamId: string, objectId: string): Promise<void>;
  getObjectId(streamId: string): Promise<string | null>;
  getStreamId(objectId: string): Promise<string | null>;

  markAsStarted(objectId: string): Promise<boolean>;
  saveRequest(streamId: string, request: StreamRequest): Promise<void>;
  getRequest(streamId: string): Promise<StreamRequest | null>;

  saveResult(streamId: string, result: any): Promise<void>;
  getResult(streamId: string): Promise<any | null>;
  clearResult(streamId: string): Promise<void>;
};
