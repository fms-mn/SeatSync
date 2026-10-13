import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Workspace scripts run with apps/api as their working directory, while secrets
// intentionally live in the repository root. Resolve from this file so both the
// source and compiled server load the same untracked root .env file.
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config({ path: resolve(repositoryRoot, '.env') });
