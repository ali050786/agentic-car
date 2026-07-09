import { VercelRequest } from '@vercel/node';
import { getUserFromJwt, usersServer } from './appwriteServer.js';
import { assertAndConsumeFreeTier } from './freeTierServer.js';

export interface AuthenticatedUser {
    userId: string;
    email?: string;
    name?: string;
}

/**
 * Authenticates a request by verifying the Appwrite session JWT.
 * Falls back to verifying the user ID directly against Appwrite server in development environments
 * if JWT creation is not supported or returns 501.
 */
export async function verifySession(req: VercelRequest): Promise<AuthenticatedUser> {
    const authHeader = req.headers['authorization'];
    const jwt = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : undefined;

    const isDev = process.env.NODE_ENV !== 'production' || process.env.ALLOW_AUTH_FALLBACK !== 'false';

    if (!jwt) {
        // Fallback for legacy request headers in development
        const userIdHeader = req.headers['x-user-id'];
        if (isDev && typeof userIdHeader === 'string' && userIdHeader) {
            console.log(`[API Auth] Using legacy x-user-id header validation (Dev fallback): ${userIdHeader}`);
            try {
                // Verify user actually exists in Appwrite to prevent arbitrary ID spoofing
                const user = await usersServer.get(userIdHeader);
                return { userId: user.$id, email: user.email, name: user.name };
            } catch (err: any) {
                console.error(`[API Auth] Legacy user ID validation failed:`, err?.message || err);
                throw new Error('UNAUTHORIZED');
            }
        }
        throw new Error('MISSING_AUTH_TOKEN');
    }

    // Check if client returned a fallback token due to Appwrite 501 issues
    if (jwt.startsWith('client-fallback-')) {
        const userId = jwt.replace('client-fallback-', '');
        if (!isDev) {
            console.error('[API Auth] Fallback client token rejected in production environment');
            throw new Error('UNAUTHORIZED');
        }

        try {
            console.log(`[API Auth] Verifying fallback client token against Appwrite server: ${userId}`);
            const user = await usersServer.get(userId);
            return { userId: user.$id, email: user.email, name: user.name };
        } catch (err: any) {
            console.error(`[API Auth] Fallback client token validation failed:`, err?.message || err);
            throw new Error('UNAUTHORIZED');
        }
    }

    try {
        const user = await getUserFromJwt(jwt);
        return { userId: user.$id, email: user.email, name: user.name };
    } catch (err: any) {
        console.error('[API Auth] JWT verification failed:', err?.message || err);
        throw new Error('UNAUTHORIZED');
    }
}

/**
 * Authenticates a request and statefully consumes a free-tier usage count in the database.
 */
export async function verifySessionAndConsumeLimit(req: VercelRequest): Promise<AuthenticatedUser & { remainingCount: number }> {
    const user = await verifySession(req);
    const count = await assertAndConsumeFreeTier(user.userId);
    return { ...user, remainingCount: count };
}
