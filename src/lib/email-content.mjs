const ALLOWED_TAGS = new Set([
  'p', 'div', 'br', 'strong', 'b', 'em', 'i', 'h1', 'h2', 'h3',
  'ul', 'ol', 'li', 'a', 'blockquote',
]);
const VOID_TAGS = new Set(['br']);

function escapeText(value) {
  const decoded = value.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|amp|lt|gt|quot|apos);/gi, (entity, reference) => {
    const normalized = reference.toLowerCase();
    if (normalized === 'amp') return '&';
    if (normalized === 'lt') return '<';
    if (normalized === 'gt') return '>';
    if (normalized === 'quot') return '"';
    if (normalized === 'apos') return "'";
    const codePoint = normalized.startsWith('#x')
      ? Number.parseInt(normalized.slice(2), 16)
      : Number.parseInt(normalized.slice(1), 10);
    return codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff)
      ? String.fromCodePoint(codePoint)
      : entity;
  });
  return decoded
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function textAlignment(attributes) {
  const alignAttribute = attributes.match(
    /\balign\s*=\s*(?:"(left|center|right|justify)"|'(left|center|right|justify)'|(left|center|right|justify)(?:\s|$))/i,
  );
  const styleAttribute = attributes.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const styleAlignment = (styleAttribute?.[1] ?? styleAttribute?.[2] ?? '')
    .split(';')
    .map((declaration) =>
      declaration.match(/^\s*text-align\s*:\s*(left|center|right|justify)\s*$/i)?.[1],
    )
    .filter(Boolean)
    .at(-1);
  return (styleAlignment ?? alignAttribute?.slice(1).find(Boolean))?.toLowerCase();
}

function safeHref(value) {
  const href = value.trim();
  if (href.length > 2048 || /[\u0000-\u0020"'<>]/.test(href)) return null;
  if (/^mailto:/i.test(href)) {
    return /^mailto:[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/i.test(href)
      ? href
      : null;
  }
  try {
    const url = new URL(href);
    if (
      (url.protocol !== 'https:' && url.protocol !== 'http:') ||
      url.username ||
      url.password
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function sanitizeEmailHtml(input) {
  if (typeof input !== 'string') return '';
  const tokens = input.slice(0, 20000).match(/<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/g) ?? [];
  const stack = [];
  let output = '';
  let cursor = 0;

  for (const token of tokens) {
    const index = input.indexOf(token, cursor);
    if (index < 0) continue;
    output += escapeText(input.slice(cursor, index));
    cursor = index + token.length;
    if (token.startsWith('<!--')) continue;
    const match = token.match(/^<\s*(\/?)\s*([A-Za-z][A-Za-z0-9]*)\b([^>]*)>$/);
    if (!match) {
      output += escapeText(token);
      continue;
    }
    const closing = match[1] === '/';
    const tag = match[2].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;
    const outputTag = tag === 'div' ? 'p' : tag;
    if (closing) {
      if (VOID_TAGS.has(outputTag)) continue;
      const lastIndex = stack.lastIndexOf(outputTag);
      if (lastIndex < 0) continue;
      while (stack.length > lastIndex) output += `</${stack.pop()}>`;
      continue;
    }

    if (outputTag === 'a') {
      const hrefMatch = match[3].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = hrefMatch && safeHref(hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3]);
      if (!href) {
        output += '<span>';
        stack.push('span');
        continue;
      }
      output += `<a href="${escapeText(href)}" rel="noopener noreferrer">`;
    } else {
      const alignment =
        outputTag === 'p' || /^h[1-3]$/.test(outputTag)
          ? textAlignment(match[3])
          : null;
      output += `<${outputTag}${alignment ? ` style="text-align:${alignment}"` : ''}>`;
    }
    if (!VOID_TAGS.has(outputTag)) stack.push(outputTag);
  }
  output += escapeText(input.slice(cursor));
  while (stack.length) output += `</${stack.pop()}>`;
  return output;
}

export function emailHtmlToText(input) {
  return sanitizeEmailHtml(input)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|h[1-3]|li|blockquote)>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
