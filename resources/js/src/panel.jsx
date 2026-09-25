// Right-hand properties panel: element properties for one selection,
// align/distribute tools for many.

import React from 'react';
import { Icon } from './icons.jsx';
import { IconBtn, Kbd } from './ui.jsx';
import { KIND_LABEL } from './constants.js';
import { boundsOf } from './snap.js';

const inp = {
  width: '100%', height: 28, padding: '0 8px',
  border: '1px solid var(--border)', background: 'var(--surface-2)',
  borderRadius: 5, fontSize: 12, outline: 'none', color: 'var(--text)',
};

const Row = ({ label, children }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase',
      letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
    {children}
  </div>
);

function NumInput({ label, val, onChange, min = 0 }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: 'var(--muted-2)', marginBottom: 2 }}>{label}</div>
      <input type="number" value={Math.round(val)} min={min}
        onChange={(e) => onChange(+e.target.value)}
        style={{ ...inp, fontFamily: 'monospace', fontSize: 11 }} />
    </div>
  );
}

const Shell = ({ children }) => (
  <aside style={{ width: 264, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)',
    display: 'flex', flexDirection: 'column', minHeight: 0 }}>{children}</aside>
);

export function RightPropsPanel({ editor }) {
  const selected = editor.doc.fields.filter((f) => editor.selection.includes(f.id));

  if (selected.length === 0) return <EmptyPanel editor={editor} />;
  if (selected.length > 1)   return <MultiPanel editor={editor} selected={selected} />;

  const field = selected[0];
  const u = (patch) => editor.ops.patch([field.id], patch);

  return (
    <Shell>
      <PanelHeader editor={editor} title={KIND_LABEL[field.kind] || field.kind} />

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>
        <Row label="Position & size">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <NumInput label="X (pt)" val={field.x} onChange={(v) => u({ x: Math.max(0, v) })} />
            <NumInput label="Y (pt)" val={field.y} onChange={(v) => u({ y: Math.max(0, v) })} />
            <NumInput label="W (pt)" val={field.w} onChange={(v) => u({ w: Math.max(4, v) })} />
            <NumInput label="H (pt)" val={field.h} onChange={(v) => u({ h: Math.max(2, v) })} />
          </div>
        </Row>

        <Row label="Page">
          <select value={field.page} onChange={(e) => u({ page: +e.target.value })} style={inp}>
            {Array.from({ length: editor.doc.pages }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>Page {p}</option>
            ))}
          </select>
        </Row>

        <Row label="Arrange">
          <div style={{ display: 'flex', gap: 4 }}>
            <IconBtn name="bring-front" title="Bring to front" kbd="⌘⇧]" onClick={() => editor.ops.reorder('front')} />
            <IconBtn name="arrow-up"    title="Bring forward"  kbd="⌘]"  onClick={() => editor.ops.reorder('forward')} />
            <IconBtn name="arrow-down"  title="Send backward"  kbd="⌘["  onClick={() => editor.ops.reorder('backward')} />
            <IconBtn name="send-back"   title="Send to back"   kbd="⌘⇧[" onClick={() => editor.ops.reorder('back')} />
          </div>
        </Row>

        {field.kind === 'bound' && (
          <>
            <Row label="Bound field">
              <div className="mono" style={{ padding: '6px 8px', background: 'var(--surface-2)', borderRadius: 5,
                border: '1px solid var(--border)', fontSize: 12, color: 'var(--accent)', wordBreak: 'break-all' }}>
                {field.bind}
              </div>
            </Row>
            <TextStyleProps field={field} u={u} />
          </>
        )}

        {(field.kind === 'text' || field.kind === 'heading') && (
          <>
            <Row label="Content">
              <textarea value={field.text || ''} onChange={(e) => u({ text: e.target.value })}
                style={{ ...inp, height: 60, padding: '6px 8px', resize: 'vertical', lineHeight: 1.4 }} />
            </Row>
            <TextStyleProps field={field} u={u} />
          </>
        )}

        {field.kind === 'divider' && (
          <>
            <Row label="Color"><ColorPicker value={field.color || '#d1d5db'} onChange={(v) => u({ color: v })} /></Row>
            <Row label="Thickness (pt)">
              <input type="number" value={field.thickness || 1} min={0.5} step={0.5}
                onChange={(e) => u({ thickness: Math.max(0.5, +e.target.value) })} style={inp} />
            </Row>
          </>
        )}

        {field.kind === 'rect' && (
          <>
            <Row label="Fill"><ColorPicker value={field.fill || '#f3f4f6'} onChange={(v) => u({ fill: v })} allowEmpty /></Row>
            <Row label="Border color"><ColorPicker value={field.stroke || ''} onChange={(v) => u({ stroke: v })} allowEmpty /></Row>
            {field.stroke && (
              <Row label="Border width (pt)">
                <input type="number" value={field.strokeWidth || 1} min={0.5} step={0.5}
                  onChange={(e) => u({ strokeWidth: Math.max(0.5, +e.target.value) })} style={inp} />
              </Row>
            )}
            <Row label="Corner radius (pt)">
              <input type="number" value={field.borderRadius || 0} min={0}
                onChange={(e) => u({ borderRadius: Math.max(0, +e.target.value) })} style={inp} />
            </Row>
          </>
        )}

        {field.kind === 'image' && (
          <>
            <Row label="Image URL">
              <input value={field.url || ''} onChange={(e) => u({ url: e.target.value })}
                placeholder="https://…" style={inp} />
            </Row>
            <Row label="Object fit">
              <select value={field.objectFit || 'contain'} onChange={(e) => u({ objectFit: e.target.value })} style={inp}>
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
                <option value="fill">Fill</option>
              </select>
            </Row>
          </>
        )}

        {field.kind === 'signature' && (
          <Row label="Label">
            <input value={field.label || ''} onChange={(e) => u({ label: e.target.value })}
              placeholder="Signature" style={inp} />
          </Row>
        )}

        {field.kind === 'checkbox' && (
          <>
            <Row label="Default state">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!field.checked} onChange={(e) => u({ checked: e.target.checked })} />
                Checked by default
              </label>
            </Row>
            <Row label="Bind to field">
              <input value={field.bind || ''} onChange={(e) => u({ bind: e.target.value })}
                placeholder="model.field" style={{ ...inp, fontFamily: 'monospace', fontSize: 11 }} />
            </Row>
          </>
        )}

        {field.kind === 'qr' && (
          <Row label="Value / bind">
            <input value={field.value || ''} onChange={(e) => u({ value: e.target.value })}
              placeholder="{{model.field}} or static text" style={{ ...inp, fontFamily: 'monospace', fontSize: 11 }} />
          </Row>
        )}

        {field.kind === 'page-number' && (
          <>
            <Row label="Format">
              <input value={field.format || 'Page {{page}} of {{total}}'}
                onChange={(e) => u({ format: e.target.value })}
                style={{ ...inp, fontFamily: 'monospace', fontSize: 11 }} />
            </Row>
            <TextStyleProps field={field} u={u} />
          </>
        )}
      </div>
    </Shell>
  );
}

