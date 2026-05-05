<?php

namespace Kukux\PdfTemplateBuilder\Filament\Resources;

use Filament\Forms;
use Filament\Resources\Resource;
use Filament\Tables;
use Kukux\PdfTemplateBuilder\Filament\Resources\PdfTemplateResource\Pages;
use Kukux\PdfTemplateBuilder\Models\PdfTemplate;
use Kukux\PdfTemplateBuilder\PdfTemplateBuilderPlugin;

class PdfTemplateResource extends Resource
{
    protected static ?string $model = PdfTemplate::class;

    protected static ?string $navigationIcon = 'heroicon-o-document-text';

    protected static ?string $navigationLabel = 'PDF Templates';

    protected static ?string $modelLabel = 'PDF Template';

    protected static ?string $pluralModelLabel = 'PDF Templates';

    public static function getNavigationGroup(): ?string
    {
        return static::getPlugin()->getNavigationGroup() ?: null;
    }

    public static function getNavigationSort(): ?int
    {
        return static::getPlugin()->getNavigationSort();
    }

    /**
     * Cross-version form definition.
     *
     * Filament v3 passes \Filament\Forms\Form, v4/v5 pass \Filament\Schemas\Schema.
     * Both expose ->schema([...]) returning $this, so we drop the strict type hint
     * and rely on the shared fluent API.
     */
    public static function form($form)
    {
        $plugin  = static::getPlugin();
        $models  = $plugin->getModels();
        $options = collect($models)->mapWithKeys(fn ($m, $k) => [$k => $m['label'] ?? $k])->all();

        return $form->schema([
            Forms\Components\Section::make('Template Details')
                ->schema([
                    Forms\Components\TextInput::make('name')
                        ->label('Template name')
                        ->required()
                        ->maxLength(255)
                        ->columnSpanFull(),

                    Forms\Components\Select::make('model_key')
                        ->label('Bind to model')
                        ->options($options)
                        ->required()
                        ->default(array_key_first($options)),

                    Forms\Components\Select::make('page_size')
                        ->label('Page size')
                        ->options([
                            'Letter' => 'Letter (8.5 × 11 in)',
                            'A4'     => 'A4 (210 × 297 mm)',
                            'Legal'  => 'Legal (8.5 × 14 in)',
                        ])
                        ->default('Letter'),

                    Forms\Components\Select::make('orientation')
                        ->label('Orientation')
                        ->options([
                            'portrait'  => 'Portrait',
                            'landscape' => 'Landscape',
                        ])
                        ->default('portrait'),

                    Forms\Components\TextInput::make('filename_pattern')
                        ->label('Filename pattern')
                        ->placeholder('{{id}}.pdf')
                        ->default('{{id}}.pdf')
                        ->helperText('Use {{field}} tokens from the bound model.')
                        ->columnSpanFull(),
                ])
                ->columns(3),

            Forms\Components\Section::make('Background PDF')
                ->description('Upload a PDF to use as the page background. Leave blank to start with a blank canvas.')
                ->schema([
                    Forms\Components\FileUpload::make('background_pdf')
                        ->label('Background PDF')
                        ->acceptedFileTypes(['application/pdf'])
                        ->disk(fn () => static::getPlugin()->getDisk())
                        ->directory(fn () => static::getPlugin()->getUploadPath())
                        ->maxSize(10240)
                        ->helperText('Max 10 MB.')
                        ->columnSpanFull(),
                ]),
        ]);
    }

    /**
     * Cross-version table definition.
     *
     * \Filament\Tables\Table is stable across v3/v4/v5 in name, but we drop
     * the strict hint anyway so any panel-level subclass override is accepted.
     */
    public static function table($table)
    {
        $plugin = static::getPlugin();
        $models = $plugin->getModels();

        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->label('Name')
                    ->searchable()
                    ->sortable()
                    ->description(fn (PdfTemplate $r) => $r->id . '.pdf')
                    ->weight('medium'),

                Tables\Columns\BadgeColumn::make('model_key')
                    ->label('Model')
                    ->formatStateUsing(fn (string $state) => $models[$state]['label'] ?? $state)
                    ->color('gray'),

                Tables\Columns\TextColumn::make('pages')
                    ->label('Pages')
                    ->sortable()
                    ->alignCenter(),

                Tables\Columns\TextColumn::make('used_in')
                    ->label('Used in')
                    ->placeholder('—')
                    ->color('gray'),

                Tables\Columns\TextColumn::make('updated_at')
                    ->label('Last updated')
                    ->since()
                    ->sortable()
                    ->color('gray'),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('model_key')
                    ->label('Model')
                    ->options(
                        collect($models)->mapWithKeys(fn ($m, $k) => [$k => $m['label'] ?? $k])->all()
                    ),
            ])
            ->actions([
                Tables\Actions\Action::make('edit_builder')
                    ->label('Open Builder')
                    ->icon('heroicon-o-pencil-square')
                    ->url(fn (PdfTemplate $r) => static::getUrl('edit', ['record' => $r])),

                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ])
            ->defaultSort('updated_at', 'desc');
    }

    /**
     * @internal Resolves the Filament major version (3, 4, or 5) at runtime.
     * Useful if you need to branch on capabilities (e.g. v4-only schema features).
     */
    protected static function filamentMajorVersion(): int
    {
        if (class_exists(\Filament\Schemas\Schema::class)) {
            // v4 introduced Schema; v5 keeps it. Distinguish by a v5-only class if you need to.
            return class_exists(\Filament\Schemas\Components\Tabs::class) ? 5 : 4;
        }

        return 3;
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListPdfTemplates::route('/'),
            'create' => Pages\CreatePdfTemplate::route('/create'),
            'edit'   => Pages\EditPdfTemplate::route('/{record}/edit'),
        ];
    }

    protected static function getPlugin(): PdfTemplateBuilderPlugin
    {
        return filament()->getPlugin('pdf-template-builder');
    }
}