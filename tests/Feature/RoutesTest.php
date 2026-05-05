<?php

use Illuminate\Support\Facades\Route;

it('registers the api base route name', function () {
    expect(Route::has('pdf-builder.api.base'))->toBeTrue();
});

it('registers all template api routes', function () {
    expect(Route::has('pdf-builder.api.templates.show'))->toBeTrue();
    expect(Route::has('pdf-builder.api.templates.update'))->toBeTrue();
    expect(Route::has('pdf-builder.api.templates.destroy'))->toBeTrue();
    expect(Route::has('pdf-builder.api.templates.upload'))->toBeTrue();
});
