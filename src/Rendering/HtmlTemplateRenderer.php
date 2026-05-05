<?php

namespace Kukux\PdfTemplateBuilder\Rendering;

use Illuminate\Support\Carbon;
use Kukux\PdfTemplateBuilder\Models\PdfTemplate;

/**
 * Builds a print-ready HTML document from a PdfTemplate + record.
 *
 * Coordinates in the template are stored in points (1pt = 1/72 inch),
 * matching the React canvas. We emit positioned <div>s using `pt` units
 * so dompdf and browser print render identically.
 *
 * Supported field types: text, longtext, number, currency, date, image,
 * signature, checkbox, divider. Unknown types render as plain text.
 */
class HtmlTemplateRenderer
{
    /** Page sizes in points (portrait dimensions). */
    protected const PAGE_SIZES = [
        'Letter' => [612, 792],
        'A4'     => [595, 842],
        'Legal'  => [612, 1008],
    ];

    public function render(PdfTemplate $template, mixed $record, array $contexts = []): string
    {
        [$pageW, $pageH] = self::PAGE_SIZES[$template->page_size] ?? self::PAGE_SIZES['Letter'];
        if ($template->orientation === 'landscape') {
            [$pageW, $pageH] = [$pageH, $pageW];
        }

        $resolver = new FieldResolver($record, $template->model_key, $contexts);
        $fields   = $template->fields ?? [];
        $pages    = max(1, (int) ($template->pages ?? 1));

        $body = '';
        for ($p = 0; $p < $pages; $p++) {
            $body .= $this->renderPage($p, $pageW, $pageH, $fields, $resolver);
        }

        return $this->document($template, $pageW, $pageH, $body);
    }

    protected function renderPage(int $page, float $w, float $h, array $fields, FieldResolver $resolver): string
    {
        $pageFields = array_filter($fields, fn ($f) => ((int) ($f['page'] ?? 0)) === $page);

        $html = sprintf(
            '<div class="pdf-page" style="position:relative;width:%spt;height:%spt;page-break-after:always;overflow:hidden;">',
            $w, $h
        );

        foreach ($pageFields as $field) {
            $html .= $this->renderField($field, $resolver);
        }

        return $html . '</div>';
    }

    protected function renderField(array $field, FieldResolver $resolver): string
    {
        $style = sprintf(
            'position:absolute;left:%spt;top:%spt;width:%spt;height:%spt;overflow:hidden;%s',
            $field['x'] ?? 0,
            $field['y'] ?? 0,
            $field['w'] ?? 0,
            $field['h'] ?? 0,
            $this->typographyStyle($field),
        );

        $type    = $field['type'] ?? 'text';
        $content = $this->fieldContent($type, $field, $resolver);

        return sprintf('<div style="%s">%s</div>', e($style), $content);
    }

