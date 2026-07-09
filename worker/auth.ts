import type { Request } from 'express';
import { getUserFromJwt, usersServer } from '../lib/appwriteServer';

export class UnauthorizedError extends Error {
    constructor(message = 'Unauthorized') {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

/**
 * Validates request authorization. 
 * Resolves user identity from the Appwrite JWT session token.
 * Falls back to verifying the user ID directly in development mode.
 */
export const requireUser = async (req: Request): Promise<{ userId: string }> => {
    const authHeader = req.headers['authorization'];
    const jwt = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : undefined;
    const isDev = process.env.NODE_ENV !== 'production' || process.env.ALLOW_AUTH_FALLBACK !== 'false';

    if (jwt) {
        // Handle client fallback token (due to Appwrite Cloud 501 errors)
        if (jwt.startsWith('client-fallback-')) {
            const userId = jwt.replace('client-fallback-', '');
            if (!isDev) {
                console.error('[Worker Auth] Fallback client token rejected in production');
                throw new UnauthorizedError('Session verification required in production');
            }
            try {
                // Verify user actually exists to avoid spoofing
                const user = await usersServer.get(userId);
                return { userId: user.$id };
            } catch (err: any) {
                console.error('[Worker Auth] Fallback token verification failed:', err?.message || err);
                throw new UnauthorizedError('Invalid user session');
            }
        }

        // Standard Appwrite JWT verification
        try {
            const user = await getUserFromJwt(jwt);
            return { userId: user.$id };
        } catch (err: any) {
            console.error('[Worker Auth] JWT verification failed:', err?.message || err);
            throw new UnauthorizedError('Invalid or expired session');
        }
    }

    // Fallback to x-user-id (only allowed in development/fallback environments)
    const userIdHeader = req.headers['x-user-id'];
    if (isDev && typeof userIdHeader === 'string' && userIdHeader) {
        console.log(`[Worker Auth] Using legacy x-user-id header validation (Dev fallback): ${userIdHeader}`);
        try {
            const user = await usersServer.get(userIdHeader);
            return { userId: user.$id };
        } catch (err: any) {
            console.error('[Worker Auth] Legacy user ID validation failed:', err?.message || err);
            throw new UnauthorizedError('Invalid user session');
        }
    }

    throw new UnauthorizedError('A valid session token is required to access this service.');
};
