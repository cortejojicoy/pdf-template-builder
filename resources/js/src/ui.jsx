// Small shared UI primitives styled to match the Filament panel.

import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';

export const inputStyle = {
  width: '100%', height: 34, padding: '0 10px', fontSize: 13,
  border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)',
  outline: 'none', color: 'var(--text)',
  transition: 'border-color .15s ease, box-shadow .15s ease',
};

export const focusRing = {
  onFocus: (e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-soft)'; },
  onBlur:  (e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; },
};

export function IconBtn({ name, title, onClick, active, disabled, danger, size = 15, kbd }) {
  const [hov, setHov] = useState(false);
  const color = disabled ? 'var(--muted-2)'
    : danger ? 'var(--danger)'
    : active ? 'var(--accent)'
    : hov ? 'var(--text)' : 'var(--muted)';
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled}
      title={kbd ? `${title} (${kbd})` : title} aria-label={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 6,
        color,
        background: active ? 'var(--accent-soft)' : hov && !disabled ? 'var(--surface-2)' : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background .12s ease, color .12s ease',
      }}>
      <Icon name={name} size={size} />
    </button>
  );
}

export function ToolbarButton({ children, onClick, active, title, kbd }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} title={kbd ? `${title || ''} (${kbd})`.trim() : title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        height: 28, padding: '0 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
        display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
        border: '1px solid ' + (active ? 'transparent' : 'var(--border)'),
        background: active ? 'var(--accent-soft)' : hov ? 'var(--surface-2)' : 'var(--surface)',
        color: active ? 'var(--accent)' : 'var(--text-2)',
        transition: 'background .12s ease, color .12s ease',
      }}>
      {children}
    </button>
  );
}

/** Keyboard key pill. */
export function Kbd({ children }) {
  return (
    <span className="mono" style={{
      display: 'inline-block', minWidth: 18, padding: '1px 5px', borderRadius: 4,
      border: '1px solid var(--border)', borderBottomWidth: 2, background: 'var(--surface-2)',
      fontSize: 10.5, lineHeight: '15px', color: 'var(--text-2)', textAlign: 'center',
    }}>{children}</span>
  );
}

// ── Modal shell ──────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, width = 420 }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(15,23,42,.45)',
        display: 'grid', placeItems: 'center', padding: 24, backdropFilter: 'blur(2px)',
      }}>
      <div role="dialog" aria-modal="true" aria-label={title}
        style={{
          width, maxWidth: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column',
          background: 'var(--surface)', color: 'var(--text)', borderRadius: 12,
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
        }}>
        {title && (
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{title}</div>
            <IconBtn name="close" title="Close" onClick={onClose} />
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16, fontSize: 13, lineHeight: 1.55 }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Button({ children, onClick, variant = 'secondary', autoFocus }) {
  const ref = useRef(null);
  useEffect(() => { if (autoFocus && ref.current) ref.current.focus(); }, [autoFocus]);
  const styles = {
    primary:   { background: 'var(--accent)', color: '#fff', border: '1px solid transparent' },
    danger:    { background: 'var(--danger)', color: '#fff', border: '1px solid transparent' },
    secondary: { background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)' },
  }[variant];
  return (
    <button type="button" ref={ref} onClick={onClick}
      style={{ height: 34, padding: '0 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, ...styles }}>
      {children}
    </button>
  );
}

/** Promise-free confirm dialog driven by a `{ title, body, confirmLabel, onConfirm }` object. */
export function ConfirmDialog({ request, onClose }) {
  return (
    <Modal open={!!request} onClose={onClose} title={request?.title} width={400}
      footer={request && (
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={request.danger ? 'danger' : 'primary'} autoFocus
            onClick={() => { request.onConfirm(); onClose(); }}>
            {request.confirmLabel || 'Confirm'}
          </Button>
        </>
      )}>
      <div style={{ color: 'var(--text-2)' }}>{request?.body}</div>
    </Modal>
  );
}

// ── Context menu ─────────────────────────────────────────────────────────────
export function ContextMenu({ menu, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: menu?.x ?? 0, y: menu?.y ?? 0 });

  useEffect(() => {
    if (!menu) return undefined;
    // Keep the menu inside the viewport.
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({
        x: Math.min(menu.x, window.innerWidth  - r.width  - 8),
        y: Math.min(menu.y, window.innerHeight - r.height - 8),
      });
    }
    const close = () => onClose();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  return (
    <div ref={ref} onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', left: pos.x, top: pos.y, zIndex: 9997, minWidth: 200, padding: 4,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
        boxShadow: 'var(--shadow-lg)',
      }}>
      {menu.items.map((item, i) => item.separator ? (
        <div key={`s${i}`} style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }} />
      ) : (
        <MenuItem key={item.label} item={item} onClose={onClose} />
      ))}
    </div>
  );
}

function MenuItem({ item, onClose }) {
  const [hov, setHov] = useState(false);
  const disabled = item.disabled;
  return (
    <button type="button" disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={() => { if (!disabled) { item.onClick(); onClose(); } }}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
        borderRadius: 6, fontSize: 12.5, textAlign: 'left',
        color: disabled ? 'var(--muted-2)' : item.danger ? 'var(--danger)' : 'var(--text-2)',
        background: hov && !disabled ? (item.danger ? 'rgba(220,38,38,.08)' : 'var(--surface-2)') : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}>
      {item.icon && <Icon name={item.icon} size={13} style={{ opacity: 0.85, flexShrink: 0 }} />}
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.kbd && <Kbd>{item.kbd}</Kbd>}
    </button>
  );
}
