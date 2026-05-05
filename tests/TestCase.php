<?php

namespace Kukux\PdfTemplateBuilder\Tests;

use Kukux\PdfTemplateBuilder\PdfTemplateBuilderServiceProvider;
use Orchestra\Testbench\TestCase as Orchestra;

class TestCase extends Orchestra
{
    protected function setUp(): void
    {
        parent::setUp();

        // Migrations ship as .stub; load and run inline.
        $migration = include __DIR__ . '/../database/migrations/create_pdf_templates_table.php.stub';
        $migration->up();
    }

    protected function getPackageProviders($app): array
    {
        return [PdfTemplateBuilderServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        $app['config']->set('database.default', 'testing');
        $app['config']->set('database.connections.testing', [
            'driver'   => 'sqlite',
            'database' => ':memory:',
            'prefix'   => '',
        ]);
    }
}
