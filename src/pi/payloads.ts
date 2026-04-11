export function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export function buildSuccessPayload(tool: any, result: any) {
  if (tool.resultKind === "pdfPath") {
    return {
      content: [{ type: "text" as const, text: `PDF generated: ${result}` }],
      details: { path: result },
    };
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    details: result,
  };
}

export function buildErrorPayload(tool: any, message: string) {
  const payload: {
    content: Array<{ type: "text"; text: string }>;
    details: { error: string };
    isError?: boolean;
  } = {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    details: { error: message },
  };

  if (tool.piMarksError) {
    payload.isError = true;
  }

  return payload;
}
