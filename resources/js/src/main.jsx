// Production entry point (bundled by Vite).
// Config comes from window.__PDF_BUILDER__, injected by the Blade view.
// The page chrome — breadcrumbs, heading, Preview/Save buttons — is rendered by
// Filament itself; those buttons reach this app through DOM events.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BuilderView } from './builder.jsx';

const CFG    = window.__PDF_BUILDER__ || {};
const API    = CFG.apiBase || '';
const CSRF   = CFG.csrfToken || document.querySelector('meta[name="csrf-token"]')?.content || '';
const MODELS = CFG.models || {};

// Where a save PUTs, and where a reset DELETEs. Both default to the template's
// own endpoints; a host page (e.g. a per-document placement editor) points them
// at its own routes so a save writes an override, not the shared template.
const SAVE_URL  = CFG.saveUrl  || null;
const RESET_URL = CFG.resetUrl || null;

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
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      message = data.message || message;
    } catch (_) { /* non-JSON error body */ }
    throw new Error(message);
  }
  return res.json();
}

async function apiDelete(url) {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'X-CSRF-TOKEN': CSRF, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json().catch(() => ({}));
}

/** Keep the builder filling everything below the Filament header. */
function useFillViewport(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      const top = el.getBoundingClientRect().top + (window.scrollY || 0);
      el.style.height = `${Math.max(420, window.innerHeight - top - 12)}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    const ro = 'ResizeObserver' in window ? new ResizeObserver(fit) : null;
    if (ro && el.parentElement) ro.observe(el.parentElement);
    return () => {
      window.removeEventListener('resize', fit);
      if (ro) ro.disconnect();
    };
  }, [ref]);
}

function App({ rootRef }) {
  const [template] = useState(CFG.template || {});
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const bridge = useRef({});

  useFillViewport(rootRef);

  const handleSave = useCallback(async (body) => {
    if (saving) return false;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiPut(SAVE_URL || `${API}/templates/${template.id}`, body);
      // The heading is server-rendered; keep it in step after a rename.
      const heading = document.querySelector('.fi-header-heading, .fi-page-header-heading, h1.fi-header-heading');
      if (heading && updated.name) heading.textContent = updated.name;
      if (updated.name) document.title = updated.name;
      return true;
    } catch (e) {
      setError(`Save failed — ${e.message}`);
      return false;
    } finally {
      setSaving(false);
    }
  }, [template.id, saving]);

  const handlePreview = useCallback(() => {
    window.open(`${API}/templates/${template.id}/preview`, '_blank', 'noopener');
  }, [template.id]);

  // Drop the host page's override and reopen on whatever it falls back to.
  // Only wired when the host configured a resetUrl — a template has nothing
  // to reset to.
  const handleReset = useCallback(async () => {
    if (!RESET_URL) return;
    try {
      await apiDelete(RESET_URL);
      window.location.reload();
    } catch (e) {
      setError(`Reset failed — ${e.message}`);
    }
  }, []);

  // Filament's header actions dispatch these.
  useEffect(() => {
    const onSaveEvent    = () => bridge.current.save?.();
    const onPreviewEvent = () => bridge.current.preview?.();
    const onHelpEvent    = () => bridge.current.showShortcuts?.();
    const onResetEvent   = () => bridge.current.reset?.();
    window.addEventListener('pdf-builder:save', onSaveEvent);
    window.addEventListener('pdf-builder:preview', onPreviewEvent);
    window.addEventListener('pdf-builder:shortcuts', onHelpEvent);
    window.addEventListener('pdf-builder:reset', onResetEvent);
    return () => {
      window.removeEventListener('pdf-builder:save', onSaveEvent);
      window.removeEventListener('pdf-builder:preview', onPreviewEvent);
      window.removeEventListener('pdf-builder:shortcuts', onHelpEvent);
      window.removeEventListener('pdf-builder:reset', onResetEvent);
    };
  }, []);

  // Don't let unsaved work disappear on navigation.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!bridge.current.isDirty?.()) return undefined;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)',
      border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <BuilderView
          template={template}
          models={MODELS}
          onSave={handleSave}
          onPreview={handlePreview}
          onReset={RESET_URL ? handleReset : undefined}
          bridge={bridge}
          saving={saving}
          saveError={error}
        />
      </div>

      {error && (
        <div role="alert" style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--danger)', color: '#fff', padding: '9px 16px', borderRadius: 8,
          fontSize: 13, zIndex: 9999, boxShadow: 'var(--shadow-lg)',
        }}>{error}</div>
      )}
    </div>
  );
}

const rootEl = document.getElementById('pdf-builder-root');
if (rootEl) {
  const rootRef = { current: rootEl };
  createRoot(rootEl).render(<App rootRef={rootRef} />);
}
