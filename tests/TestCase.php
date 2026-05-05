<?php

namespace Kukux\PdfTemplateBuilder\Tests;

use Kukux\PdfTemplateBuilder\PdfTemplateBuilderServiceProvider;
use Orchestra\Testbench\TestCase as Orchestra;

class TestCase extends Orchestra
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->artisan('vendor:publish', ['--tag' => 'pdf-template-builder-migrations']);
        $this->artisan('migrate')->run();
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
