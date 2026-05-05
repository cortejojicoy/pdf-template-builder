<?php

namespace Kukux\PdfTemplateBuilder\Filament\Actions;

use Filament\Actions\Action;
use Filament\Notifications\Notification;
use Kukux\PdfTemplateBuilder\Filament\Actions\Concerns\RendersPdfTemplate;

/**
 * Drop-in "Generate PDF" action for Filament view/edit pages.
 *
 * Usage on a ViewRecord / EditRecord page:
 *
 *   protected function getHeaderActions(): array
 *   {
 *       return [
 *           GeneratePdfAction::make('generatePdf')
 *               ->template('invoice-default'),
 *       ];
 *   }
 */
class GeneratePdfAction extends Action
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
