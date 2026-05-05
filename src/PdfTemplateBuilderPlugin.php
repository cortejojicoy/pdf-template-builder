<?php

namespace Kukux\PdfTemplateBuilder;

use Filament\Contracts\Plugin;
use Filament\Panel;
use Kukux\PdfTemplateBuilder\Filament\Resources\PdfTemplateResource;
use Kukux\PdfTemplateBuilder\Rendering\Contracts\PdfEngine;

class PdfTemplateBuilderPlugin implements Plugin
{
    protected array $models = [];
    protected string $disk = 'public';
    protected string $uploadPath = 'pdf-templates/backgrounds';
    protected string $navigationGroup = '';
    protected ?int $navigationSort = null;
    protected string|PdfEngine|null $engine = null;

    public static function make(): static
    {
        return app(static::class);
    }

    public function getId(): string
    {
        return 'pdf-template-builder';
    }

    public function register(Panel $panel): void
    {
        $panel->resources([PdfTemplateResource::class]);
    }

    public function boot(Panel $panel): void {}

    /**
     * Register Eloquent models and their field definitions with the builder.
     *
     * Example:
     * PdfTemplateBuilderPlugin::make()->models([
     *     'invoice' => [
     *         'label' => 'Invoice',
     *         'class' => App\Models\Invoice::class,
     *         'icon'  => 'heroicon-o-document-text',
     *         'fields' => [
     *             ['key' => 'invoice.number', 'label' => 'Number', 'type' => 'text'],
     *             ['key' => 'invoice.total',  'label' => 'Total',  'type' => 'currency'],
     *         ],
     *         'relations' => [
     *             'customer' => [
     *                 'label' => 'Customer',
     *                 'fields' => [
     *                     ['key' => 'customer.name', 'label' => 'Name', 'type' => 'text'],
     *                 ],
     *             ],
     *         ],
     *     ],
     * ])
     */
    public function models(array $models): static
    {
        $this->models = $models;

        return $this;
    }

    public function getModels(): array
    {
        if (! empty($this->models)) {
            return $this->models;
        }

        return config('pdf-template-builder.models', $this->defaultModels());
    }

    /** Storage disk for uploaded PDF backgrounds. */
    public function disk(string $disk): static
    {
        $this->disk = $disk;

        return $this;
    }

    public function getDisk(): string
    {
        return $this->disk;
    }

    /** Path within the disk where PDFs are stored. */
    public function uploadPath(string $path): static
    {
        $this->uploadPath = $path;

        return $this;
    }

    public function getUploadPath(): string
    {
        return $this->uploadPath;
    }

    public function navigationGroup(string $group): static
    {
        $this->navigationGroup = $group;

        return $this;
    }

    public function getNavigationGroup(): string
    {
        return $this->navigationGroup ?: config('pdf-template-builder.navigation_group', '');
    }

    public function navigationSort(int $sort): static
    {
        $this->navigationSort = $sort;

        return $this;
    }

    public function getNavigationSort(): ?int
    {
        return $this->navigationSort;
    }

    /**
     * Override the PDF engine. Pass an instance, a class name, or null to use auto-detection.
     */
    public function engine(string|PdfEngine|null $engine): static
    {
        $this->engine = $engine;

        if ($engine !== null) {
            app()->bind(PdfEngine::class, fn () => is_string($engine) ? app($engine) : $engine);
        }

        return $this;
    }

    protected function defaultModels(): array
    {
        return [
            'invoice' => [
                'label' => 'Invoice',
                'icon'  => 'receipt',
                'fields' => [
                    ['key' => 'invoice.number',    'label' => 'Number',    'type' => 'text',     'sample' => 'INV-2026-0001'],
                    ['key' => 'invoice.issued_at', 'label' => 'Issued at', 'type' => 'date',     'sample' => 'Apr 21, 2026'],
                    ['key' => 'invoice.due_at',    'label' => 'Due at',    'type' => 'date',     'sample' => 'May 21, 2026'],
                    ['key' => 'invoice.subtotal',  'label' => 'Subtotal',  'type' => 'currency', 'sample' => '$12,450.00'],
                    ['key' => 'invoice.tax',       'label' => 'Tax',       'type' => 'currency', 'sample' => '$996.00'],
                    ['key' => 'invoice.total',     'label' => 'Total',     'type' => 'currency', 'sample' => '$13,446.00'],
                    ['key' => 'invoice.notes',     'label' => 'Notes',     'type' => 'longtext', 'sample' => 'Payment due within 30 days.'],
                    ['key' => 'invoice.line_items','label' => 'Line items','type' => 'table',    'sample' => '[table]'],
                ],
            ],
        ];
    }
}