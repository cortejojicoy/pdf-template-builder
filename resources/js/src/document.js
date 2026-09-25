// Document store: the editable template (fields + page settings) with undo/redo.
//
// Every mutation goes through `update()`. A gesture that produces many
// intermediate states (dragging, resizing, typing) passes `{ transient: true }`
// so the whole gesture collapses into a single undo step, then calls `commit()`
// when the gesture ends.

import { useCallback, useRef, useState } from 'react';
import { uid, DEFAULT_MARGINS } from './constants.js';

const LIMIT = 120;

export function useDocument(initial) {
  const [doc, setDocState] = useState(initial);
  // `initial` may be a lazy initialiser, so mirror the resolved value.
  const docRef   = useRef(null);
  if (docRef.current === null) docRef.current = doc;
  const past     = useRef([]);
  const future   = useRef([]);
  const pending  = useRef(null);   // pre-gesture snapshot while transient
  const [, bump] = useState(0);

  const write = (next) => { docRef.current = next; setDocState(next); bump((n) => n + 1); };

  const update = useCallback((updater, opts = {}) => {
    const prev = docRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    if (!next || next === prev) return;

    if (opts.transient) {
      if (pending.current === null) pending.current = prev;
    } else {
      past.current.push(pending.current ?? prev);
      if (past.current.length > LIMIT) past.current.shift();
      pending.current = null;
      future.current.length = 0;
    }
    write(next);
  }, []);

  /** Close an open transient gesture, turning it into one undo step. */
  const commit = useCallback(() => {
    if (pending.current === null) return;
    if (pending.current !== docRef.current) {
      past.current.push(pending.current);
      if (past.current.length > LIMIT) past.current.shift();
      future.current.length = 0;
    }
    pending.current = null;
    bump((n) => n + 1);
  }, []);

  const undo = useCallback(() => {
    commit();
    if (!past.current.length) return;
    future.current.unshift(docRef.current);
    write(past.current.pop());
  }, [commit]);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    past.current.push(docRef.current);
    write(future.current.shift());
  }, []);

  /** Adopt a server response without touching history (e.g. after save). */
  const sync = useCallback((patch) => {
    write({ ...docRef.current, ...patch });
  }, []);

  return {
    doc,
    docRef,
    update,
    commit,
    undo,
    redo,
    sync,
    canUndo: past.current.length > 0 || pending.current !== null,
    canRedo: future.current.length > 0,
  };
}

// ── Document helpers (pure) ──────────────────────────────────────────────────

export function normalizeDoc(template) {
  const settings = template.settings || {};
  return {
    name:             template.name || 'Untitled',
    page_size:        template.page_size || 'Letter',
    orientation:      template.orientation || 'portrait',
    filename_pattern: template.filename_pattern || '{{id}}.pdf',
    pages:            Math.max(1, Number(template.pages) || 1),
    margins:          { ...DEFAULT_MARGINS, ...(settings.margins || {}) },
    fields:           (template.fields || []).map((f) => ({ ...f, page: Number(f.page) || 1 })),
  };
}

/** The payload sent to PUT /templates/{id}. */
export function toPayload(doc) {
  return {
    name:             doc.name,
    page_size:        doc.page_size,
    orientation:      doc.orientation,
    filename_pattern: doc.filename_pattern,
    pages:            doc.pages,
    fields:           doc.fields,
    settings:         { margins: doc.margins },
  };
}

export const patchFields = (doc, ids, patch) => {
  const set = new Set(ids);
  return { ...doc, fields: doc.fields.map((f) => (set.has(f.id) ? { ...f, ...(typeof patch === 'function' ? patch(f) : patch) } : f)) };
};

export const removeFields = (doc, ids) => {
  const set = new Set(ids);
  return { ...doc, fields: doc.fields.filter((f) => !set.has(f.id)) };
};

/** Clone `ids`, offset by (dx, dy). Returns [doc, newIds]. */
export function cloneFields(doc, ids, dx = 12, dy = 12) {
  const set = new Set(ids);
  const clones = doc.fields.filter((f) => set.has(f.id))
    .map((f) => ({ ...f, id: uid(), x: Math.max(0, f.x + dx), y: Math.max(0, f.y + dy) }));
  return [{ ...doc, fields: [...doc.fields, ...clones] }, clones.map((c) => c.id)];
}

/** Paste raw field objects onto `page`. Returns [doc, newIds]. */
export function pasteFields(doc, raw, page, dx = 12, dy = 12) {
  const copies = raw.map((f) => ({ ...f, id: uid(), page, x: Math.max(0, f.x + dx), y: Math.max(0, f.y + dy) }));
  return [{ ...doc, fields: [...doc.fields, ...copies] }, copies.map((c) => c.id)];
}

// ── Z-order ──────────────────────────────────────────────────────────────────
// Paint order is array order: later entries sit on top.

export function reorder(doc, ids, mode) {
  const set = new Set(ids);
  const moving = doc.fields.filter((f) => set.has(f.id));
  const rest   = doc.fields.filter((f) => !set.has(f.id));
  if (!moving.length) return doc;

  if (mode === 'front') return { ...doc, fields: [...rest, ...moving] };
  if (mode === 'back')  return { ...doc, fields: [...moving, ...rest] };

  // Single-step forward/backward, preserving relative order of the movers.
  const next = doc.fields.slice();
  const idxs = next.map((f, i) => (set.has(f.id) ? i : -1)).filter((i) => i >= 0);
  const step = mode === 'forward' ? 1 : -1;
  const order = step === 1 ? idxs.slice().reverse() : idxs;
  order.forEach((i) => {
    const j = i + step;
    if (j < 0 || j >= next.length || set.has(next[j].id)) return;
    [next[i], next[j]] = [next[j], next[i]];
  });
  return { ...doc, fields: next };
}

// ── Page operations ──────────────────────────────────────────────────────────

/** Insert a blank page at position `at` (1-based); existing pages shift down. */
export function insertPage(doc, at) {
  const pos = Math.max(1, Math.min(doc.pages + 1, at));
  return {
    ...doc,
    pages: doc.pages + 1,
    fields: doc.fields.map((f) => (f.page >= pos ? { ...f, page: f.page + 1 } : f)),
  };
}

export function duplicatePage(doc, page) {
  const withGap = insertPage(doc, page + 1);
  const clones  = doc.fields.filter((f) => f.page === page)
    .map((f) => ({ ...f, id: uid(), page: page + 1 }));
  return { ...withGap, fields: [...withGap.fields, ...clones] };
}

/** Remove a page and everything on it; later pages shift up. */
export function deletePage(doc, page) {
  if (doc.pages <= 1) return doc;
  return {
    ...doc,
    pages: doc.pages - 1,
    fields: doc.fields
      .filter((f) => f.page !== page)
      .map((f) => (f.page > page ? { ...f, page: f.page - 1 } : f)),
  };
}

/** Move page `from` to position `to` (both 1-based), carrying its elements. */
export function movePage(doc, from, to) {
  if (from === to || to < 1 || to > doc.pages) return doc;
  const order = Array.from({ length: doc.pages }, (_, i) => i + 1);
  order.splice(to - 1, 0, order.splice(from - 1, 1)[0]);
  const map = new Map(order.map((oldPage, i) => [oldPage, i + 1]));
  return { ...doc, fields: doc.fields.map((f) => ({ ...f, page: map.get(f.page) ?? f.page })) };
}