function PanelHeader({ editor, title, subtitle }) {
  return (
    <div style={{ padding: '8px 10px 8px 14px', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{subtitle}</div>}
      </div>
      <IconBtn name="copy" title="Duplicate" kbd="⌘D" onClick={() => editor.ops.duplicate()} />
      <IconBtn name="trash" title="Delete" kbd="⌫" danger onClick={() => editor.ops.remove()} />
    </div>
  );
}

function EmptyPanel({ editor }) {
  const { doc } = editor;
  const onPage = doc.fields.filter((f) => f.page === editor.currentPage).length;
  return (
    <Shell>
      <div style={{ padding: '14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>
        Nothing selected
      </div>
      <div style={{ padding: 14, fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Elements on this page</span><span className="mono" style={{ color: 'var(--text-2)' }}>{onPage}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Elements in template</span><span className="mono" style={{ color: 'var(--text-2)' }}>{doc.fields.length}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Pages</span><span className="mono" style={{ color: 'var(--text-2)' }}>{doc.pages}</span>
        </div>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          Drag a field or element onto the page, or drag on empty space to select several at once.
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Kbd>?</Kbd> <span>for all shortcuts</span>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function MultiPanel({ editor, selected }) {
  const b = boundsOf(selected);
  const align = (mode) => {
    editor.ops.patch(selected.map((f) => f.id), (f) => {
      switch (mode) {
        case 'left':    return { x: Math.round(b.x) };
        case 'hcenter': return { x: Math.round(b.x + (b.w - f.w) / 2) };
        case 'right':   return { x: Math.round(b.x + b.w - f.w) };
        case 'top':     return { y: Math.round(b.y) };
        case 'vcenter': return { y: Math.round(b.y + (b.h - f.h) / 2) };
        case 'bottom':  return { y: Math.round(b.y + b.h - f.h) };
        default:        return {};
      }
    });
  };

  const distribute = (axis) => {
    const sorted = [...selected].sort((a, c) => (axis === 'x' ? a.x - c.x : a.y - c.y));
    if (sorted.length < 3) return;
    const first = sorted[0];
    const last  = sorted[sorted.length - 1];
    const span  = axis === 'x'
      ? (last.x + last.w) - first.x - sorted.reduce((s, f) => s + f.w, 0)
      : (last.y + last.h) - first.y - sorted.reduce((s, f) => s + f.h, 0);
    const gap = span / (sorted.length - 1);
    let cursor = axis === 'x' ? first.x : first.y;
    const patches = new Map();
    sorted.forEach((f) => {
      patches.set(f.id, axis === 'x' ? { x: Math.round(cursor) } : { y: Math.round(cursor) });
      cursor += (axis === 'x' ? f.w : f.h) + gap;
    });
    editor.ops.patch(sorted.map((f) => f.id), (f) => patches.get(f.id) || {});
  };

  const AlignBtn = ({ icon, title, onClick, flip }) => (
    <button type="button" onClick={onClick} title={title}
      style={{ flex: 1, height: 28, borderRadius: 5, border: '1px solid var(--border)',
        background: 'var(--surface-2)', color: 'var(--text-2)', display: 'grid', placeItems: 'center' }}>
      <Icon name={icon} size={13} style={flip ? { transform: 'rotate(90deg)' } : undefined} />
    </button>
  );

  return (
    <Shell>
      <PanelHeader editor={editor} title={`${selected.length} elements`} subtitle="Multiple selection" />
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>
        <Row label="Align horizontally">
          <div style={{ display: 'flex', gap: 5 }}>
            <AlignBtn icon="align-left"   title="Align left"    onClick={() => align('left')} />
            <AlignBtn icon="align-center" title="Align centre"  onClick={() => align('hcenter')} />
            <AlignBtn icon="align-right"  title="Align right"   onClick={() => align('right')} />
          </div>
        </Row>
        <Row label="Align vertically">
          <div style={{ display: 'flex', gap: 5 }}>
            <AlignBtn icon="align-left"   title="Align top"     onClick={() => align('top')} flip />
            <AlignBtn icon="align-center" title="Align middle"  onClick={() => align('vcenter')} flip />
            <AlignBtn icon="align-right"  title="Align bottom"  onClick={() => align('bottom')} flip />
          </div>
        </Row>
        <Row label="Distribute">
          <div style={{ display: 'flex', gap: 5 }}>
            <button type="button" onClick={() => distribute('x')} disabled={selected.length < 3}
              style={{ flex: 1, height: 28, borderRadius: 5, border: '1px solid var(--border)', fontSize: 11.5,
                background: 'var(--surface-2)', color: 'var(--text-2)', opacity: selected.length < 3 ? 0.5 : 1 }}>
              Horizontally
            </button>
            <button type="button" onClick={() => distribute('y')} disabled={selected.length < 3}
              style={{ flex: 1, height: 28, borderRadius: 5, border: '1px solid var(--border)', fontSize: 11.5,
                background: 'var(--surface-2)', color: 'var(--text-2)', opacity: selected.length < 3 ? 0.5 : 1 }}>
              Vertically
            </button>
          </div>
        </Row>
        <Row label="Arrange">
          <div style={{ display: 'flex', gap: 4 }}>
            <IconBtn name="bring-front" title="Bring to front" onClick={() => editor.ops.reorder('front')} />
            <IconBtn name="arrow-up"    title="Bring forward"  onClick={() => editor.ops.reorder('forward')} />
            <IconBtn name="arrow-down"  title="Send backward"  onClick={() => editor.ops.reorder('backward')} />
            <IconBtn name="send-back"   title="Send to back"   onClick={() => editor.ops.reorder('back')} />
          </div>
        </Row>
        <Row label="Bounds">
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            {Math.round(b.x)}, {Math.round(b.y)} · {Math.round(b.w)} × {Math.round(b.h)} pt
          </div>
        </Row>
      </div>
    </Shell>
  );
}

function TextStyleProps({ field, u }) {
  return (
    <>
      <Row label="Font size (pt)">
        <input type="number" value={field.fontSize || 11} min={6} max={120}
          onChange={(e) => u({ fontSize: Math.max(6, +e.target.value) })} style={inp} />
      </Row>
      <Row label="Style">
        <div style={{ display: 'flex', gap: 5 }}>
          {[
            { k: 'bold',      l: 'B', s: { fontWeight: 700 } },
            { k: 'italic',    l: 'I', s: { fontStyle: 'italic' } },
            { k: 'underline', l: 'U', s: { textDecoration: 'underline' } },
          ].map(({ k, l, s }) => (
            <button type="button" key={k} onClick={() => u({ [k]: !field[k] })}
              style={{ width: 34, height: 28, borderRadius: 5, border: '1px solid var(--border)',
                background: field[k] ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: field[k] ? 'var(--accent)' : 'var(--text-2)', fontSize: 13, ...s }}>
              {l}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Alignment">
        <div style={{ display: 'flex', gap: 5 }}>
          {['left', 'center', 'right'].map((a) => (
            <button type="button" key={a} onClick={() => u({ align: a })}
              style={{ flex: 1, height: 28, borderRadius: 5, border: '1px solid var(--border)',
                display: 'grid', placeItems: 'center',
                background: (field.align || 'left') === a ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: (field.align || 'left') === a ? 'var(--accent)' : 'var(--text-2)' }}>
              <Icon name={`align-${a}`} size={13} />
            </button>
          ))}
        </div>
      </Row>
      <Row label="Color">
        <ColorPicker value={field.color || '#374151'} onChange={(v) => u({ color: v })} />
      </Row>
    </>
  );
}

function ColorPicker({ value, onChange, allowEmpty }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input type="color" value={value || '#374151'} onChange={(e) => onChange(e.target.value)}
        style={{ width: 32, height: 28, padding: 2, border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', flexShrink: 0 }} />
      <input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={allowEmpty ? 'none' : '#374151'}
        style={{ flex: 1, height: 28, padding: '0 8px', border: '1px solid var(--border)', background: 'var(--surface-2)',
          borderRadius: 5, fontSize: 11, fontFamily: 'monospace', outline: 'none', color: 'var(--text)' }} />
      {allowEmpty && value && (
        <button type="button" onClick={() => onChange('')}
          style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1, padding: '0 2px' }}>✕</button>
      )}
    </div>
  );
}
