import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { defineConfig, type Plugin } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const devFixtureCaptureEnabled = process.env.LISTING_GUARD_DEV === '1';

function devManifestPlugin(): Plugin {
  return {
    name: 'listing-guard-dev-manifest',
    apply: 'build',
    async closeBundle() {
      if (!devFixtureCaptureEnabled) return;
      const manifestPath = resolve(projectRoot, 'dist/manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
        permissions: string[];
      };
      manifest.permissions = [...new Set([...manifest.permissions, 'downloads'])];
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    },
  };
}

export default defineConfig({
  define: { __DEV_FIXTURE_CAPTURE__: JSON.stringify(devFixtureCaptureEnabled) },
  plugins: [devManifestPlugin()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(projectRoot, 'src/background/index.ts'),
        content: resolve(projectRoot, 'src/content/index.ts'),
        options: resolve(projectRoot, 'src/options/index.html'),
        sidepanel: resolve(projectRoot, 'src/sidepanel/index.html'),
      },
      output: {
        entryFileNames: 'src/[name].js',
        chunkFileNames: 'src/chunks/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
