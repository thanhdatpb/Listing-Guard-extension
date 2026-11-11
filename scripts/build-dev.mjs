import { execFileSync } from 'node:child_process';
import { build } from 'vite';

process.env.LISTING_GUARD_DEV = '1';
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { stdio: 'inherit' });
await build({ mode: 'development' });
