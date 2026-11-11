const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const phonePattern = /(?<!\w)\+?\d[\d\s().-]{7,}\d(?!\w)/gu;
const bearerPattern = /\bBearer\s+[A-Z0-9._~+/-]+=*/giu;
const tokenAssignmentPattern = /\b(?:api[_ -]?key|token|secret|authorization|csrf|session)(\s*[:=]\s*)["']?[^\s"'<>;,]+/giu;
const imageUrlPattern = /https?:\/\/[^\s"'<>)]*(?:\.png|\.jpe?g|\.gif|\.webp|\.avif|\.svg)(?:[?#][^\s"'<>)]*)?/giu;

function sanitizeUrlValue(value: string): string {
  return value
    .replace(/(\/(?:listing|listings|shop|shops)\/)(\d+)(?=\/|[?#]|$)/giu, '$1*')
    .replace(/([?&](?:listing|shop)(?:_?id)=)[^&#]*/giu, '$1*')
    .replace(/([?&](?:access[_-]?token|token|api[_-]?key|secret|auth|email|session|csrf)=)[^&#]*/giu, '$1[redacted]')
    .replace(/(https?:\/\/)[^/@\s]+@/giu, '$1[redacted]@');
}

function sanitizeText(value: string): string {
  return sanitizeUrlValue(value)
    .replace(bearerPattern, '[redacted token]')
    .replace(tokenAssignmentPattern, (_match, separator: string) => `[redacted]${separator}`)
    .replace(emailPattern, '[email removed]')
    .replace(phonePattern, '[phone removed]')
    .replace(imageUrlPattern, '[image URL removed]')
    .replace(/\b\d{7,}\b/gu, '*');
}

function isImageUrl(value: string): boolean {
  return /(?:\.png|\.jpe?g|\.gif|\.webp|\.avif|\.svg)(?:[?#]|$)|etsystatic\.com\/.*\/il\//iu.test(value);
}

function replaceEditableText(element: Element): void {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (node.textContent?.trim()) node.textContent = 'Văn bản mẫu';
  }
}

export interface SanitizedFixture {
  html: string;
  sourceUrl: string;
}

export function sanitizeFixtureHtml(html: string, pageUrl: string): SanitizedFixture {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, 'text/html');
  const sourceUrl = sanitizeText(sanitizeUrlValue(pageUrl)).replace(/[\r\n]/gu, '').replace(/--/gu, '-');

  parsed.querySelectorAll('script, iframe, object, embed, noscript').forEach((element) => element.remove());
  for (const element of parsed.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
      } else if (/token|secret|api[_-]?key|authorization|csrf|session/iu.test(name)) {
        element.setAttribute(attribute.name, '[redacted]');
      } else if (name === 'srcset' || (name === 'src' && ['IMG', 'SOURCE'].includes(element.tagName))
        || ((name === 'href' || name.startsWith('data-')) && isImageUrl(attribute.value))) {
        element.removeAttribute(attribute.name);
      } else {
        element.setAttribute(attribute.name, sanitizeText(attribute.value));
      }
    }

    if (element instanceof HTMLInputElement) {
      if (element.type.toLowerCase() === 'hidden') {
        element.removeAttribute('value');
      } else if (!['checkbox', 'radio', 'button', 'submit', 'reset', 'file'].includes(element.type.toLowerCase())) {
        element.setAttribute('value', element.type === 'email' ? 'seller@example.invalid' : 'Dữ liệu mẫu');
      }
    } else if (element instanceof HTMLTextAreaElement) {
      element.textContent = 'Mô tả mẫu';
    }
    if (element.hasAttribute('contenteditable') || element.getAttribute('role') === 'textbox') {
      replaceEditableText(element);
    }
  }

  const textWalker = parsed.createTreeWalker(parsed.body, NodeFilter.SHOW_TEXT);
  while (textWalker.nextNode()) {
    const node = textWalker.currentNode as Text;
    if (node.textContent) node.textContent = sanitizeText(node.textContent);
  }

  const commentWalker = parsed.createTreeWalker(parsed, NodeFilter.SHOW_COMMENT);
  while (commentWalker.nextNode()) {
    const comment = commentWalker.currentNode as Comment;
    comment.data = sanitizeText(comment.data);
  }

  const htmlOutput = `<!doctype html>\n<!-- Source URL: ${sourceUrl} -->\n${parsed.documentElement.outerHTML}`;
  return { html: htmlOutput, sourceUrl };
}
