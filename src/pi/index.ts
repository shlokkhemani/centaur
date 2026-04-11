/**
 * Centaur — Pi extension adapter
 *
 * Registers browser-based UI primitives as pi tools.
 * The core (HTML builders + transport) is shared with the MCP adapter.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// @ts-ignore -- JS module import
import { toolDefinitions } from "../tools/manifest.js";
import { buildErrorPayload, buildSuccessPayload, getErrorMessage } from "./payloads.ts";
import { renderers } from "./renderers.ts";
import { buildPiParameters } from "./schema.js";

export default function centaur(pi: ExtensionAPI) {
  for (const tool of toolDefinitions) {
    const renderer = renderers[tool.name];

    pi.registerTool({
      name: tool.name,
      label: tool.label,
      description: tool.description,
      parameters: buildPiParameters(tool.input),

      async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
        try {
          if (tool.validateInput) {
            tool.validateInput(params);
          }

          const result = await tool.run(params);
          return buildSuccessPayload(tool, result);
        } catch (err) {
          return buildErrorPayload(tool, getErrorMessage(err));
        }
      },

      renderCall(args: any, theme: any) {
        return renderer.renderCall(args, theme);
      },

      renderResult(result: any, _options: any, theme: any) {
        return renderer.renderResult(result, theme);
      },
    });
  }
}
