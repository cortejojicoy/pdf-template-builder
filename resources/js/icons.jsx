(function () {
  const ICONS = {
    'database':      'M12 2C7.03 2 3 3.12 3 4.5v3C3 8.88 7.03 10 12 10s9-1.12 9-2.5v-3C21 3.12 16.97 2 12 2zM3 7.5v3C3 11.88 7.03 13 12 13s9-1.12 9-2.5v-3M3 10.5v3C3 14.88 7.03 16 12 16s9-1.12 9-2.5v-3M3 13.5V17c0 1.38 4.03 2.5 9 2.5s9-1.12 9-2.5v-3.5',
    'type':          'M4 7V4h16v3M9 20h6M12 4v16',
    'layers':        'M12 2l9 4.5-9 4.5-9-4.5L12 2zM3 12l9 4.5 9-4.5M3 17l9 4.5 9-4.5',
    'settings':      'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
    'search':        'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35',
    'chevron-down':  'M6 9l6 6 6-6',
    'chevron-right': 'M9 18l6-6-6-6',
    'chevron-left':  'M15 18l-6-6 6-6',
    'move':          'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20',
    'minus':         'M5 12h14',
    'square':        'M3 3h18v18H3z',
    'image':         'M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21',
    'pen':           'M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z',
    'check-square':  'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
    'check':         'M20 6L9 17l-5-5',
    'qr':            'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h.01M17 14h.01M20 14h.01M14 17h.01M17 17h3v3M20 20h.01',
    'hash':          'M4 9h16M4 15h16M10 3L8 21M16 3l-2 18',
    'eye':           'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z',
    'save':          'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8',
    'zoom-out':      'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35M8 11h6',
    'zoom-in':       'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35M11 8v6M8 11h6',
    'file-pdf':      'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h1a2 2 0 010 4H9v-4zM14 13h2M14 17h2',
    'plus':          'M12 5v14M5 12h14',
    'mouse-pointer': 'M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3zM13 13l6 6',
    'copy':          'M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1',
    'trash':         'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
    'heading':       'M4 6h16M4 12h16M4 18h10',
    'align-left':    'M3 6h18M3 12h10M3 18h14',
    'align-center':  'M3 6h18M6 12h12M4 18h16',
    'align-right':   'M3 6h18M10 12h11M6 18h15',
  };

  function Icon({ name, size = 16, style, className }) {
    const d = ICONS[name];
    if (!d) return null;
    return (
      <svg viewBox="0 0 24 24" width={size} height={size}
        style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
        aria-hidden="true" className={className}>
        <path d={d} fill="none" stroke="currentColor" strokeWidth={1.75}
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  window.Icon = Icon;
})();
