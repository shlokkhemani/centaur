function safeJson(value) {
  return JSON.stringify(value);
}

export function writeSseEvent(res, event) {
  res.write(`id: ${event.id}\n`);
  res.write(`data: ${safeJson(event.data)}\n\n`);
}
