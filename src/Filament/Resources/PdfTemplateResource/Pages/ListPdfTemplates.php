<?php

namespace Kukux\PdfTemplateBuilder\Filament\Resources\PdfTemplateResource\Pages;

use Filament\Actions;
use Filament\Resources\Pages\ListRecords;
use Kukux\PdfTemplateBuilder\Filament\Resources\PdfTemplateResource;

class ListPdfTemplates extends ListRecords
{
    protected static string $resource = PdfTemplateResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make()
                ->label('New template'),
        ];
    }
}