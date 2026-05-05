<?php

namespace Kukux\PdfTemplateBuilder\Filament\Actions;

use Filament\Notifications\Notification;
use Filament\Tables\Actions\Action;
use Kukux\PdfTemplateBuilder\Filament\Actions\Concerns\RendersPdfTemplate;

/**
 * Drop-in "Generate PDF" row action for Filament tables.
 *
 * Usage in a Resource's table():
 *
 *   ->actions([
 *       GeneratePdfTableAction::make('generatePdf')
 *           ->template('invoice-default'),
 *   ])
 */
class GeneratePdfTableAction extends Action
{
    use RendersPdfTemplate;

    public static function getDefaultName(): ?string
    {
        return 'generatePdf';
    }

    protected function setUp(): void
    {
        parent::setUp();

        $this->configureDefaults();

        $this->action(function (mixed $record) {
            $template = $this->resolveTemplate($record);

            if (! $template) {
                Notification::make()
                    ->title('No PDF template configured')
                    ->danger()
                    ->send();

                return null;
            }

            return $template->stream($record, $this->resolveContexts($record));
        });
    }
}
