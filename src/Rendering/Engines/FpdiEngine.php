<?php

namespace Kukux\PdfTemplateBuilder\Rendering\Engines;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Kukux\PdfTemplateBuilder\Models\PdfTemplate;
use Kukux\PdfTemplateBuilder\PdfTemplateBuilderPlugin;
use Kukux\PdfTemplateBuilder\Rendering\Contracts\TemplateAwarePdfEngine;
use Kukux\PdfTemplateBuilder\Rendering\FieldResolver;
use RuntimeException;
use setasign\Fpdi\Tcpdf\Fpdi;
use Symfony\Component\HttpFoundation\Response;

/**
 * Stamps fields on top of the original uploaded PDF (true overlay) using
 * setasign/fpdi + tecnickcom/tcpdf.
 *
 * Use this engine when you uploaded a designed PDF as the template
 * background and want the output to preserve every original glyph and
 * vector — not a CSS-background screenshot of it.
 *
 * Install:
 *   composer require setasign/fpdi tecnickcom/tcpdf
 *
 * Wire on the plugin:
 *   PdfTemplateBuilderPlugin::make()->engine(FpdiEngine::class)
 */
class FpdiEngine implements TemplateAwarePdfEngine
{
    /** Page sizes in points (portrait). */
    protected const PAGE_SIZES = [
        'Letter' => [612.0, 792.0],
        'A4'     => [595.0, 842.0],
        'Legal'  => [612.0, 1008.0],
    ];

    /**
     * Required by PdfEngine — but FPDI does not consume HTML.
     * Throws to surface misconfiguration; consumers should rely on
     * renderTemplate() (which PdfTemplate::stream() prefers automatically).
     */
    public function render(string $html, string $filename, array $options = []): Response
    {
        throw new RuntimeException(
            'FpdiEngine cannot render from HTML. Call $template->stream($record) so the engine ' .
            'receives the template directly, or use HtmlEngine/DompdfEngine for HTML rendering.'
        );
    }

    public function renderTemplate(
        PdfTemplate $template,
        mixed $record,
        array $contexts = [],
        array $options = [],
    ): Response {
        if (! class_exists(Fpdi::class)) {
            throw new RuntimeException(
                'setasign/fpdi (with tecnickcom/tcpdf) is not installed. Run: composer require setasign/fpdi tecnickcom/tcpdf'
            );
        }

        [$pageW, $pageH] = self::PAGE_SIZES[$template->page_size] ?? self::PAGE_SIZES['Letter'];
        if ($template->orientation === 'landscape') {
            [$pageW, $pageH] = [$pageH, $pageW];
        }

        $pdf = new Fpdi('P', 'pt', [$pageW, $pageH]);
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);
        $pdf->SetAutoPageBreak(false);
        $pdf->SetMargins(0, 0, 0);
        $pdf->SetCellPadding(0);

        $bgPath  = $this->resolveBackgroundPath($template);
        $bgPages = 0;
        if ($bgPath !== null) {
            $bgPages = $pdf->setSourceFile($bgPath);
        }

        $resolver   = new FieldResolver($record, $template->model_key, $contexts);
        $catalog    = $this->buildFieldCatalog($template);
        $totalPages = max(1, (int) ($template->pages ?? 1));
        $fields     = $template->fields ?? [];

        for ($p = 0; $p < $totalPages; $p++) {
            $pdf->AddPage('P', [$pageW, $pageH]);

            if ($bgPath && $p < $bgPages) {
                $tplId = $pdf->importPage($p + 1);
                $pdf->useTemplate($tplId, 0, 0, $pageW, $pageH, true);
            }

            foreach ($fields as $field) {
                if (((int) ($field['page'] ?? 0)) !== $p) {
                    continue;
                }
                $this->drawField($pdf, $field, $resolver, $catalog, $p, $totalPages);
            }
        }

        $output   = $pdf->Output('', 'S');
        $filename = $template->resolveFilename($record);