    protected function fieldContent(string $type, array $field, FieldResolver $resolver): string
    {
        switch ($type) {
            case 'image':
                $url = $field['url'] ?? null;
                if (! empty($field['key'])) {
                    $resolved = $resolver->resolve($field['key']);
                    if (is_string($resolved) && $resolved !== '') {
                        $url = $resolved;
                    }
                }
                if (! $url) {
                    return '';
                }
                $fit = in_array($field['objectFit'] ?? 'contain', ['cover', 'contain', 'fill'], true)
                    ? $field['objectFit']
                    : 'contain';
                return sprintf(
                    '<img src="%s" style="width:100%%;height:100%%;object-fit:%s;" alt="" />',
                    e($url), e($fit)
                );

            case 'divider':
                $thickness = (float) ($field['thickness'] ?? 1);
                $color     = $field['color'] ?? '#d1d5db';
                return sprintf(
                    '<hr style="margin:0;border:none;border-top:%spt solid %s;width:100%%;" />',
                    $thickness, e($color)
                );

            case 'checkbox':
                $checked = ! empty($field['checked'])
                    || ($field['key'] && $resolver->resolve($field['key']));
                return sprintf(
                    '<span style="display:inline-block;width:10pt;height:10pt;border:1pt solid #6b7280;text-align:center;line-height:10pt;">%s</span>',
                    $checked ? '&#10003;' : '&nbsp;'
                );

            case 'signature':
                $url = $field['url'] ?? null;
                if (! empty($field['key'])) {
                    $resolved = $resolver->resolve($field['key']);
                    if (is_string($resolved) && $resolved !== '') {
                        $url = $resolved;
                    }
                }
                if ($url) {
                    return sprintf('<img src="%s" style="width:100%%;height:100%%;object-fit:contain;" alt="" />', e($url));
                }
                return '';

            case 'currency':
                $value = $field['key'] ? $resolver->resolve($field['key']) : ($field['sample'] ?? '');
                return e($this->formatCurrency($value, $field['currency'] ?? null));

            case 'date':
                $value = $field['key'] ? $resolver->resolve($field['key']) : ($field['sample'] ?? '');
                return e($this->formatDate($value, $field['format'] ?? null));

            case 'number':
                $value = $field['key'] ? $resolver->resolve($field['key']) : ($field['sample'] ?? '');
                return e(is_numeric($value) ? number_format((float) $value, (int) ($field['decimals'] ?? 0)) : (string) $value);

            case 'longtext':
                $value = $field['key'] ? $resolver->resolve($field['key']) : ($field['sample'] ?? '');
                return nl2br(e((string) ($value ?? '')));

            case 'text':
            default:
                $value = $field['key'] ? $resolver->resolve($field['key']) : ($field['sample'] ?? $field['label'] ?? '');
                return e((string) ($value ?? ''));
        }
    }

    protected function typographyStyle(array $field): string
    {
        $parts = [];
        if (! empty($field['fontSize']))   $parts[] = 'font-size:' . (float) $field['fontSize'] . 'pt';
        if (! empty($field['fontFamily'])) $parts[] = 'font-family:' . preg_replace('/[^a-zA-Z0-9 \-_,\']/', '', $field['fontFamily']);
        if (! empty($field['bold']))       $parts[] = 'font-weight:700';
        if (! empty($field['italic']))     $parts[] = 'font-style:italic';
        if (! empty($field['color']))      $parts[] = 'color:' . preg_replace('/[^a-zA-Z0-9#(),. ]/', '', $field['color']);
        if (! empty($field['align']))      $parts[] = 'text-align:' . (in_array($field['align'], ['left','center','right','justify'], true) ? $field['align'] : 'left');
        $parts[] = 'line-height:1.25';

        return implode(';', $parts) . ';';
    }

    protected function formatCurrency(mixed $value, ?string $currency): string
    {
        if ($value === null || $value === '') return '';
        if (! is_numeric($value)) return (string) $value;

        $symbol = $currency ?: '$';
        return $symbol . number_format((float) $value, 2);
    }

    protected function formatDate(mixed $value, ?string $format): string
    {
        if (empty($value)) return '';
        try {
            return Carbon::parse($value)->format($format ?: 'M j, Y');
        } catch (\Throwable) {
            return (string) $value;
        }
    }

    protected function document(PdfTemplate $template, float $w, float $h, string $body): string
    {
        $title = e($template->name ?? 'PDF');
        $bgUrl = $template->background_url;
        $bgRule = $bgUrl
            ? sprintf('.pdf-page{background:#fff url("%s") center/100%% 100%% no-repeat;}', e($bgUrl))
            : '';

        return <<<HTML
<!doctype html>
<html><head>
<meta charset="utf-8" />
<title>{$title}</title>
<style>
@page { size: {$w}pt {$h}pt; margin: 0; }
html, body { margin:0; padding:0; }
body { font-family: 'DejaVu Sans', Arial, sans-serif; color:#111827; }
.pdf-page { background:#fff; box-sizing:border-box; }
{$bgRule}
</style>
</head><body>
{$body}
</body></html>
HTML;
    }
}
