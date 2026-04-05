import { z } from "zod";

function applyCommon(schema, definition) {
  let next = schema;

  if (definition.description) {
    next = next.describe(definition.description);
  }

  if (definition.minItems != null && "min" in next) {
    next = next.min(definition.minItems);
  }

  if (definition.optional) {
    next = next.optional();
  }

  if (definition.default !== undefined) {
    next = next.default(definition.default);
  }

  return next;
}

function buildZodSchema(definition) {
  switch (definition.kind) {
    case "string":
      return applyCommon(z.string(), definition);
    case "boolean":
      return applyCommon(z.boolean(), definition);
    case "enum":
      return applyCommon(z.enum(definition.values), definition);
    case "array":
      return applyCommon(z.array(buildZodSchema(definition.items)), definition);
    case "object": {
      const shape = {};
      for (const [key, value] of Object.entries(definition.fields)) {
        shape[key] = buildZodSchema(value);
      }
      return applyCommon(z.object(shape), definition);
    }
    default:
      throw new Error(`Unsupported schema kind: ${definition.kind}`);
  }
}

export function buildMcpInputSchema(definition) {
  if (definition.kind !== "object") {
    throw new Error("Top-level MCP schema must be an object");
  }

  const shape = {};
  for (const [key, value] of Object.entries(definition.fields)) {
    shape[key] = buildZodSchema(value);
  }
  return shape;
}
