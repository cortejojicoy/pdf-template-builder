<?php

namespace Kukux\PdfTemplateBuilder\Rendering\Contracts;

use Kukux\PdfTemplateBuilder\Models\PdfTemplate;
use Symfony\Component\HttpFoundation\Response;

/**
 * Optional engine contract for engines that work directly from the
 * template + record (e.g. PDF stamping via FPDI) and don't go through HTML.
 *
 * If an engine implements this, PdfTemplate::stream() prefers
 * renderTemplate() over the html-based render() path.
 */
interface TemplateAwarePdfEngine extends PdfEngine
{
    public function renderTemplate(
        PdfTemplate $template,
        mixed $record,
        array $contexts = [],
        array $options = [],
    ): Response;
}
