// Production builder entry point (bundled by Vite).
// Reads all config from window.__PDF_BUILDER__ (injected by the Blade template).

import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Icon } from './icons.jsx';
import { BuilderView } from './builder.jsx';

const CFG      = window.__PDF_BUILDER__ || {};
const API      = CFG.apiBase  || '';
const CSRF     = CFG.csrfToken || document.querySelector('meta[name="csrf-token"]')?.content || '';
const MODELS   = CFG.models   || {};
const LIST_URL = CFG.listUrl  || '/admin/pdf-templates';

async function apiPut(url, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': CSRF,
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(url, formData) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-CSRF-TOKEN': CSRF, Accept: 'application/json' },
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function App() {
  const [template, setTemplate] = useState(CFG.template || {});
  const [saved, setSaved]       = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  const handleTemplateChange = useCallback(() => setSaved(false), []);

  const handleSave = useCallback(async (data) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiPut(`${API}/templates/${template.id}`, data);
      setTemplate((t) => ({ ...t, ...updated }));
      setSaved(true);
    } catch (e) {
      setError('Save failed — ' + e.message);
    } finally {
      setSaving(false);
    }
  }, [template.id, saving]);

  const handleUpload = useCallback(async (file) => {
    const fd = new FormData();
    fd.append('pdf', file);
    try {
      const res = await apiPost(`${API}/templates/${template.id}/upload`, fd);
      setTemplate((t) => ({ ...t, background_url: res.background_url }));
      setSaved(false);
    } catch (e) {
      setError('Upload failed — ' + e.message);
    }
  }, [template.id]);

  const handlePreview = useCallback(async () => {
    if (!saved && window.__builderSave) {
      await window.__builderSave();
    }
    window.open(`${API}/templates/${template.id}/preview`, '_blank', 'noopener');
  }, [template.id, saved]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)' }}>
      <BuilderTopBar
        template={template}
        saved={saved}
        saving={saving}
        error={error}
        listUrl={LIST_URL}
        onSave={() => window.__builderSave && window.__builderSave()}
        onPreview={handlePreview}
      />

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <BuilderView
          template={template}
          models={MODELS}
          onSave={handleSave}
          onUpload={handleUpload}
          onFieldsChange={handleTemplateChange}
          saving={saving}
        />
      </div>

      {error && (
        <div style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--danger)', color: '#fff', padding: '8px 16px', borderRadius: 8,
          fontSize: 13, zIndex: 100, boxShadow: 'var(--shadow-lg)',
        }}>{error}</div>
      )}
    </div>
  );
}

function BuilderTopBar({ template, saved, saving, error, listUrl, onSave, onPreview }) {
   return (
     <header style={{
       height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
       padding: '0 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
       whiteSpace: 'nowrap', minWidth: 0,
     }}>
       <span style={{ padding: '4px 6px', color: 'var(--text)', fontWeight: 500, fontSize: 13,
         overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
         {template.name || 'Untitled'}
       </span>

       <button onClick={onPreview} disabled={saving}
         style={{
           height: 34, padding: '0 12px', borderRadius: 7, color: 'var(--text-2)',
           fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6,
           border: '1px solid var(--border)', background: 'var(--surface)',
           opacity: saving ? 0.7 : 1, cursor: saving ? 'wait' : 'pointer',
           flexShrink: 0,
         }}>
         <Icon name="eye" size={15} /> Preview
       </button>

       <button onClick={onSave} disabled={saving}
         style={{
           height: 34, padding: '0 14px', borderRadius: 7, background: 'var(--accent)', color: '#fff',
           fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6,
           opacity: saving ? 0.7 : 1, cursor: saving ? 'wait' : 'pointer',
           flexShrink: 0,
         }}>
         <Icon name="save" size={15} /> Save template
       </button>

       <div style={{ flex: 1, minWidth: 12 }} />

       <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>
         <span style={{
           display: 'inline-block', width: 6, height: 6, borderRadius: 3, flexShrink: 0,
           background: error ? 'var(--danger)' : saved ? 'var(--success)' : 'var(--warning)',
         }} />
         <span>{saving ? 'Saving…' : error ? 'Error' : saved ? 'All changes saved' : 'Unsaved changes'}</span>
       </div>
     </header>
   );
 }

const root = document.getElementById('pdf-builder-root');
if (root) {
  createRoot(root).render(<App />);
}
