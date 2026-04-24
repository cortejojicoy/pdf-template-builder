<x-filament-panels::page>
    {{-- ── CSS Variables (light/dark mirror the prototype palette) ─────────────── --}}
    <style>
        :root {
            --pdf-bg:             #f7f7f8;
            --pdf-surface:        #ffffff;
            --pdf-surface-2:      #fafafa;
            --pdf-border:         #e5e7eb;
            --pdf-border-strong:  #d1d5db;
            --pdf-text:           #111827;
            --pdf-text-2:         #374151;
            --pdf-muted:          #6b7280;
            --pdf-muted-2:        #9ca3af;
            --pdf-accent:         #4f46e5;
            --pdf-accent-soft:    #eef2ff;
            --pdf-accent-hover:   #4338ca;
            --pdf-danger:         #dc2626;
            --pdf-success:        #059669;
            --pdf-warning:        #d97706;
            --pdf-selection:      rgba(79,70,229,.12);
            --pdf-selection-border: #4f46e5;
            --pdf-shadow-sm:      0 1px 2px rgba(0,0,0,.04);
            --pdf-shadow-md:      0 2px 8px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
            --pdf-shadow-lg:      0 10px 30px rgba(0,0,0,.08), 0 4px 12px rgba(0,0,0,.04);
        }
        .dark {
            --pdf-bg:             #0b0d12;
            --pdf-surface:        #12151c;
            --pdf-surface-2:      #171b24;
            --pdf-border:         #242a36;
            --pdf-border-strong:  #313849;
            --pdf-text:           #e5e7eb;
            --pdf-text-2:         #cbd5e1;
            --pdf-muted:          #94a3b8;
            --pdf-muted-2:        #64748b;
            --pdf-accent-soft:    #1e1b4b;
            --pdf-selection:      rgba(129,140,248,.18);
            --pdf-shadow-sm:      0 1px 2px rgba(0,0,0,.3);
            --pdf-shadow-md:      0 2px 8px rgba(0,0,0,.3), 0 1px 2px rgba(0,0,0,.2);
            --pdf-shadow-lg:      0 10px 30px rgba(0,0,0,.4), 0 4px 12px rgba(0,0,0,.2);
        }

        /* Remap the builder's var() calls to the prefixed vars above */
        #pdf-builder-root {
            --bg:               var(--pdf-bg);
            --surface:          var(--pdf-surface);
            --surface-2:        var(--pdf-surface-2);
            --border:           var(--pdf-border);
            --border-strong:    var(--pdf-border-strong);
            --text:             var(--pdf-text);
            --text-2:           var(--pdf-text-2);
            --muted:            var(--pdf-muted);
            --muted-2:          var(--pdf-muted-2);
            --accent:           var(--pdf-accent);
            --accent-soft:      var(--pdf-accent-soft);
            --accent-hover:     var(--pdf-accent-hover);
            --danger:           var(--pdf-danger);
            --success:          var(--pdf-success);
            --warning:          var(--pdf-warning);
            --selection:        var(--pdf-selection);
            --selection-border: var(--pdf-selection-border);
            --shadow-sm:        var(--pdf-shadow-sm);
            --shadow-md:        var(--pdf-shadow-md);
            --shadow-lg:        var(--pdf-shadow-lg);

            /* Full-height within the Filament content area */
            display: block;
            height: calc(100vh - 4rem);   /* minus Filament topbar ~4rem */
            overflow: hidden;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
        }
        #pdf-builder-root * { box-sizing: border-box; }
        #pdf-builder-root button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }
        #pdf-builder-root input, #pdf-builder-root select, #pdf-builder-root textarea { font-family: inherit; font-size: inherit; color: inherit; }
        #pdf-builder-root ::-webkit-scrollbar       { width: 10px; height: 10px; }
        #pdf-builder-root ::-webkit-scrollbar-track  { background: transparent; }
        #pdf-builder-root ::-webkit-scrollbar-thumb  { background: var(--border-strong); border-radius: 5px; border: 2px solid var(--surface); }
        #pdf-builder-root ::-webkit-scrollbar-thumb:hover { background: var(--muted-2); }
        #pdf-builder-root .drag-ghost {
            position: fixed; pointer-events: none; z-index: 9999;
            padding: 6px 10px; background: var(--accent); color: #fff;
            border-radius: 6px; font-size: 12px; font-weight: 500;
            box-shadow: var(--shadow-lg); transform: translate(-50%, -50%); white-space: nowrap;
        }
        #pdf-builder-root .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }

        /* Override Filament page padding so the builder fills the container */
        .fi-page { padding: 0 !important; }
        .fi-page > .fi-page-header { display: none !important; }
    </style>

    {{-- ── Bootstrap config for the React app ────────────────────────────────── --}}
    <script>
        window.__PDF_BUILDER__ = @json($builderConfig);
    </script>

    {{-- ── Mount point ─────────────────────────────────────────────────────────── --}}
    <div id="pdf-builder-root"></div>

    {{-- ── React + Babel (CDN) ─────────────────────────────────────────────────── --}}
    <script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" crossorigin></script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Caveat:wght@500&display=swap" rel="stylesheet" />

    {{-- ── Package JS assets (published to public/vendor/...) ─────────────────── --}}
    @php $base = asset('vendor/filament-pdf-template-builder/js'); @endphp

    <script type="text/babel" data-presets="react" src="{{ $base }}/icons.jsx"></script>
    <script type="text/babel" data-presets="react" src="{{ $base }}/builder.jsx"></script>
    <script type="text/babel" data-presets="react" src="{{ $base }}/canvas.jsx"></script>
    <script type="text/babel" data-presets="react" src="{{ $base }}/builder-app.jsx"></script>
</x-filament-panels::page>