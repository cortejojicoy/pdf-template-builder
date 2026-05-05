<?php

use Kukux\PdfTemplateBuilder\Models\PdfTemplate;
use Kukux\PdfTemplateBuilder\Rendering\HtmlTemplateRenderer;

it('renders text fields with model values', function () {
    $template = new PdfTemplate([
        'name'             => 'Invoice',
        'model_key'        => 'invoice',
        'page_size'        => 'Letter',
        'orientation'      => 'portrait',
        'pages'            => 1,
        'filename_pattern' => '{{id}}.pdf',
        'fields'           => [
            ['id' => 'a', 'type' => 'text', 'key' => 'invoice.number',
             'x' => 36, 'y' => 36, 'w' => 200, 'h' => 20, 'page' => 0],
        ],
    ]);

    $html = (new HtmlTemplateRenderer())->render($template, ['number' => 'INV-001']);

    expect($html)->toContain('INV-001');
    expect($html)->toContain('class="pdf-page"');
});

it('formats currency, dates, and numbers', function () {
    $template = new PdfTemplate([
        'page_size'   => 'Letter',
        'orientation' => 'portrait',
        'pages'       => 1,
        'model_key'   => 'invoice',
        'fields'      => [
            ['id' => 'c', 'type' => 'currency', 'key' => 'invoice.total', 'x' => 0, 'y' => 0, 'w' => 100, 'h' => 20, 'page' => 0],
            ['id' => 'd', 'type' => 'date',     'key' => 'invoice.date',  'x' => 0, 'y' => 0, 'w' => 100, 'h' => 20, 'page' => 0],
            ['id' => 'n', 'type' => 'number',   'key' => 'invoice.qty',   'x' => 0, 'y' => 0, 'w' => 100, 'h' => 20, 'page' => 0, 'decimals' => 2],
        ],
    ]);

    $html = (new HtmlTemplateRenderer())->render($template, [
        'total' => 1234.5,
        'date'  => '2026-05-05',
        'qty'   => 42,
    ]);

    expect($html)->toContain('$1,234.50');
    expect($html)->toContain('May 5, 2026');
    expect($html)->toContain('42.00');
});

it('emits one page per pages count with page-break', function () {
    $template = new PdfTemplate([
        'page_size'   => 'Letter',
        'orientation' => 'portrait',
        'pages'       => 3,
        'model_key'   => 'invoice',
        'fields'      => [],
    ]);

    $html = (new HtmlTemplateRenderer())->render($template, []);

    expect(substr_count($html, 'class="pdf-page"'))->toBe(3);
    expect($html)->toContain('page-break-after:always');
});
