/**
 * Restore points: every agent reply that changed the carousel carries the id
 * of a snapshot of the deck as it was right after that reply (versionId).
 * Shared by the studio (restore buttons, typed "undo") and the edit pipeline.
 */

/** A bare "undo" / "revert" / "go back" message. */
export const UNDO_RE = /^\s*(please\s+)?(undo|revert|roll ?back|go back|put it back)(\s+(that|it|this|the (last )?(change|edit)|my (last )?(change|edit)|last (change|edit)))?(\s+please)?\s*[.!]*\s*$/i;

export interface PointLike {
    id: string;
    role: string;
    versionId?: string;
}

/** Replies that have a restore point, in order. */
export const restorePoints = <T extends PointLike>(messages: T[]): T[] =>
    messages.filter((m) => m.role === 'assistant' && !!m.versionId);

/**
 * The restore point "undo" goes back to: the point just before the current
 * state first appeared. `currentId` is the reply the deck is at (the latest
 * restore point if unset). Walking back this way never "redoes": after an
 * undo, the next undo goes further back, not forward.
 */
export const previousPoint = <T extends PointLike>(messages: T[], currentId?: string | null): T | null => {
    const upTo = currentId ? messages.findIndex((m) => m.id === currentId) : -1;
    const points = restorePoints(upTo >= 0 ? messages.slice(0, upTo + 1) : messages);
    if (!points.length) return null;
    const current = points[points.length - 1];
    const first = points.findIndex((p) => p.versionId === current.versionId);
    return first > 0 ? points[first - 1] : null;
};
