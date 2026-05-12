// Builder view — sidebar (models/fields/layers/settings) + canvas + properties panel.
// Production version: reads model config from window.__PDF_BUILDER__.models instead of
// the prototype's static window.MODELS.

import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './icons.jsx';
import { CanvasArea, RightPropsPanel } from './canvas.jsx';
import { btnGhost } from './styles.js';

const PX_PER_PT = 1;
const PAGE_W = 612;  // letter portrait (pts)
const PAGE_H = 792;

function BuilderView({ template, models, onSave, onFieldsChange, saving }) {
  const modelKey = template.model_key || 'invoice';
  const model    = models[modelKey] || { label: modelKey, fields: [], relations: {} };

  // Normalize model shape to match prototype (icon, relations object).
  const normalizedModel = {
    name: model.label || modelKey,
    icon: model.icon || 'database',
    fields: model.fields || [],
    relations: model.relations || {},
  };

  const [fields, setFields]         = useState(() => template.fields || []);
  const [selection, setSelection]   = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(template.pages || 1);
  const [zoom, setZoom]             = useState(0.9);
  const [sidebarTab, setSidebarTab] = useState('fields');
  const [drag, setDrag]             = useState(null);

  // Expose save to the top bar's button via a window function.
  useEffect(() => {
    window.__builderSave = () => onSave && onSave({ fields, pages: totalPages });
    return () => { window.__builderSave = null; };
  }, [fields, totalPages, onSave]);

  // Notify parent of changes so it can show "unsaved" indicator.
  const fieldsRef = React.useRef(fields);
  useEffect(() => {
    if (fieldsRef.current !== fields) {
      fieldsRef.current = fields;
      onFieldsChange && onFieldsChange();
    }
  }, [fields]);

  const selectedField = fields.find((f) => f.id === selection);

  const updateField    = (id, patch) => setFields((fs) => fs.map((f) => f.id === id ? { ...f, ...patch } : f));
  const deleteField    = (id) => { setFields((fs) => fs.filter((f) => f.id !== id)); setSelection(null); };
  const duplicateField = (id) => {
    const f = fields.find((x) => x.id === id);
    if (!f) return;
    const nid = 'f' + Date.now();
    setFields((fs) => [...fs, { ...f, id: nid, x: f.x + 12, y: f.y + 12 }]);
    setSelection(nid);
  };

  const dropField = (clientX, clientY, canvasRect, pageNum) => {
    if (!drag) return;
    const x   = (clientX - canvasRect.left) / zoom;
    const y   = (clientY - canvasRect.top)  / zoom;
    const nid = 'f' + Date.now();
    const base = { id: nid, page: pageNum, x: Math.round(x - 40), y: Math.round(y - 8) };
    let nf;
    if (drag.kind === 'bound') {
      nf = { ...base, kind: 'bound', bind: drag.bind, w: 140, h: 18, fontSize: 11 };
    } else if (drag.kind === 'heading') {
      nf = { ...base, kind: 'heading', text: 'Heading', w: 180, h: 28, fontSize: 18, bold: true };
    } else if (drag.kind === 'text') {
      nf = { ...base, kind: 'text', text: 'Text', w: 140, h: 18, fontSize: 11 };
    } else if (drag.kind === 'divider') {
      nf = { ...base, kind: 'divider', w: 200, h: 1 };
    } else if (drag.kind === 'rect') {
      nf = { ...base, kind: 'rect', w: 160, h: 60, fill: '#f3f4f6' };
    } else if (drag.kind === 'image') {
      nf = { ...base, kind: 'image', w: 120, h: 80 };
    } else if (drag.kind === 'signature') {
      nf = { ...base, kind: 'signature', w: 200, h: 60 };
    } else if (drag.kind === 'checkbox') {
      nf = { ...base, kind: 'checkbox', w: 16, h: 16 };
    } else if (drag.kind === 'qr') {
      nf = { ...base, kind: 'qr', w: 80, h: 80 };
    } else if (drag.kind === 'page-number') {
      nf = { ...base, kind: 'page-number', w: 60, h: 14, fontSize: 9, align: 'center', color: '#9ca3af' };
    } else {
      nf = { ...base, kind: 'text', text: 'New', w: 100, h: 18, fontSize: 11 };
    }
    setFields((fs) => [...fs, nf]);
    setSelection(nid);
    setDrag(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (!selection) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && e.target === document.body) {
        deleteField(selection);
      }
      if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        duplicateField(selection);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection]);

  const handleSave = () => {
    onSave({ fields, pages: totalPages });
  };

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0, position: 'relative' }}>
      <Sidebar model={normalizedModel} activeTab={sidebarTab} onTab={setSidebarTab}
        fields={fields.filter((f) => f.page === currentPage)} selection={selection} onSelect={setSelection}
        onStartDrag={setDrag} template={template} />

      <CanvasArea model={normalizedModel}
        fields={fields} setFields={setFields}
        selection={selection} setSelection={setSelection}
        currentPage={currentPage} setCurrentPage={setCurrentPage}
        totalPages={totalPages} setTotalPages={setTotalPages}
        zoom={zoom} setZoom={setZoom}
        drag={drag} setDrag={setDrag}
        onDropField={dropField}
        updateField={updateField} deleteField={deleteField} duplicateField={duplicateField}
        template={template} />

      <RightPropsPanel field={selectedField} model={normalizedModel}
        onUpdate={updateField} onDelete={deleteField} onDuplicate={duplicateField} />

      {drag && <DragGhost drag={drag} />}
    </div>
  );
}

