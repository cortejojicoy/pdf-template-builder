<?php

use Kukux\PdfTemplateBuilder\Models\PdfTemplate;

it('persists a template and casts fields to array', function () {
    $t = PdfTemplate::create([
        'name'             => 'Invoice template',
        'model_key'        => 'invoice',
        'page_size'        => 'A4',
        'orientation'      => 'portrait',
        'pages'            => 2,
        'filename_pattern' => 'invoice-{{number}}.pdf',
        'fields'           => [
            ['id' => 'a', 'type' => 'text', 'key' => 'invoice.number',
             'x' => 36, 'y' => 36, 'w' => 200, 'h' => 20, 'page' => 0],
        ],
    ]);

    $reloaded = PdfTemplate::find($t->id);

    expect($reloaded->fields)->toBeArray()->toHaveCount(1);
    expect($reloaded->pages)->toBe(2);
    expect($reloaded->field_count)->toBe(1);
});

it('renders against a model record without a PDF engine installed', function () {
    $t = PdfTemplate::create([
        'name' => 't', 'model_key' => 'invoice',
        'page_size' => 'Letter', 'orientation' => 'portrait',
        'pages' => 1, 'filename_pattern' => '{{id}}.pdf',
        'fields' => [
            ['id' => 'a', 'type' => 'text', 'key' => 'invoice.number',
             'x' => 36, 'y' => 36, 'w' => 200, 'h' => 20, 'page' => 0],
        ],
    ]);

    $html = $t->render(['number' => 'INV-001']);

    expect($html)->toContain('INV-001')->toContain('<!doctype html>');
});
