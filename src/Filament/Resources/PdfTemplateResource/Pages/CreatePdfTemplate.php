<?php

namespace Kukux\PdfTemplateBuilder\Filament\Resources\PdfTemplateResource\Pages;

use Filament\Resources\Pages\CreateRecord;
use Kukux\PdfTemplateBuilder\Filament\Resources\PdfTemplateResource;

class CreatePdfTemplate extends CreateRecord
{
    protected static string $resource = PdfTemplateResource::class;

    protected function getRedirectUrl(): string
    {
        return static::getResource()::getUrl('edit', ['record' => $this->getRecord()]);
    }

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['fields'] = [];
        $data['disk']   = filament()->getPlugin('pdf-template-builder')->getDisk();

        return $data;
    }
}