function DragGhost({ drag }) {
  const [pos, setPos] = useState({ x: drag.clientX, y: drag.clientY });
  useEffect(() => {
    const m = (e) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', m);
    return () => window.removeEventListener('pointermove', m);
  }, []);
  return <div className="drag-ghost" style={{ left: pos.x, top: pos.y }}>{drag.label}</div>;
}

// ───────── Sidebar ─────────
function Sidebar({ model, activeTab, onTab, fields, selection, onSelect, onStartDrag, template }) {
  const tabs = [
    { id: 'fields',   icon: 'database', label: 'Fields'   },
    { id: 'elements', icon: 'type',     label: 'Elements' },
    { id: 'layers',   icon: 'layers',   label: 'Layers'   },
    { id: 'settings', icon: 'settings', label: 'Settings' },
  ];

  return (
    <aside style={{ width: 272, flexShrink: 0, borderRight: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 4px' }}>
        {tabs.map((t) => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => onTab(t.id)}
              style={{
                flex: 1, padding: '10px 4px 12px', fontSize: 11.5, fontWeight: 500,
                color: active ? 'var(--accent)' : 'var(--muted)',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                marginBottom: -1, transition: 'color .15s ease',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-2)'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--muted)'; }}>
              <Icon name={t.icon} size={16} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {activeTab === 'fields'   && <FieldsTab model={model} onStartDrag={onStartDrag} />}
        {activeTab === 'elements' && <ElementsTab onStartDrag={onStartDrag} />}
        {activeTab === 'layers'   && <LayersTab fields={fields} selection={selection} onSelect={onSelect} />}
        {activeTab === 'settings' && <SettingsTab model={model} template={template} />}
      </div>
    </aside>
  );
}

// Shared Filament-style input focus ring.
const fieldFocus = {
  onFocus: (e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-soft)'; },
  onBlur:  (e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; },
};
const filInput = {
  width: '100%', height: 36, padding: '0 12px', fontSize: 13,
  border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)',
  outline: 'none', transition: 'border-color .15s ease, box-shadow .15s ease',
};

// ───── Fields tab ─────
function FieldsTab({ model, onStartDrag }) {
  const [filter, setFilter] = useState('');
  const lc = filter.toLowerCase();
  const match = (f) => !lc || f.label.toLowerCase().includes(lc) || f.key.toLowerCase().includes(lc);
  const primary   = (model.fields || []).filter(match);
  const relations = Object.entries(model.relations || {}).map(([rk, r]) => ({
    ...r, key: rk, fields: (r.fields || []).filter(match),
  })).filter((r) => r.fields.length);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-2)' }} />
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search fields"
          {...fieldFocus}
          style={{ ...filInput, paddingLeft: 34 }} />
      </div>
      <FieldGroup title={model.name} fields={primary} onStartDrag={onStartDrag} />
      {relations.map((r) => (
        <FieldGroup key={r.key} title={r.label || r.key} subtitle="relation" fields={r.fields} onStartDrag={onStartDrag} />
      ))}
      {primary.length === 0 && relations.length === 0 && (
        <div style={{ padding: '32px 12px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          No fields match your search.
        </div>
      )}
    </div>
  );
}

function FieldGroup({ title, subtitle, fields, onStartDrag }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 6 }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
          borderRadius: 6, textAlign: 'left', transition: 'background .12s ease',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={12} style={{ color: 'var(--muted-2)', flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
          {(title || '').toString().replace(/_/g, ' ')}
        </span>
        {subtitle && (
          <span style={{
            fontWeight: 500, fontSize: 9.5, color: 'var(--muted)', textTransform: 'uppercase',
            letterSpacing: 0.5, padding: '2px 6px', borderRadius: 4, background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}>{subtitle}</span>
        )}
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2, paddingLeft: 4 }}>
          {fields.map((f) => <FieldChip key={f.key} field={f} onStartDrag={onStartDrag} />)}
        </div>
      )}
    </div>
  );
}

