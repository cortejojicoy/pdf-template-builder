// Shared geometry, element defaults and small helpers.

export const PAGE_SIZES = {
  Letter: { w: 612,    h: 792,    label: 'Letter (8.5 × 11 in)' },
  A4:     { w: 595.28, h: 841.89, label: 'A4 (210 × 297 mm)'    },
  Legal:  { w: 612,    h: 1008,   label: 'Legal (8.5 × 14 in)'  },
};

/** Point dimensions of a page for the given size + orientation. */
export function pageDims(size, orientation) {
  const s = PAGE_SIZES[size] || PAGE_SIZES.Letter;
  return orientation === 'landscape' ? { w: s.h, h: s.w } : { w: s.w, h: s.h };
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const SNAP_PT  = 5;   // snap / guide threshold, in page points
export const NUDGE    = 1;
export const NUDGE_BIG = 10;

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

let seq = 0;
export const uid = () => `f${Date.now().toString(36)}${(seq++).toString(36)}`;

export const DEFAULT_MARGINS = { top: 48, right: 48, bottom: 48, left: 48 };

/** Element palette — also used to build a dropped field's defaults. */
export const ELEMENT_DEFS = {
  text:          { label: 'Text',      icon: 'type',         w: 140, h: 18, make: () => ({ text: 'Text', fontSize: 11 }) },
  heading:       { label: 'Heading',   icon: 'heading',      w: 180, h: 28, make: () => ({ text: 'Heading', fontSize: 18, bold: true }) },
  divider:       { label: 'Divider',   icon: 'minus',        w: 200, h: 1,  make: () => ({}) },
  rect:          { label: 'Rectangle', icon: 'square',       w: 160, h: 60, make: () => ({ fill: '#f3f4f6' }) },
  image:         { label: 'Image',     icon: 'image',        w: 120, h: 80, make: () => ({}) },
  signature:     { label: 'Signature', icon: 'pen',          w: 200, h: 60, make: () => ({}) },
  checkbox:      { label: 'Checkbox',  icon: 'check-square', w: 16,  h: 16, make: () => ({}) },
  qr:            { label: 'QR code',   icon: 'qr',           w: 80,  h: 80, make: () => ({}) },
  'page-number': { label: 'Page #',    icon: 'hash',         w: 60,  h: 14, make: () => ({ fontSize: 9, align: 'center', color: '#9ca3af' }) },
  bound:         { label: 'Field',     icon: 'database',     w: 140, h: 18, make: () => ({ fontSize: 11 }) },
};

export const KIND_LABEL = {
  bound: 'Bound Field', text: 'Text', heading: 'Heading', divider: 'Divider',
  rect: 'Rectangle', image: 'Image', signature: 'Signature',
  checkbox: 'Checkbox', qr: 'QR Code', 'page-number': 'Page Number',
};

export const KIND_ICON = {
  bound: 'database', text: 'type', heading: 'heading', divider: 'minus', rect: 'square',
  image: 'image', signature: 'pen', checkbox: 'check-square', qr: 'qr', 'page-number': 'hash',
};

/** Build a new field of `kind` positioned at (x, y) on `page`. */
export function makeField(kind, { x, y, page, bind, label }) {
  const def = ELEMENT_DEFS[kind] || ELEMENT_DEFS.text;
  return {
    id: uid(),
    kind,
    page,
    x: Math.round(x),
    y: Math.round(y),
    w: def.w,
    h: def.h,
    ...def.make(),
    ...(kind === 'bound' ? { bind } : null),
    ...(kind === 'signature' && label ? { label } : null),
  };
}

/** True when the event target is a place where the user is typing. */
export function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
