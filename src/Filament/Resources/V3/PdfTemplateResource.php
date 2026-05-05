<?php

namespace Kukux\PdfTemplateBuilder\Filament\Resources\V3;

use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Kukux\PdfTemplateBuilder\Filament\Resources\PdfTemplateResource\Pages;
use Kukux\PdfTemplateBuilder\Models\PdfTemplate;
use Kukux\PdfTemplateBuilder\PdfTemplateBuilderPlugin;

/**
 * Filament v3 implementation. The package's service provider class_aliases
 * the canonical Kukux\PdfTemplateBuilder\Filament\Resources\PdfTemplateResource
 * to either this class or the V4 variant, depending on the installed Filament
 * major version detected at boot.
 */

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

    public static function form(Form $form): Form
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

    public static function table(Table $table): Table
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