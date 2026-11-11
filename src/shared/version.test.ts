import { describe, expect, it } from 'vitest';
import { extensionVersion } from './version';

describe('extension scaffold', () => {
  it('defines a semantic extension version', () => {
    expect(extensionVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
