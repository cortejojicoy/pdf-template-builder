// Keyboard layer. One listener, one table — the cheat sheet is generated from
// the same table the handler matches against, so they can't drift apart.

import React, { useEffect, useRef } from 'react';
import { Modal, Kbd } from './ui.jsx';
import { isTypingTarget } from './constants.js';

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const MOD = IS_MAC ? '⌘' : 'Ctrl';

/**
 * `keys` is an array of combos. A combo is "mod+shift+z"; bare keys are
 * matched as-is. `whileTyping` lets a shortcut fire from inside an input.
 */
export const SHORTCUT_GROUPS = [
  {
    group: 'Document',
    items: [
      { action: 'save',      keys: ['mod+s'],                    label: 'Save template', whileTyping: true },
      { action: 'preview',   keys: ['mod+shift+p'],              label: 'Preview PDF' },
      { action: 'undo',      keys: ['mod+z'],                    label: 'Undo' },
      { action: 'redo',      keys: ['mod+shift+z', 'mod+y'],     label: 'Redo' },
      { action: 'help',      keys: ['shift+?', '?'],             label: 'Keyboard shortcuts' },
    ],
  },
  {
    group: 'Editing',
    items: [
      { action: 'copy',      keys: ['mod+c'],                    label: 'Copy' },
      { action: 'cut',       keys: ['mod+x'],                    label: 'Cut' },
      { action: 'paste',     keys: ['mod+v'],                    label: 'Paste' },
      { action: 'duplicate', keys: ['mod+d'],                    label: 'Duplicate' },
      { action: 'remove',    keys: ['delete'],                   label: 'Delete selection' },
      { action: 'selectAll', keys: ['mod+a'],                    label: 'Select all on page' },
      { action: 'deselect',  keys: ['escape'],                   label: 'Deselect', whileTyping: true },
      { action: 'nudge',     keys: ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'], label: 'Nudge 1 pt', display: ['←', '→', '↑', '↓'] },
      { action: 'nudgeBig',  keys: ['shift+arrowleft', 'shift+arrowright', 'shift+arrowup', 'shift+arrowdown'], label: 'Nudge 10 pt', display: ['⇧←', '⇧→', '⇧↑', '⇧↓'] },
      { action: 'forward',   keys: ['mod+]'],                    label: 'Bring forward' },
      { action: 'backward',  keys: ['mod+['],                    label: 'Send backward' },
      { action: 'front',     keys: ['mod+shift+]'],              label: 'Bring to front' },
      { action: 'back',      keys: ['mod+shift+['],              label: 'Send to back' },
    ],
  },
  {
    group: 'View',
    items: [
      { action: 'zoomIn',    keys: ['mod+plus'],                 label: 'Zoom in' },
      { action: 'zoomOut',   keys: ['mod+minus'],                label: 'Zoom out' },
      { action: 'zoomFit',   keys: ['mod+0'],                    label: 'Fit page' },
      { action: 'zoom100',   keys: ['mod+1'],                    label: 'Zoom to 100%' },
      { action: 'zoomWidth', keys: ['mod+2'],                    label: 'Fit width' },
      { action: 'toggleRulers', keys: ['r'],                     label: 'Toggle rulers' },
      { action: 'toggleGrid',   keys: ['g'],                     label: 'Toggle grid' },
      { action: 'toggleSnap',   keys: ['s'],                     label: 'Toggle snapping' },
    ],
  },
  {
    group: 'Pages',
    items: [
      { action: 'prevPage',   keys: ['pageup',   'alt+arrowup'],   label: 'Previous page' },
      { action: 'nextPage',   keys: ['pagedown', 'alt+arrowdown'], label: 'Next page' },
      { action: 'addPage',    keys: ['mod+shift+n'],               label: 'Add page' },
      { action: 'deletePage', keys: ['mod+shift+delete'],          label: 'Delete current page' },
    ],
  },
];

const ALL = SHORTCUT_GROUPS.flatMap((g) => g.items);

function comboMatches(e, combo) {
  const parts = combo.split('+');
  const key   = parts.pop();
  const wantMod   = parts.includes('mod');
  const wantShift = parts.includes('shift');
  const wantAlt   = parts.includes('alt');

  const mod = IS_MAC ? e.metaKey : e.ctrlKey;
  if (wantMod !== !!mod) return false;
  if (wantAlt !== !!e.altKey) return false;
  // On Mac ⌘ + a non-mod modifier combination we still want ctrl to be free.
  if (IS_MAC && e.ctrlKey && wantMod) return false;

  const k = (e.key || '').toLowerCase();

  if (key === 'delete')  return (wantShift === !!e.shiftKey) && (k === 'delete' || k === 'backspace');
  if (key === 'plus')    return (k === '+' || k === '=' || k === 'add');
  if (key === 'minus')   return (k === '-' || k === '_' || k === 'subtract');
  if (key === '?')       return k === '?' || (e.shiftKey && k === '/');

  if (wantShift !== !!e.shiftKey) return false;
  return k === key;
}

/** Human-readable keys for the cheat sheet. */
export function displayKeys(item) {
  if (item.display) return item.display;
  return item.keys.map((c) => c
    .split('+')
    .map((p) => ({
      mod: MOD, shift: '⇧', alt: IS_MAC ? '⌥' : 'Alt',
      arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓',
      delete: IS_MAC ? '⌫' : 'Del', escape: 'Esc', pageup: 'PgUp', pagedown: 'PgDn',
      plus: '+', minus: '−', enter: '↵',
    }[p] || p.toUpperCase()))
    .join(IS_MAC ? '' : '+'));
}

/**
 * Binds the table above to `actions`. Handlers receive the raw event so
 * direction-sensitive ones (nudge, page nav) can read the key.
 */
export function useShortcuts(actions) {
  const ref = useRef(actions);
  ref.current = actions;

  useEffect(() => {
    const onKey = (e) => {
      const typing = isTypingTarget(e.target);

      for (const item of ALL) {
        if (typing && !item.whileTyping) continue;
        if (!item.keys.some((c) => comboMatches(e, c))) continue;

        const fn = ref.current[item.action];
        if (!fn) return;
        e.preventDefault();
        e.stopPropagation();
        fn(e);
        return;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

// ── Cheat sheet ──────────────────────────────────────────────────────────────
export function ShortcutsOverlay({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" width={620}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 28px' }}>
        {SHORTCUT_GROUPS.map((g) => (
          <div key={g.group}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
              color: 'var(--muted)', marginBottom: 8 }}>{g.group}</div>
            {g.items.map((item) => (
              <div key={item.action} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>{item.label}</div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {displayKeys(item).slice(0, 4).map((k) => <Kbd key={k}>{k}</Kbd>)}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)' }}>
        <strong style={{ color: 'var(--text-2)' }}>Mouse:</strong>{' '}
        {MOD}+scroll or pinch to zoom at the pointer · Space-drag or middle-drag to pan ·
        scroll to move up the document, ⇧+scroll sideways · drag on empty space to marquee-select ·
        ⇧+click to add to the selection · Alt-drag to clone · ⇧ while resizing keeps the ratio ·
        hold Alt while dragging to ignore snapping · right-click for the context menu.
      </div>
    </Modal>
  );
}
