import assert from 'node:assert/strict';
import test from 'node:test';
import { emailHtmlToText, sanitizeEmailHtml } from '../src/lib/email-content.mjs';

test('email sanitizer keeps supported formatting and safe links', () => {
  const html = sanitizeEmailHtml('<h2>Welcome</h2><div style="text-align: center; color:red"><strong>Scamtastic</strong> <a href="https://example.com/path">open</a> <a href="mailto:admin@example.com">contact</a></div>');
  assert.match(html, /<h2>Welcome<\/h2>/);
  assert.match(html, /<p style="text-align:center">/);
  assert.match(html, /<strong>Scamtastic<\/strong>/);
  assert.match(html, /href="https:\/\/example\.com\/path"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /href="mailto:admin@example\.com"/);
});

test('email sanitizer escapes unsafe markup, attributes, and links', () => {
  const html = sanitizeEmailHtml('<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)" onclick="x">bad</a>');
  assert.doesNotMatch(html, /<script|<img|onerror|onclick|javascript:/i);
  assert.match(html, /<span>bad<\/span>/);
});

test('plain-text body contains readable formatted content', () => {
  assert.equal(emailHtmlToText('<h2>Hi</h2><p>One &amp; two</p><ul><li>Point</li></ul>'), 'Hi\nOne & two\n• Point');
});
