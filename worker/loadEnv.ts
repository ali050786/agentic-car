import path from 'path';
import dotenv from 'dotenv';

// Load environment variables: .env.local first (local overrides), falling back to .env
// Done in a separate file so it can be imported statically at the very top of worker/index.ts
// to avoid ESM import hoisting race conditions.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
