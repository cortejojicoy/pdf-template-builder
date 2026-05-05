# Installation

## 1. Require the package

```bash
composer require kukux/pdf-template-builder
```

## 2. Run the migration

```bash
php artisan migrate
```

## 3. Publish assets

The builder UI is a React SPA served as static files. Publish them to your `public/` directory:

```bash
php artisan vendor:publish --tag=pdf-template-builder-assets
```

> Re-run this command after each package update to get the latest JS files.

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

## 6. (Optional) Configure storage

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

## Reading saved templates in your app

```php
use Kukux\PdfTemplateBuilder\Models\PdfTemplate;

$template = PdfTemplate::find(1);

// $template->fields — array of placed field definitions
// $template->model_key — e.g. 'invoice'
// $template->pages — page count
// $template->background_url — URL to the uploaded PDF
```

Use the `fields` array with a PDF generation library (e.g. [barryvdh/laravel-dompdf](https://github.com/barryvdh/laravel-dompdf), [spatie/laravel-pdf](https://github.com/spatie/laravel-pdf)) to render the final document.