<?php

namespace Kukux\PdfTemplateBuilder\Rendering\Engines;

use Dompdf\Dompdf;
use Dompdf\Options;
use Kukux\PdfTemplateBuilder\Rendering\Contracts\PdfEngine;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Renders templates to PDF via dompdf/dompdf.
 * Auto-selected when the package is installed; falls back to HtmlEngine otherwise.
 */
class DompdfEngine implements PdfEngine
{
    public function render(string $html, string $filename, array $options = []): Response
    {
        if (! class_exists(Dompdf::class)) {
            throw new RuntimeException('dompdf/dompdf is not installed. Run: composer require dompdf/dompdf');
        }

        $dompdfOptions = new Options();
        $dompdfOptions->set('isRemoteEnabled', $options['remote'] ?? true);
        $dompdfOptions->set('defaultFont', $options['font'] ?? 'DejaVu Sans');

        $dompdf = new Dompdf($dompdfOptions);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper(
            $options['page_size'] ?? 'Letter',
            $options['orientation'] ?? 'portrait',
        );
        $dompdf->render();

        return new Response($dompdf->output(), 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . str_replace('"', '', $filename) . '"',
        ]);
    }
}
