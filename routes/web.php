<?php

use Illuminate\Support\Facades\Route;
use Kukux\PdfTemplateBuilder\Http\Controllers\PdfTemplateController;

Route::prefix('pdf-builder/api')
    ->middleware(['web', 'auth'])
    ->name('pdf-builder.api.')
    ->group(function () {
        Route::get('/templates/{id}',          [PdfTemplateController::class, 'show'])->name('templates.show');
        Route::put('/templates/{id}',          [PdfTemplateController::class, 'update'])->name('templates.update');
        Route::delete('/templates/{id}',       [PdfTemplateController::class, 'destroy'])->name('templates.destroy');
        Route::post('/templates/{id}/upload',  [PdfTemplateController::class, 'upload'])->name('templates.upload');
    });