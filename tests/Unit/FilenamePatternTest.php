<?php

use Kukux\PdfTemplateBuilder\Models\PdfTemplate;

it('substitutes tokens and sanitizes the filename', function () {
    $t = new PdfTemplate([
        'filename_pattern' => 'invoice-{{number}}.pdf',
        'model_key'        => 'invoice',
    ]);

    expect($t->resolveFilename(['number' => 'INV/2026/001']))
        ->toBe('invoice-INV_2026_001.pdf');
});

it('appends .pdf when missing', function () {
    $t = new PdfTemplate([
        'filename_pattern' => 'doc-{{id}}',
        'model_key'        => 'invoice',
    ]);

    expect($t->resolveFilename(['id' => 7]))->toBe('doc-7.pdf');
});

it('falls back to default when pattern is empty', function () {
    $t = new PdfTemplate([
        'model_key' => 'invoice',
    ]);

    expect($t->resolveFilename(['id' => 99]))->toBe('99.pdf');
});
