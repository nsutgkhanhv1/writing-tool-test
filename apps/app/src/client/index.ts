import { getLocalItem } from "@/utils/LocalStorage";
import { WritingToolContract } from "@repo/common";
import { createClient, createHttpHandler } from "@repo/contract";

export const client = createClient(
  WritingToolContract,
  createHttpHandler(
    import.meta.env.VITE_WORKER_URL || "http://localhost:8787",
    getLocalItem("@writing-tool/userToken") || "",
  ),
);
