// Alignment + snapping maths. All values are page points.

import { SNAP_PT } from './constants.js';

export const GRID_PT = 10;

/**
 * Build the set of lines a dragged box can snap to: other elements on the same
 * page, the page edges and centre, and the margin box.
 */
export function buildTargets(others, pageW, pageH, margins) {
  const v = [0, pageW / 2, pageW];
  const h = [0, pageH / 2, pageH];

  if (margins) {
    v.push(margins.left, pageW - margins.right);
    h.push(margins.top, pageH - margins.bottom);
  }

  others.forEach((f) => {
    v.push(f.x, f.x + f.w / 2, f.x + f.w);
    h.push(f.y, f.y + f.h / 2, f.y + f.h);
  });

  return { v, h };
}

/**
 * Snap a box to the nearest target lines.
 * Returns the adjusted position plus the guide lines that were hit.
 */
export function snapBox(x, y, w, h, targets, zoom) {
  // Keep the pull constant in screen pixels so it feels the same at any zoom.
  const t = SNAP_PT / Math.max(0.2, zoom);
  const edgesV = [x, x + w / 2, x + w];
  const edgesH = [y, y + h / 2, y + h];

  let bestV = null, bestH = null;

  targets.v.forEach((line) => {
    edgesV.forEach((edge) => {
      const d = line - edge;
      if (Math.abs(d) <= t && (!bestV || Math.abs(d) < Math.abs(bestV.d))) bestV = { d, line };
    });
  });
  targets.h.forEach((line) => {
    edgesH.forEach((edge) => {
      const d = line - edge;
      if (Math.abs(d) <= t && (!bestH || Math.abs(d) < Math.abs(bestH.d))) bestH = { d, line };
    });
  });

  return {
    x: x + (bestV ? bestV.d : 0),
    y: y + (bestH ? bestH.d : 0),
    guides: {
      v: bestV ? [bestV.line] : [],
      h: bestH ? [bestH.line] : [],
    },
  };
}

export const snapToGrid = (v) => Math.round(v / GRID_PT) * GRID_PT;

/** Do two boxes overlap? Used by marquee selection. */
export function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Bounding box of a set of fields. */
export function boundsOf(fields) {
  if (!fields.length) return null;
  const x1 = Math.min(...fields.map((f) => f.x));
  const y1 = Math.min(...fields.map((f) => f.y));
  const x2 = Math.max(...fields.map((f) => f.x + f.w));
  const y2 = Math.max(...fields.map((f) => f.y + f.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
