// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Manifest {
  manifest_version: number;
  description: string;
  permissions: string[];
  host_permissions: string[];
  optional_host_permissions: string[];
}

const manifest = JSON.parse(
  readFileSync(new URL('../../public/manifest.json', import.meta.url), 'utf8'),
) as Manifest;

describe('extension manifest', () => {
  it('describes the real scope: Etsy (editor page and manual input) and Amazon (manual input)', () => {
    expect(manifest.description).toContain('Etsy');
    expect(manifest.description).toContain('Amazon (nhập tay)');
    expect(manifest.description.length).toBeLessThanOrEqual(132); // Chrome Web Store limit
  });

  it('keeps install-time access to the Etsy listing editor only and requests no broad permission', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.host_permissions).toEqual(['https://www.etsy.com/your/shops/me/tools/listings/*']);
    const all = [...manifest.permissions, ...manifest.host_permissions, ...manifest.optional_host_permissions];
    for (const forbidden of ['tabs', '<all_urls>', 'history', 'cookies']) expect(all).not.toContain(forbidden);
  });
});
