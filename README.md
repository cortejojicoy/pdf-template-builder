# PDF Template Builder

[![Latest Version on Packagist](https://img.shields.io/packagist/v/kukux/pdf-template-builder.svg?style=flat-square)](https://packagist.org/packages/kukux/pdf-template-builder)
[![Total Downloads](https://img.shields.io/packagist/dt/kukux/pdf-template-builder.svg?style=flat-square)](https://packagist.org/packages/kukux/pdf-template-builder)
[![License](https://img.shields.io/packagist/l/kukux/pdf-template-builder.svg?style=flat-square)](https://packagist.org/packages/kukux/pdf-template-builder)

# Installation

## 1. Require the package

```bash
composer require kukux/pdf-template-builder
```

## 2. Publish and run the migrations

```bash
php artisan vendor:publish --tag=pdf-template-builder-migrations
php artisan migrate
```

> Upgrading from an earlier version? Re-publish and migrate — `add_settings_to_pdf_templates_table`
> adds the `settings` column that stores page margins. The builder degrades gracefully
> until you do: margins simply aren't persisted.

## 3. Publish assets

The builder UI is a React SPA bundled with Vite. The package ships pre-built JS in `resources/dist/`. Publish to `public/`:

```bash
php artisan vendor:publish --tag=pdf-template-builder-assets
```

> Re-run this command after each package update to get the latest bundle.

**For maintainers / contributors** — to rebuild the bundle from JSX source:

```bash
npm install
npm run build      # one-shot build → resources/dist/pdf-builder.js
npm run dev        # rebuild on save
```

## ⓘ Filament v3 / v4 / v5 auto-detection

The plugin ships two parallel Resource implementations and aliases the canonical class name to the right one based on the Filament major version installed in your project.

| Detected | Class actually loaded |
|---|---|
| Filament v3 (no `Filament\Schemas\Schema` class) | `Kukux\PdfTemplateBuilder\Filament\Resources\V3\PdfTemplateResource` |
| Filament v4 / v5 (`Filament\Schemas\Schema` exists) | `Kukux\PdfTemplateBuilder\Filament\Resources\V4\PdfTemplateResource` |

Detection happens in `PdfTemplateBuilderServiceProvider::register()` via `class_alias`, before Filament's panel resolves any resource. You always reference the canonical `Kukux\PdfTemplateBuilder\Filament\Resources\PdfTemplateResource::class` — never the V3/V4 variants directly.

If you ever see `Class "Kukux\…\PdfTemplateResource" not found` after upgrading, run `composer dump-autoload`. PSR-4 lookup needs to miss so the alias can be consulted, and a stale optimized classmap can short-circuit that.

## 4. Register the plugin in your Filament panel

In your `PanelProvider` (e.g. `app/Providers/Filament/AdminPanelProvider.php`):

```php
use Kukux\PdfTemplateBuilder\PdfTemplateBuilderPlugin;

public function panel(Panel $panel): Panel
{
    return $panel
        // ...your existing config...
        ->plugin(
            PdfTemplateBuilderPlugin::make()
        );
}
```

## 5. Register your models (optional but recommended)

Configure the Eloquent models whose fields will appear in the builder sidebar:

```php
->plugin(
    PdfTemplateBuilderPlugin::make()
        ->models([
            'invoice' => [
                'label'  => 'Invoice',
                'icon'   => 'receipt',
                'class'  => App\Models\Invoice::class,
                'fields' => [
                    ['key' => 'invoice.number',    'label' => 'Number',    'type' => 'text',     'sample' => 'INV-0001'],
                    ['key' => 'invoice.issued_at', 'label' => 'Issued at', 'type' => 'date',     'sample' => 'Jan 1, 2026'],
                    ['key' => 'invoice.due_at',    'label' => 'Due at',    'type' => 'date',     'sample' => 'Feb 1, 2026'],
                    ['key' => 'invoice.subtotal',  'label' => 'Subtotal',  'type' => 'currency', 'sample' => '$1,000.00'],
                    ['key' => 'invoice.tax',       'label' => 'Tax',       'type' => 'currency', 'sample' => '$100.00'],
                    ['key' => 'invoice.total',     'label' => 'Total',     'type' => 'currency', 'sample' => '$1,100.00'],
                    ['key' => 'invoice.notes',     'label' => 'Notes',     'type' => 'longtext', 'sample' => 'Thank you.'],
                    ['key' => 'invoice.line_items','label' => 'Line items','type' => 'table',    'sample' => '[table]'],
                ],
                'relations' => [
                    'customer' => [
                        'label'  => 'Customer',
                        'fields' => [
                            ['key' => 'customer.name',    'label' => 'Name',    'type' => 'text',     'sample' => 'Acme Inc.'],
                            ['key' => 'customer.email',   'label' => 'Email',   'type' => 'text',     'sample' => 'hi@acme.co'],
                            ['key' => 'customer.address', 'label' => 'Address', 'type' => 'longtext', 'sample' => '221B Baker St'],
                        ],
                    ],
                ],
            ],
        ])
)
```

Alternatively, configure them in `config/pdf-template-builder.php` after publishing the config:

```bash
php artisan vendor:publish --tag=pdf-template-builder-config
```

### Descriptor keys

| Key | Required | What it does |
|---|---|---|
| `label` | yes | Heading shown above the field palette |
| `icon` | no | Palette icon name |
| `class` | no | Eloquent class, used when rendering |
| `fields` | yes | The draggable bound fields |
| `relations` | no | Grouped sub-field lists |
| `background` | no | Canvas backdrop when no background PDF is uploaded |

`background` is a URL the canvas loads behind the fields — typically a route in
your app that renders the blank form the template stamps onto, so a designer
never has to upload one by hand. It is used only when the template has no
uploaded background of its own.

The token `{used_in}` in that URL is replaced with the template's `used_in`
value, letting one descriptor serve several variants of the same document:

```php
'background' => url('/forms/blank') . '?type={used_in}',
```

A template tagged `used_in = "ics"` then loads `/forms/blank?type=ics`. Serve a
PDF or an image — the canvas renders PDFs with pdf.js.

## Embedding the builder in your own page

The builder reads everything from `window.__PDF_BUILDER__`, so any Filament page
can host it: render `pdf-template-builder::pages.edit-pdf-template` with your own
`$builderConfig`. Beyond the keys the template editor passes, four make the
canvas editable against something other than a template:

| Key | What it does |
|---|---|
| `saveUrl` | Where a save PUTs, instead of the template endpoint. Same payload shape |
| `resetUrl` | DELETEd by the `pdf-builder:reset` event, then the page reloads |
| `allowedKeys` | Field keys the palette is limited to; relations are hidden |
| `mode` | `'placement'` hides the Elements and Settings tabs — boxes move, the template is not edited |

Enforce `allowedKeys` at your `saveUrl` too. It narrows the UI, not the request.

Your page renders its own header buttons; they reach the builder through DOM
events — `pdf-builder:save`, `pdf-builder:reset`, `pdf-builder:shortcuts` and
`pdf-builder:preview`. Skip Preview unless the record being edited really is a
`PdfTemplate`, since it resolves the id against the template endpoint.

## 6. (Optional) Customize sidebar navigation

You can place the "PDF Templates" entry inside a Filament navigation group and control its sort order:

```php
->plugin(
    PdfTemplateBuilderPlugin::make()
        ->navigationGroup('Documents') // must be a string, never null
        ->navigationSort(50)
)
```

Or via the published config (`config/pdf-template-builder.php`):

```php
'navigation_group' => 'Documents', // string only — leave as '' to disable grouping, do NOT set to null
```

> **Heads up — avoid this error**
>
> ```
> Kukux\PdfTemplateBuilder\PdfTemplateBuilderPlugin::getNavigationGroup():
> Return value must be of type string, null returned
> ```
>
> This is thrown when `config('pdf-template-builder.navigation_group')` resolves to `null`. To prevent it:
>
> - If you published the config before v1.2.0, open `config/pdf-template-builder.php` and change `'navigation_group' => null` to `'navigation_group' => ''` (or to your preferred group name).
> - Or set `PDF_TEMPLATE_NAVIGATION_GROUP=""` in your `.env` rather than leaving it unset.
> - Or call `->navigationGroup('')` explicitly when registering the plugin.
>
> The same applies if you override the value at runtime — always pass a string, never `null`.

## 7. (Optional) Configure storage

By default PDF backgrounds are stored on the `public` disk under `pdf-templates/backgrounds/`. Override via the plugin or `.env`:

```env
PDF_TEMPLATE_DISK=s3
```

Or via the plugin:

```php
PdfTemplateBuilderPlugin::make()->disk('s3')->uploadPath('my-path/pdfs')
```

---

## What gets added to your app

- **Navigation**: A "PDF Templates" item in your Filament sidebar.
- **Template list**: Browse, search, and filter saved templates.
- **Create form**: Upload a background PDF, pick a model, set page size.
- **Visual builder**: Drag fields from the sidebar onto the PDF canvas, resize them, style their typography, and save the layout.
- **API routes** at `/filament-pdf-builder/api/*` (web + auth middleware).
- **`pdf_templates` table** in your database.

## Using the builder

The page chrome — breadcrumbs, heading and the **Shortcuts / Preview / Save template**
buttons — is rendered by Filament, so it inherits your panel's theme. Those buttons drive
the React canvas through DOM events (`pdf-builder:save`, `pdf-builder:preview`,
`pdf-builder:shortcuts`), which keeps the click client-side: the document being edited
lives in the browser, so there is nothing for a Livewire round-trip to act on.

### Canvas

| Gesture | Result |
| --- | --- |
| Scroll / ⇧+scroll | Move through the document / sideways |
| ⌘ or Ctrl + scroll, or trackpad pinch | Zoom, anchored at the pointer |
| Space-drag, or middle-drag | Pan |
| Drag on empty space | Marquee-select |
| ⇧+click | Add to or remove from the selection |
| Alt-drag | Clone the selection |
| ⇧ while resizing | Keep the aspect ratio |
| Alt while resizing | Resize from the centre |
| Alt while dragging | Ignore snapping |
| Right-click | Context menu (element or page) |

Elements snap to each other, to the page edges and centre, and to the margin box.
Toggle snapping, rulers, the grid and the margin guides from the canvas toolbar.

### Pages

Add, duplicate, reorder and delete pages from the thumbnail rail, the canvas toolbar, the
strip under each page, or the right-click menu. Deleting a page removes its elements and
shifts later pages up; if the page isn't empty you're asked to confirm first, and ⌘Z undoes
it either way.

### Keyboard shortcuts

Press <kbd>?</kbd> in the builder for the full list. The everyday ones:

| Keys | Action |
| --- | --- |
| ⌘S | Save template |
| ⌘Z / ⌘⇧Z | Undo / redo |
| ⌘C, ⌘X, ⌘V, ⌘D | Copy, cut, paste, duplicate |
| ⌫ | Delete selection |
| ⌘A / Esc | Select all on page / deselect |
| ← ↑ → ↓ | Nudge 1 pt (⇧ for 10 pt) |
| ⌘] / ⌘[ | Bring forward / send backward (⇧ for front / back) |
| ⌘0 / ⌘1 / ⌘2 | Fit page / 100% / fit width |
| ⌘+ / ⌘− | Zoom in / out |
| R / G / S | Rulers / grid / snapping |
| PgUp / PgDn | Previous / next page |
| ⌘⇧N / ⌘⇧⌫ | Add / delete page |
| ⌘⇧P | Preview PDF |

On Windows and Linux, Ctrl replaces ⌘.

## Generating PDFs

### 1. Install a PDF engine (optional but recommended)

The plugin auto-detects [`dompdf/dompdf`](https://github.com/dompdf/dompdf) and uses it for output. Without it, `render()` falls back to HTML (browser print → save as PDF still works).

```bash
composer require dompdf/dompdf
```

### 2. Drop a "Generate PDF" button into any Filament page

**On a ViewRecord / EditRecord page (header action):**

```php
use Kukux\PdfTemplateBuilder\Filament\Actions\GeneratePdfAction;

protected function getHeaderActions(): array
{
    return [
        GeneratePdfAction::make()
            ->template('invoice-default'),  // by template name
    ];
}
```

**As a row action on a Resource table:**

```php
use Kukux\PdfTemplateBuilder\Filament\Actions\GeneratePdfTableAction;

->actions([
    GeneratePdfTableAction::make()
        ->template(1),                       // by template id
])
```

**Dynamic template selection:**

```php
GeneratePdfAction::make()
    ->templateUsing(fn ($record) => $record->is_quote ? 'quote' : 'invoice')
    ->withContexts(fn ($record) => ['org' => $record->organization]);
```

### 3. Programmatic rendering

```php
use Kukux\PdfTemplateBuilder\Models\PdfTemplate;

$template = PdfTemplate::where('name', 'invoice-default')->firstOrFail();
$invoice  = Invoice::find(42);

// Get the response (PDF if dompdf is installed, else HTML)
return $template->stream($invoice);

// Or just the rendered HTML:
$html = $template->render($invoice);
```

### 4. Field token resolution

Fields placed in the builder have a `key` like `invoice.number` or `customer.email`. At render time:

- The leading segment matching the template's `model_key` is stripped, then the remainder is resolved against the record via `data_get()`.
- Otherwise the full key is resolved against the record (so relations work: `customer.name` → `$invoice->customer->name`).
- Pass extra named contexts via `->withContexts(['org' => $org])` and reference them with `org.name` in field tokens.

### 5. Choosing a PDF engine

The plugin ships three engines. Pick based on your needs:

| Engine | When to use | Requires |
|---|---|---|
| `HtmlEngine` *(default fallback)* | Quick preview; user prints to PDF from browser. | — |
| `DompdfEngine` *(auto-detected)* | Generic HTML→PDF. Good for templates with no background or simple backgrounds. | `composer require dompdf/dompdf` |
| `FpdiEngine` | **You uploaded a designed PDF as the background and want the original PDF preserved exactly.** Stamps fields directly onto the original page. | `composer require setasign/fpdi tecnickcom/tcpdf` |

Wire your choice on the plugin:

```php
use Kukux\PdfTemplateBuilder\Rendering\Engines\FpdiEngine;

PdfTemplateBuilderPlugin::make()->engine(FpdiEngine::class)
```

You can also implement `Kukux\PdfTemplateBuilder\Rendering\Contracts\PdfEngine` (or `TemplateAwarePdfEngine` for non-HTML pipelines like Browsershot) and register your own.

### 6. Running the test suite

```bash
composer install
vendor/bin/pest
```

The package ships with Pest tests covering routes, the field resolver, the HTML renderer, the filename pattern, and basic model persistence. Run them after every change.

### 7. Authorization

Templates use a default-permissive `PdfTemplatePolicy`. Override it in your `AuthServiceProvider`:

```php
Gate::policy(
    \Kukux\PdfTemplateBuilder\Models\PdfTemplate::class,
    \App\Policies\PdfTemplatePolicy::class,
);
```