function FieldChip({ field, onStartDrag }) {
  const typeIcon = { text: 'type', longtext: 'type', number: 'hash', currency: 'hash', date: 'hash',
    image: 'image', signature: 'pen', table: 'layers' }[field.type] || 'type';
  const [hov, setHov] = useState(false);
  return (
    <div
      onPointerDown={(e) => onStartDrag({ kind: 'bound', bind: field.key, label: field.label, clientX: e.clientX, clientY: e.clientY })}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
        borderRadius: 6, cursor: 'grab', userSelect: 'none',
        background: hov ? 'var(--accent-soft)' : 'transparent',
        transition: 'background .12s ease',
      }}>
      <div style={{
        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
        background: hov ? 'var(--accent)' : 'var(--accent-soft)',
        color: hov ? '#fff' : 'var(--accent)',
        display: 'grid', placeItems: 'center', transition: 'all .12s ease',
      }}>
        <Icon name={typeIcon} size={12} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{field.label}</div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{field.key}</div>
      </div>
      <Icon name="move" size={12} style={{ color: 'var(--muted-2)', opacity: hov ? 0.7 : 0, flexShrink: 0, transition: 'opacity .12s ease' }} />
    </div>
  );
}

// ───── Elements tab ─────
const STATIC_ELEMENTS = [
  { kind: 'text',        label: 'Text',      icon: 'type'        },
  { kind: 'heading',     label: 'Heading',   icon: 'heading'     },
  { kind: 'divider',     label: 'Divider',   icon: 'minus'       },
  { kind: 'rect',        label: 'Rectangle', icon: 'square'      },
  { kind: 'image',       label: 'Image',     icon: 'image'       },
  { kind: 'signature',   label: 'Signature', icon: 'pen'         },
  { kind: 'checkbox',    label: 'Checkbox',  icon: 'check-square'},
  { kind: 'qr',          label: 'QR code',   icon: 'qr'          },
  { kind: 'page-number', label: 'Page #',    icon: 'hash'        },
];

function ElementsTab({ onStartDrag }) {
  return (
    <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {STATIC_ELEMENTS.map((el) => (
        <button key={el.kind}
          onPointerDown={(e) => onStartDrag({ kind: el.kind, label: el.label, clientX: e.clientX, clientY: e.clientY })}
          style={{
            padding: '16px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text-2)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'grab',
            transition: 'all .12s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-soft)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-2)'; }}>
          <Icon name={el.icon} size={18} />
          <div style={{ fontSize: 12, fontWeight: 500 }}>{el.label}</div>
        </button>
      ))}
    </div>
  );
}

