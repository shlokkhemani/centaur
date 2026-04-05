import { ReviewSession } from "./transport/server.js";

const sessions = new Map();

export async function createReviewSession(config) {
  const session = new ReviewSession({
    ...config,
    onClose(closedSession) {
      sessions.delete(closedSession.id);
      config.onClose?.(closedSession);
    },
  });

  sessions.set(session.id, session);
  await session.start();
  return session;
}

export function getReviewSession(sessionId) {
  return sessions.get(sessionId) || null;
}
