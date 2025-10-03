import { TSchema } from "@sinclair/typebox";

const defaultTask = `
Output a json object or array fitting the schema in the following <jsonSchema> tag.
Code only, no commentary, no introduction sentence, no codefence block.
Do not output triple backticks with or without json language name. Start with the content of the json object or array directly.
Do not include any reasoning in the response.
`;

const errorTask = `
If you are not sure or cannot generate something for any possible reason, return:
{"error" : <the reason of the error>}
`;

export const generateJsonOutputGuardrail = (schema: TSchema, withError = true): string => {
  const jsonSchema = JSON.stringify(schema);

  return `${withError ? `\n\n${errorTask}` : ""}\n\n${defaultTask}\n\n<jsonSchema>${jsonSchema}</jsonSchema>`;
};
