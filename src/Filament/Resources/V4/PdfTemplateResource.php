<?php

namespace Kukux\PdfTemplateBuilder\Filament\Resources\V4;

use Filament\Actions\Action;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Forms;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables;
use Filament\Tables\Table;
use Kukux\PdfTemplateBuilder\Filament\Resources\PdfTemplateResource\Pages;
use Kukux\PdfTemplateBuilder\Models\PdfTemplate;
use Kukux\PdfTemplateBuilder\PdfTemplateBuilderPlugin;

/**
 * Filament v4 / v5 implementation.
 *
 * Differences from V3:
 *  - Resource::form() now receives \Filament\Schemas\Schema and returns Schema.
 *  - Section moved from Filament\Forms\Components\Section to Filament\Schemas\Components\Section.
 *  - Schemas use ->components([...]) instead of ->schema([...]).
 *  - Form leaf components (TextInput, Select, FileUpload) remain in Filament\Forms\Components\*.
 *  - BadgeColumn was deprecated in v3 and removed in v4 — replaced with TextColumn::badge().
 *
 * If you are running Filament v4/v5 and any namespace above does not match your
 * installed package, file an issue. The detected variant is loaded by
 * PdfTemplateBuilderServiceProvider via class_alias.
 */
class PdfTemplateResource extends Resource
{
    protected static ?string $model = PdfTemplate::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-document-text';

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

    public static function form(Schema $schema): Schema
    {
        $plugin  = static::getPlugin();
        $models  = $plugin->getModels();
        $options = collect($models)->mapWithKeys(fn ($m, $k) => [$k => $m['label'] ?? $k])->all();

        return $schema->components([
            Section::make('Template Details')
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

            Section::make('Background PDF')
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

                Tables\Columns\TextColumn::make('model_key')
                    ->label('Model')
                    ->badge()
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
            ->recordActions([
                Action::make('edit_builder')
                    ->label('Open Builder')
                    ->icon('heroicon-o-pencil-square')
                    ->url(fn (PdfTemplate $r) => static::getUrl('edit', ['record' => $r])),

                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
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
