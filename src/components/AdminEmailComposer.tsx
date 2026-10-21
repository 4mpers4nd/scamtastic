'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { emailHtmlToText, sanitizeEmailHtml } from '@/lib/email-content.mjs';

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string;
  is_builtin: boolean;
};
type Recipient = { id: string; username: string; email: string };
type Delivery = {
  id: string;
  subject: string;
  recipient_count: number;
  status: string;
  created_at: string;
};
type Resources = { templates: EmailTemplate[]; history: Delivery[]; recipients: Recipient[] };

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, init);
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof data === 'object' && data !== null && 'error' in data &&
        typeof data.error === 'string' ? data.error : 'Email request failed.',
    );
  }
  return data;
}

export default function AdminEmailComposer() {
  const editorRef = useRef<HTMLDivElement>(null);
  const [resources, setResources] = useState<Resources | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [customAddresses, setCustomAddresses] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('<p></p>');
  const [templateId, setTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [preview, setPreview] = useState<'edit' | 'html' | 'text'>('edit');
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const initialEditorHtml = useRef('<p></p>');

  const safeHtml = useMemo(() => sanitizeEmailHtml(html), [html]);
  const plainText = useMemo(() => emailHtmlToText(html), [html]);
  const customEmails = useMemo(() => customAddresses
    .split(/[\n,;]/)
    .map((email) => email.trim())
    .filter(Boolean), [customAddresses]);
  const recipientCount = selectedPlayers.length + customEmails.length;

  async function loadResources(query = '') {
    const data = await request(`/api/admin/email?q=${encodeURIComponent(query)}`);
    setResources(data as Resources);
  }

  useEffect(() => {
    void loadResources().catch((loadError: unknown) =>
      setError(loadError instanceof Error ? loadError.message : 'Unable to load email tools.'),
    );
  }, []);
  useEffect(() => {
    if (preview === 'edit' && editorRef.current) {
      editorRef.current.innerHTML = safeHtml || '<p></p>';
    }
    // Only initialize when entering Edit, not after every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  function updateEditor(value: string) {
    setHtml(value || '<p></p>');
  }

  function command(commandName: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(commandName, false, value);
    if (editorRef.current) updateEditor(editorRef.current.innerHTML);
  }

  function toggleRecipient(id: string) {
    setSelectedPlayers((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id],
    );
    setConfirmation(false);
  }

  async function sendEmail() {
    if (!confirmation) {
      setConfirmation(true);
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request('/api/admin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          subject,
          htmlBody: safeHtml,
          playerIds: selectedPlayers,
          customEmails,
        }),
      });
      setMessage(`Message accepted for ${recipientCount} recipient${recipientCount === 1 ? '' : 's'}.`);
      setConfirmation(false);
      await loadResources(search);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Email delivery failed.');
      setConfirmation(false);
      await loadResources(search).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await request('/api/admin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-template',
          id: templateId || null,
          name: templateName,
          subject,
          htmlBody: safeHtml,
        }),
      }) as { id: string };
      setTemplateId(result.id);
      setMessage('Template saved.');
      await loadResources(search);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save template.');
    } finally {
      setBusy(false);
    }
  }

  function selectTemplate(id: string) {
    const template = resources?.templates.find((candidate) => candidate.id === id);
    if (!template) {
      setTemplateId('');
      setTemplateName('');
      setSubject('');

      initialEditorHtml.current = '<p></p>';
      setHtml('<p></p>');

      if (editorRef.current) {
        editorRef.current.innerHTML = '<p></p>';
      }

      setPreview('edit');
      setConfirmation(false);
      return;
    }
    setTemplateId(template.id);
    setTemplateName(template.is_builtin ? `${template.name} (custom)` : template.name);
    setSubject(template.subject);

    const sanitized = sanitizeEmailHtml(template.html_body) || '<p></p>';

    initialEditorHtml.current = sanitized;
    setHtml(sanitized);

    if (editorRef.current) {
      editorRef.current.innerHTML = sanitized;
    }

    setPreview('edit');
    setConfirmation(false);
  }

  async function searchRecipients(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await loadResources(search.trim());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Recipient search failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!resources && !error) return <p className="muted" role="status">Loading email tools…</p>;

  return (
    <div className="adminEmailComposer">
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="successMessage" role="status">{message}</p>}
      {resources && (
        <>
          <div className="emailComposerGrid">
            <section className="adminPanel emailRecipientPanel">
              <div className="tag">// RECIPIENTS</div>
              <h2>Choose up to 10 recipients</h2>
              <form className="searchForm" onSubmit={searchRecipients}>
                <label className="visuallyHidden" htmlFor="email-recipient-search">Search verified players</label>
                <input id="email-recipient-search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={80} placeholder="Search active username" />
                <button className="button secondary" disabled={busy}>Search</button>
              </form>
              <div className="recipientChoices">
                {resources.recipients.map((recipient) => (
                  <label key={recipient.id}>
                    <input
                      type="checkbox"
                      checked={selectedPlayers.includes(recipient.id)}
                      onChange={() => toggleRecipient(recipient.id)}
                      disabled={!selectedPlayers.includes(recipient.id) && recipientCount >= 10}
                    />
                    <span><strong>@{recipient.username}</strong><small>{recipient.email}</small></span>
                  </label>
                ))}
                {resources.recipients.length === 0 && <p className="muted">No active recipients match.</p>}
              </div>
              <label className="customRecipientField">Custom email addresses
                <textarea
                  value={customAddresses}
                  onChange={(event) => {
                    setCustomAddresses(event.target.value);
                    setConfirmation(false);
                  }}
                  rows={3}
                  placeholder="Separate addresses with commas or new lines"
                />
              </label>
              <p className="micro">Recipients: {recipientCount} / 10. Messages are sent only after confirmation.</p>
            </section>

            <section className="adminPanel emailEditorPanel">
              <div className="tag">// MESSAGE COMPOSER</div>
              <label>Email template
                <select value={templateId} onChange={(event) => selectTemplate(event.target.value)}>
                  <option value="">Start a new message</option>
                  {resources.templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}{template.is_builtin ? ' · built-in' : ''}</option>
                  ))}
                </select>
              </label>
              <label>Subject<input value={subject} onChange={(event) => {
                setSubject(event.target.value);
                setConfirmation(false);
              }} maxLength={200} required /></label>
              <div className="emailEditorToolbar" role="toolbar" aria-label="Email formatting">
                <button type="button" onClick={() => command('bold')} aria-label="Bold"><strong>B</strong></button>
                <button type="button" onClick={() => command('italic')} aria-label="Italic"><em>I</em></button>
                <button type="button" onClick={() => command('formatBlock', 'h2')}>Heading</button>
                <button type="button" onClick={() => command('insertUnorderedList')}>Bullets</button>
                <button type="button" onClick={() => command('insertOrderedList')}>Numbered list</button>
                <button type="button" onClick={() => {
                  const href = window.prompt('Enter an HTTPS or mailto link');
                  if (href) command('createLink', href);
                }}>Link</button>
                <button type="button" onClick={() => command('justifyLeft')}>Left</button>
                <button type="button" onClick={() => command('justifyCenter')}>Center</button>
                <button type="button" onClick={() => command('justifyRight')}>Right</button>
              </div>
              <div className="emailPreviewTabs" role="tablist" aria-label="Email editor and previews">
                <button type="button" aria-selected={preview === 'edit'} onClick={() => setPreview('edit')}>Edit</button>
                <button type="button" aria-selected={preview === 'html'} onClick={() => setPreview('html')}>HTML preview</button>
                <button type="button" aria-selected={preview === 'text'} onClick={() => setPreview('text')}>Plain-text preview</button>
              </div>
              {preview === 'edit' ? (
                <div
                  ref={editorRef}
                  className="emailRichTextEditor"
                  role="textbox"
                  aria-label="Rich-text message"
                  aria-multiline="true"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(event) => {
                    setHtml(event.currentTarget.innerHTML || '<p></p>');
                    setConfirmation(false);
                  }}
                />
              ) : preview === 'html' ? (
                <iframe className="emailHtmlPreview" title="Sanitized HTML email preview" sandbox="" srcDoc={`<div style="font-family:Arial,sans-serif;color:#e9eff5;background:#111c29;padding:24px"><p style="color:#55d9f5">SCAMTASTIC.</p>${safeHtml}</div>`} />
              ) : (
                <pre className="emailTextPreview">{plainText}</pre>
              )}
              <div className="emailTemplateSave">
                <label>Save as template<input value={templateName} onChange={(event) => setTemplateName(event.target.value)} maxLength={80} placeholder="Template name" /></label>
                <button className="button secondary" type="button" disabled={busy || !templateName.trim()} onClick={() => void saveTemplate()}>Save template</button>
              </div>
              <div className="emailSendActions">
                {confirmation && <p role="alert">Send “{subject}” to {recipientCount} recipient{recipientCount === 1 ? '' : 's'}?</p>}
                <button className="button primary" type="button" disabled={busy || recipientCount < 1 || recipientCount > 10 || !subject.trim() || !plainText} onClick={() => void sendEmail()}>
                  {busy ? 'Working…' : confirmation ? 'Confirm send' : 'Review and send'}
                </button>
              </div>
            </section>
          </div>

          <section className="adminPanel emailHistoryPanel">
            <div className="tag">// DELIVERY HISTORY</div>
            <h2>Recent messages</h2>
            {resources.history.length === 0 ? <p className="muted">No administrative email has been sent.</p> : (
              <div className="emailHistoryTable">
                {resources.history.map((delivery) => (
                  <article key={delivery.id}>
                    <strong>{delivery.subject}</strong>
                    <span>{delivery.recipient_count} recipient{delivery.recipient_count === 1 ? '' : 's'}</span>
                    <span className={`statusBadge ${delivery.status === 'sent' ? 'approved' : 'rejected'}`}>{delivery.status}</span>
                    <time dateTime={delivery.created_at}>{new Date(delivery.created_at).toLocaleString()}</time>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
