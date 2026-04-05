import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

function buildTypeBoxSchema(definition) {
  let schema;

  switch (definition.kind) {
    case "string":
      schema = Type.String(definition.description ? { description: definition.description } : {});
      break;
    case "boolean":
      schema = Type.Boolean(definition.description ? { description: definition.description } : {});
      break;
    case "enum":
      schema = StringEnum(
        /** @type {[string, ...string[]]} */ (definition.values),
        definition.description ? { description: definition.description } : {}
      );
      break;
    case "array": {
      const options = {};
      if (definition.description) options.description = definition.description;
      if (definition.minItems != null) options.minItems = definition.minItems;
      schema = Type.Array(buildTypeBoxSchema(definition.items), options);
      break;
    }
    case "object": {
      const fields = {};
      for (const [key, value] of Object.entries(definition.fields)) {
        fields[key] = buildTypeBoxSchema(value);
      }
      schema = Type.Object(fields);
      break;
    }
    default:
      throw new Error(`Unsupported schema kind: ${definition.kind}`);
  }

  if (definition.optional) {
    return Type.Optional(schema);
  }

  return schema;
}

export function buildPiParameters(definition) {
  if (definition.kind !== "object") {
    throw new Error("Top-level Pi schema must be an object");
  }

  return buildTypeBoxSchema(definition);
}
