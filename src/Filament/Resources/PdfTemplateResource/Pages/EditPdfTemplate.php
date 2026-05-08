<?php

namespace Kukux\PdfTemplateBuilder\Filament\Resources\PdfTemplateResource\Pages;

use Filament\Resources\Pages\Page;
use Illuminate\Database\Eloquent\Model;
use Kukux\PdfTemplateBuilder\Filament\Resources\PdfTemplateResource;
use Kukux\PdfTemplateBuilder\Models\PdfTemplate;
use Kukux\PdfTemplateBuilder\PdfTemplateBuilderPlugin;

/**
 * Full-screen builder page — renders the React PDF canvas editor.
 * Filament handles auth; all data I/O goes through the JSON API
 * routes registered by the package.
 */
class EditPdfTemplate extends Page
{
    protected static string $resource = PdfTemplateResource::class;

    public PdfTemplate $record;

    public function getView(): string
    {
        return 'pdf-template-builder::pages.edit-pdf-template';
    }

    public function mount(int|string $record): void
    {
        $this->record = PdfTemplate::findOrFail($record);

        static::authorizeResourceAccess();
    }

    /**
     * Data passed to the Blade view and forwarded to JavaScript.
     */
    public function getViewData(): array
    {
        /** @var PdfTemplateBuilderPlugin $plugin */
        $plugin = filament()->getPlugin('pdf-template-builder');

        return [
            'record'       => $this->record,
            'builderConfig' => [
                'templateId'   => $this->record->id,
                'template'     => [
                    'id'              => $this->record->id,
                    'name'            => $this->record->name,
                    'model_key'       => $this->record->model_key,
                    'page_size'       => $this->record->page_size,
                    'orientation'     => $this->record->orientation,
                    'pages'           => $this->record->pages,
                    'filename_pattern'=> $this->record->filename_pattern,
                    'fields'          => $this->record->fields ?? [],
                    'background_url'  => $this->record->background_url,
                ],
                'models'       => $plugin->getModels(),
                'apiBase'      => route('pdf-builder.api.base'),
                'csrfToken'    => csrf_token(),
                'listUrl'      => static::getResource()::getUrl('index'),
                'assetBase'    => asset('vendor/pdf-template-builder'),
            ],
        ];
    }

    public function getTitle(): string|\Illuminate\Contracts\Support\Htmlable
    {
        return $this->record->name;
    }

    public function getBreadcrumbs(): array
    {
        return [
            static::getResource()::getUrl('index') => 'PDF Templates',
            '#' => $this->record->name,
        ];
    }
}