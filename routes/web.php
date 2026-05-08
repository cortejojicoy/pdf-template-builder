<?php

use Illuminate\Support\Facades\Route;
use Kukux\PdfTemplateBuilder\Http\Controllers\PdfTemplateController;
use Kukux\PdfTemplateBuilder\Http\Middleware\EnsureAuthenticatedJson;

Route::prefix('pdf-builder/api')
    ->middleware(['web', EnsureAuthenticatedJson::class])
    ->name('pdf-builder.api.')
    ->group(function () {
        Route::get('/',                        [PdfTemplateController::class, 'base'])->name('base');
        Route::get('/templates/{id}',          [PdfTemplateController::class, 'show'])->name('templates.show');
        Route::put('/templates/{id}',          [PdfTemplateController::class, 'update'])->name('templates.update');
        Route::delete('/templates/{id}',       [PdfTemplateController::class, 'destroy'])->name('templates.destroy');
        Route::post('/templates/{id}/upload',  [PdfTemplateController::class, 'upload'])->name('templates.upload');
    });