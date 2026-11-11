import { describe, expect, it } from 'vitest';
import { sanitizeFixtureHtml } from './fixture-sanitizer';

describe('fixture sanitizer', () => {
  it('removes secrets and personal data while retaining useful markup and identifiers', () => {
    const fakeEmail = 'seller.fixture@example.com';
    const fakeToken = 'FAKE_API_TOKEN_do_not_export_987654';
    const fakePhone = '+1 (415) 555-0123';
    const result = sanitizeFixtureHtml(`<!doctype html><html><body>
      <!-- session=${fakeToken} -->
      <script>const secret = '${fakeToken}'</script><iframe src="https://example.invalid"></iframe>
      <input type="hidden" id="csrf-field" name="csrfToken" value="${fakeToken}">
      <input id="listing-title" name="title" data-field="title" aria-label="${fakeEmail}" value="My real listing">
      <div id="description" contenteditable="true">My private description</div>
      <p>${fakeEmail} ${fakePhone} token=${fakeToken}</p>
      <picture id="listing-photo"><source srcset="https://images.example.invalid/a.jpg 1x, https://images.example.invalid/b.jpg 2x"><img src="https://i.etsystatic.com/123/il/abcd/etsy.jpg" onerror="steal()"></picture>
    </body></html>`, 'https://www.etsy.com/your/shops/55555/tools/listings/1234567890/edit?listing_id=1234567890&access_token=' + fakeToken);

    expect(result.html).not.toContain(fakeEmail);
    expect(result.html).not.toContain(fakeToken);
    expect(result.html).not.toContain(fakePhone);
    expect(result.html).not.toContain('My real listing');
    expect(result.html).not.toContain('My private description');
    expect(result.html).not.toContain('etsy.jpg');
    expect(result.html).not.toContain('images.example.invalid');
    expect(result.html).not.toContain('<script');
    expect(result.html).not.toContain('<iframe');
    expect(result.html).not.toContain('onerror');
    expect(result.html).toContain('id="listing-title"');
    expect(result.html).toContain('name="title"');
    expect(result.html).toContain('data-field="title"');
    expect(result.html).toContain('aria-label="[email removed]"');
    expect(result.html).not.toContain('value="' + fakeToken + '"');
    expect(result.html).toContain('/shops/*/tools/listings/*/edit?listing_id=*');
    const output = new DOMParser().parseFromString(result.html, 'text/html');
    expect(output.querySelector('input[type="hidden"]')?.hasAttribute('value')).toBe(false);
    expect(output.querySelector('#listing-title')?.getAttribute('value')).toBe('Dữ liệu mẫu');
    expect(output.querySelector('[contenteditable="true"]')?.textContent).toBe('Văn bản mẫu');
  });
});
