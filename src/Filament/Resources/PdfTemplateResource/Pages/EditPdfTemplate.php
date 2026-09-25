<?php

namespace Kukux\PdfTemplateBuilder\Filament\Resources\PdfTemplateResource\Pages;

use Filament\Actions\Action;
use Filament\Resources\Pages\Page;
use Kukux\PdfTemplateBuilder\Filament\Resources\PdfTemplateResource;
use Kukux\PdfTemplateBuilder\Models\PdfTemplate;
use Kukux\PdfTemplateBuilder\PdfTemplateBuilderPlugin;

/**
 * The builder page — Filament renders the chrome (breadcrumbs, heading and the
 * header buttons); the React canvas fills the rest of the viewport.
 *
 * The header buttons are deliberately client-side: the document being edited
 * lives in the browser, so a Livewire round-trip would have nothing to act on.
 * Each button dispatches a DOM event that the builder listens for.
 */
class EditPdfTemplate extends Page
{
    protected static string $resource = PdfTemplateResource::class;

    public PdfTemplate $record;

    public function getView(): string
    {
        return 'pdf-template-builder::pages.edit-pdf-template';
    }

    public function mount(int|string|PdfTemplate $record): void
    {
        $this->record = $record instanceof PdfTemplate
            ? $record
            : PdfTemplate::findOrFail($record);

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
                    'settings'        => $this->record->settings ?? [],
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

    public function getSubheading(): string|\Illuminate\Contracts\Support\Htmlable|null
    {
        $pages = (int) ($this->record->pages ?: 1);
        $count = count($this->record->fields ?? []);

        return sprintf(
            '%d %s · %d %s',
            $pages,
            $pages === 1 ? 'page' : 'pages',
            $count,
            $count === 1 ? 'element' : 'elements',
        );
    }

    public function getBreadcrumbs(): array
    {
        return [
            static::getResource()::getUrl('index') => static::getResource()::getPluralModelLabel(),
            $this->record->name,
        ];
    }

    /**
     * @return array<Action>
     */
    protected function getHeaderActions(): array
    {
        return [
            Action::make('shortcuts')
                ->label('Shortcuts')
                ->icon('heroicon-o-command-line')
                ->color('gray')
                ->url('#')
                ->extraAttributes($this->dispatchesBuilderEvent('shortcuts')),

            Action::make('preview')
                ->label('Preview')
                ->icon('heroicon-o-eye')
                ->color('gray')
                ->url('#')
                ->extraAttributes($this->dispatchesBuilderEvent('preview')),

            Action::make('save')
                ->label('Save template')
                ->icon('heroicon-o-check')
                ->url('#')
                ->extraAttributes($this->dispatchesBuilderEvent('save')),
        ];
    }

    /**
     * Inline handler so the click never leaves the browser — no Livewire
     * round-trip, and no dependency on Alpine being initialised here.
     *
     * @return array<string, string>
     */
    protected function dispatchesBuilderEvent(string $name): array
    {
        return [
            'onclick' => "event.preventDefault(); window.dispatchEvent(new CustomEvent('pdf-builder:{$name}'));",
            'data-pdf-builder-action' => $name,
        ];
    }
}
