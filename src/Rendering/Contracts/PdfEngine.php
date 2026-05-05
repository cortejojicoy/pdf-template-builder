<?php

namespace Kukux\PdfTemplateBuilder\Rendering\Contracts;

use Symfony\Component\HttpFoundation\Response;

/**
 * Turns a rendered HTML document into an HTTP Response.
 * Implementations decide whether the response is HTML, PDF, etc.
 */
interface PdfEngine
{
    /**
     * @param  string  $html      Full HTML document.
     * @param  string  $filename  Suggested download filename (with .pdf extension).
     * @param  array   $options   Engine-specific options (page size, orientation, etc.).
     */
    public function render(string $html, string $filename, array $options = []): Response;
}
