<?php

namespace Kukux\PdfTemplateBuilder\Rendering\Engines;

use Kukux\PdfTemplateBuilder\Rendering\Contracts\PdfEngine;
use Symfony\Component\HttpFoundation\Response;

/**
 * Fallback engine — returns the rendered HTML directly.
 * Use when no PDF library is installed; the user can save-as-PDF from the browser.
 */
class HtmlEngine implements PdfEngine
{
    public function render(string $html, string $filename, array $options = []): Response
    {
        return new Response($html, 200, [
            'Content-Type' => 'text/html; charset=utf-8',
        ]);
    }
}
