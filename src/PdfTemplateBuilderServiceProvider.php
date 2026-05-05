<?php

namespace Kukux\PdfTemplateBuilder;

use Illuminate\Support\Facades\Gate;
use Spatie\LaravelPackageTools\Package;
use Spatie\LaravelPackageTools\PackageServiceProvider;
use Kukux\PdfTemplateBuilder\Models\PdfTemplate;
use Kukux\PdfTemplateBuilder\Policies\PdfTemplatePolicy;
use Kukux\PdfTemplateBuilder\Rendering\Contracts\PdfEngine;
use Kukux\PdfTemplateBuilder\Rendering\Engines\DompdfEngine;
use Kukux\PdfTemplateBuilder\Rendering\Engines\HtmlEngine;

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

    public function packageRegistered(): void
    {
        $this->app->singleton(PdfTemplateBuilderPlugin::class);

        $this->app->bind(PdfEngine::class, function () {
            return class_exists(\Dompdf\Dompdf::class)
                ? new DompdfEngine()
                : new HtmlEngine();
        });
    }

    public function packageBooted(): void
    {
        Gate::policy(PdfTemplate::class, PdfTemplatePolicy::class);

        // Publish bundled JS/CSS to public/vendor/pdf-template-builder/
        $this->publishes([
            __DIR__ . '/../resources/dist' => public_path('vendor/pdf-template-builder'),
        ], 'pdf-template-builder-assets');

        // Publish config
        $this->publishes([
            __DIR__ . '/../config/pdf-template-builder.php' => config_path('pdf-template-builder.php'),
        ], 'pdf-template-builder-config');
    }
}