// ───── Layers tab ─────
function LayersTab({ fields, selection, onSelect }) {
  const labelFor = (f) => f.kind === 'bound' ? f.bind
    : f.kind === 'text' || f.kind === 'heading' ? (f.text || 'Text')
    : f.kind.charAt(0).toUpperCase() + f.kind.slice(1);
  const icon = (k) => ({ bound: 'database', text: 'type', heading: 'heading', divider: 'minus',
    rect: 'square', image: 'image', signature: 'pen', checkbox: 'check-square', qr: 'qr', 'page-number': 'hash' }[k] || 'square');

  return (
    <div style={{ padding: 10 }}>
      {fields.length === 0 && (
        <div style={{ padding: '32px 12px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          No elements yet
          <div style={{ fontSize: 11.5, marginTop: 4, color: 'var(--muted-2)' }}>Drag fields or elements onto the canvas.</div>
        </div>
      )}
      {fields.slice().reverse().map((f) => {
        const sel = selection === f.id;
        return (
          <button key={f.id} onClick={() => onSelect(f.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
              borderRadius: 6, textAlign: 'left', marginBottom: 1,
              background: sel ? 'var(--accent-soft)' : 'transparent',
              color: sel ? 'var(--accent)' : 'var(--text-2)',
              transition: 'background .12s ease',
            }}
            onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = 'var(--surface-2)'; }}
            onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = 'transparent'; }}>
            <Icon name={icon(f.kind)} size={13} style={{ color: sel ? 'var(--accent)' : 'var(--muted)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              className={f.kind === 'bound' ? 'mono' : ''}>{labelFor(f)}</span>
            <span className="mono" style={{ fontSize: 10.5, color: sel ? 'var(--accent)' : 'var(--muted-2)' }}>{Math.round(f.w)}×{Math.round(f.h)}</span>
          </button>
        );
      })}
    </div>
  );
}

// ───── Settings tab ─────
function SettingsTab({ model, template }) {
  const Row = ({ label, hint, children }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>{hint}</div>}
    </div>
  );
  return (
    <div style={{ padding: 14 }}>
      <Row label="Template name">
        <input style={filInput} defaultValue={template.name} {...fieldFocus} />
      </Row>
      <Row label="Bound model">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px',
          border: '1px solid var(--border)', background: 'var(--surface-2)', borderRadius: 8 }}>
          <Icon name={model.icon} size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>{model.name}</span>
        </div>
      </Row>
      <Row label="Page size">
        <select style={filInput} defaultValue={template.page_size || 'Letter'} {...fieldFocus}>
          <option value="Letter">Letter (8.5 × 11 in)</option>
          <option value="A4">A4</option>
          <option value="Legal">Legal</option>
        </select>
      </Row>
      <Row label="Margins (pt)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {['T','R','B','L'].map((l) => (
            <div key={l} style={{ position: 'relative' }}>
              <input style={{ ...filInput, paddingLeft: 26 }} defaultValue="48" {...fieldFocus} />
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                fontSize: 10, color: 'var(--muted-2)', fontWeight: 700, pointerEvents: 'none' }}>{l}</span>
            </div>
          ))}
        </div>
      </Row>
      <Row label="Filename pattern" hint="Use {{token}} placeholders for dynamic values.">
        <input className="mono" style={{ ...filInput, fontSize: 12 }}
          defaultValue={template.filename_pattern || '{{id}}.pdf'} {...fieldFocus} />
      </Row>
    </div>
  );
}

function IconBtn({ name, title, onClick, active }) {
  return (
    <button onClick={onClick} title={title}
      style={{
        width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 6,
        color: active ? 'var(--accent)' : 'var(--muted)',
        background: active ? 'var(--accent-soft)' : 'transparent',
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text)'; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; } }}>
      <Icon name={name} size={16} />
    </button>
  );
}

export { BuilderView, btnGhost, IconBtn };
export const __builderHelpers = { PX_PER_PT, PAGE_W, PAGE_H };