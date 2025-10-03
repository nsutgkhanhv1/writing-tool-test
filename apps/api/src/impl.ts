import { WritingToolContract } from "@repo/common";
import { Implementation } from "@repo/contract";
import { ImplementationContext } from "./context.types";

export const impl = Implementation.create<ImplementationContext>()(WritingToolContract);