        return new Response($output, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . str_replace('"', '', $filename) . '"',
        ]);
    }

    protected function drawField(Fpdi $pdf, array $field, FieldResolver $resolver, array $catalog, int $page, int $totalPages): void
    {
        // Accept both the React builder's shape (`kind`) and the legacy
        // shape used by older fixtures (`type`).
        $kind = $field['kind'] ?? $field['type'] ?? 'text';
        $x = (float) ($field['x'] ?? 0);
        $y = (float) ($field['y'] ?? 0);
        $w = (float) ($field['w'] ?? 0);
        $h = (float) ($field['h'] ?? 0);

        switch ($kind) {
            case 'image':
            case 'signature':
                $url = $field['url'] ?? null;
                if (! empty($field['bind'])) {
                    $resolved = $resolver->resolve($field['bind']);
                    if (is_string($resolved) && $resolved !== '') {
                        $url = $resolved;
                    }
                }
                if ($url) {
                    try {
                        $pdf->Image($url, $x, $y, $w, $h, '', '', '', false, 300, '', false, false, 0, 'CM');
                    } catch (\Throwable) {
                        // Skip unreadable image.
                    }
                }
                return;

            case 'divider':
                $thickness = (float) ($field['thickness'] ?? 1);
                $color     = $this->hexToRgb($field['color'] ?? '#d1d5db');
                $pdf->SetLineWidth($thickness);
                $pdf->SetDrawColor($color[0], $color[1], $color[2]);
                $pdf->Line($x, $y + $h / 2, $x + $w, $y + $h / 2);
                return;

            case 'rect':
                $this->drawRect($pdf, $field, $x, $y, $w, $h);
                return;

            case 'checkbox':
                $checked = ! empty($field['checked'])
                    || (! empty($field['bind']) && $resolver->resolve($field['bind']));
                $pdf->SetLineWidth(0.75);
                $pdf->SetDrawColor(80, 80, 80);
                $pdf->Rect($x, $y, $w, $h);
                if ($checked) {
                    $pdf->SetTextColor(0, 0, 0);
                    $pdf->SetFont('helvetica', 'B', max(8, $h * 0.7));
                    $pdf->SetXY($x, $y);
                    $pdf->Cell($w, $h, '✓', 0, 0, 'C');
                }
                return;

            case 'heading':
                $this->drawText($pdf, $field, (string) ($field['text'] ?? ''), $x, $y, $w, $h, true);
                return;

            case 'text':
                // Builder: static text. Legacy: resolve bind/key.
                if (array_key_exists('text', $field)) {
                    $this->drawText($pdf, $field, (string) ($field['text'] ?? ''), $x, $y, $w, $h, true);
                } else {
                    $token = $field['bind'] ?? $field['key'] ?? null;
                    $raw   = $token ? $resolver->resolve($token) : ($field['sample'] ?? $field['label'] ?? '');
                    $this->drawText($pdf, $field, (string) ($raw ?? ''), $x, $y, $w, $h, false);
                }
                return;

            case 'bound':
                $bind = $field['bind'] ?? $field['key'] ?? '';
                if ($bind === '') return;
                $raw   = $resolver->resolve($bind);
                $def   = $catalog[$bind] ?? [];
                $type  = $def['type'] ?? 'text';
                $value = $this->formatBound($type, $raw, $def);
                $this->drawText($pdf, $field, $value, $x, $y, $w, $h, $type === 'longtext');
                return;

            case 'currency':
            case 'date':
            case 'number':
            case 'longtext':
                $token = $field['bind'] ?? $field['key'] ?? null;
                $raw   = $token ? $resolver->resolve($token) : ($field['sample'] ?? '');
                $value = $this->formatBound($kind, $raw, $field);
                $this->drawText($pdf, $field, $value, $x, $y, $w, $h, $kind === 'longtext');
                return;

            case 'qr':
                $value = $this->substituteTokens((string) ($field['value'] ?? ''), $resolver);
                $this->drawText($pdf, $field, $value, $x, $y, $w, $h, false);
                return;

            case 'page-number':
                $format = (string) ($field['format'] ?? 'Page {{page}} of {{total}}');
                $value  = strtr($format, [
                    '{{page}}'  => (string) ($page + 1),
                    '{{total}}' => (string) $totalPages,
                ]);
                $this->drawText($pdf, $field, $value, $x, $y, $w, $h, false);
                return;

            default:
                // Legacy / unknown kind — try $bind then $key.
                $raw = ! empty($field['bind']) ? $resolver->resolve($field['bind'])
                     : (! empty($field['key']) ? $resolver->resolve($field['key'])
                     : ($field['sample'] ?? $field['label'] ?? ''));
                $this->drawText($pdf, $field, (string) ($raw ?? ''), $x, $y, $w, $h, false);
                return;
        }
    }

    protected function drawRect(Fpdi $pdf, array $field, float $x, float $y, float $w, float $h): void
    {
        $fill   = ! empty($field['fill']) ? $this->hexToRgb($field['fill']) : null;
        $stroke = ! empty($field['stroke']) ? $this->hexToRgb($field['stroke']) : null;
        $radius = (float) ($field['borderRadius'] ?? 0);

        $style = '';
        if ($fill && $stroke)      $style = 'DF';
        elseif ($fill)             $style = 'F';
        elseif ($stroke)           $style = 'D';
        else                       return;

        if ($fill)   $pdf->SetFillColor($fill[0], $fill[1], $fill[2]);
        if ($stroke) {
            $pdf->SetDrawColor($stroke[0], $stroke[1], $stroke[2]);
            $pdf->SetLineWidth((float) ($field['strokeWidth'] ?? 1));
        }

        if ($radius > 0 && method_exists($pdf, 'RoundedRect')) {
            $pdf->RoundedRect($x, $y, $w, $h, $radius, '1111', $style);
        } else {
            $pdf->Rect($x, $y, $w, $h, $style);
        }
    }

    protected function drawText(Fpdi $pdf, array $field, string $value, float $x, float $y, float $w, float $h, bool $multiline): void
    {
        $color = $this->hexToRgb($field['color'] ?? '#111827');
        $size  = (float) ($field['fontSize'] ?? 11);
        $style = '';
        if (! empty($field['bold']))      $style .= 'B';
        if (! empty($field['italic']))    $style .= 'I';
        if (! empty($field['underline'])) $style .= 'U';

        $pdf->SetTextColor($color[0], $color[1], $color[2]);
        $pdf->SetFont($this->mapFont($field['fontFamily'] ?? null), $style, $size);

        $align = match ($field['align'] ?? 'left') {
            'center' => 'C',
            'right'  => 'R',
            default  => 'L',
        };

        $pdf->SetXY($x, $y);
        if ($multiline) {
            $pdf->MultiCell($w, $h, $value, 0, $align, false, 1, $x, $y, true, 0, false, true, $h, 'T');
        } else {
            $pdf->Cell($w, $h, $value, 0, 0, $align);
        }
    }

    protected function formatBound(string $type, mixed $value, array $def): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        return match ($type) {
            'currency' => $this->formatCurrency($value, $def['currency'] ?? null),
            'date'     => $this->formatDate($value, $def['format'] ?? null),
            'number'   => is_numeric($value)
                ? number_format((float) $value, (int) ($def['decimals'] ?? 0))
                : (string) $value,
            default    => (string) $value,
        };
    }

    protected function substituteTokens(string $input, FieldResolver $resolver): string
    {
        return (string) preg_replace_callback('/\{\{\s*([\w\.\-]+)\s*\}\}/', function (array $m) use ($resolver) {
            $resolved = $resolver->resolve($m[1]);
            return (string) ($resolved ?? '');
        }, $input);
    }

    protected function buildFieldCatalog(PdfTemplate $template): array
    {
        if (! $template->model_key) {
            return [];
        }

        $modelDef = app(PdfTemplateBuilderPlugin::class)->getModels()[$template->model_key] ?? null;
        if (! $modelDef) {
            return [];
        }

        $catalog = [];
        foreach ($modelDef['fields'] ?? [] as $f) {
            if (! empty($f['key'])) {
                $catalog[$f['key']] = $f;
            }
        }
        foreach ($modelDef['relations'] ?? [] as $rel) {
            foreach ($rel['fields'] ?? [] as $f) {
                if (! empty($f['key'])) {
                    $catalog[$f['key']] = $f;
                }
            }
        }

        return $catalog;
    }

    protected function formatCurrency(mixed $value, ?string $currency): string
    {
        if (! is_numeric($value)) return (string) $value;
        return ($currency ?: '$') . number_format((float) $value, 2);
    }

    protected function formatDate(mixed $value, ?string $format): string
    {
        try {
            return Carbon::parse($value)->format($format ?: 'M j, Y');
        } catch (\Throwable) {
            return (string) $value;
        }
    }

    protected function mapFont(?string $family): string
    {
        $family = strtolower((string) $family);

        return match (true) {
            str_contains($family, 'mono')  => 'courier',
            str_contains($family, 'serif') => 'times',
            default                         => 'helvetica',
        };
    }

    protected function hexToRgb(string $hex): array
    {
        $hex = ltrim($hex, '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }
        if (! preg_match('/^[0-9a-fA-F]{6}$/', $hex)) {
            return [17, 24, 39]; // default near-black
        }
        return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
    }

    protected function resolveBackgroundPath(PdfTemplate $template): ?string
    {
        if (! $template->background_pdf) {
            return null;
        }

        $disk = $template->disk ?: config('pdf-template-builder.disk', 'public');
        $fs   = Storage::disk($disk);

        // Local disks expose a real path FPDI can read directly.
        if (method_exists($fs, 'path')) {
            try {
                $path = $fs->path($template->background_pdf);
                if (is_file($path)) {
                    return $path;
                }
            } catch (\Throwable) {
                // Fall through to download.
            }
        }

        // Remote disks (e.g. s3) — pull bytes into a tmp file.
        $contents = $fs->get($template->background_pdf);
        if ($contents === null) {
            return null;
        }
        $tmp = tempnam(sys_get_temp_dir(), 'pdfbg_') . '.pdf';
        file_put_contents($tmp, $contents);
        return $tmp;
    }
}
