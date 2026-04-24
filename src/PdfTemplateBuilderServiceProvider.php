<?php

namespace Kukux\PdfTemplateBuilder;

use Illuminate\Support\Facades\Route;
use Spatie\LaravelPackageTools\Package;
use Spatie\LaravelPackageTools\PackageServiceProvider;
use Kukux\PdfTemplateBuilder\Http\Controllers\PdfTemplateController;

class PdfTemplateBuilderServiceProvider extends PackageServiceProvider
{
    public function configurePackage(Package $package): void
    {
        $package
            ->name('pdf-template-builder')
            ->hasConfigFile()
            ->hasViews()
            ->hasMigration('create_pdf_templates_table')
            ->hasRoute('web');
    }

    public function packageBooted(): void
    {
        // Publish JS assets so they can be served from public/vendor/...
        $this->publishes([
            __DIR__ . '/../resources/js' => public_path('vendor/pdf-template-builder/js'),
        ], 'pdf-template-builder-assets');

        // Publish config
        $this->publishes([
            __DIR__ . '/../config/pdf-template-builder.php' => config_path('pdf-template-builder.php'),
        ], 'pdf-template-builder-config');
    }
}