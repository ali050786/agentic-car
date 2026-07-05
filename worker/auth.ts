/**
 * The worker's trust boundary.
 *
 * This was originally meant to verify a short-lived Appwrite JWT
 * (`account.createJWT()`) so the worker — not the browser — decides who the
 * caller is. In practice, createJWT() on this Appwrite Cloud project
 * (sgp.cloud.appwrite.io) reliably returns 501 Not Implemented even with a
 * valid session, which appears to be a platform-side issue rather than
 * anything in this app's config (see the investigation task filed alongside
 * this change). Until that's resolved, this falls back to the same
 * client-trusted x-user-id header api/generate.ts already uses — no weaker
 * than the app's existing trust model, just not the intended upgrade.
 * Swap requireUser's body back to JWT verification (see git history / the
 * commented block below) once Appwrite's JWT endpoint is confirmed working.
 */

import type { Request } from 'express';

export class UnauthorizedError extends Error {
    constructor(message = 'Unauthorized') {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

export const requireUser = async (req: Request): Promise<{ userId: string }> => {
    const userId = req.headers['x-user-id'];
    if (typeof userId !== 'string' || !userId) {
        throw new UnauthorizedError('Missing x-user-id header');
    }
    return { userId };
};

// --- JWT-based verification (disabled — see file header) ---
// import { getUserFromJwt } from '../lib/appwriteServer';
// export const requireUser = async (req: Request): Promise<{ userId: string }> => {
//     const authHeader = req.headers['authorization'];
//     const jwt = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : undefined;
//     if (!jwt) throw new UnauthorizedError('Missing Authorization: Bearer <appwrite-jwt> header');
//     try {
//         const user = await getUserFromJwt(jwt);
//         return { userId: user.$id };
//     } catch {
//         throw new UnauthorizedError('Invalid or expired session');
//     }
// };
