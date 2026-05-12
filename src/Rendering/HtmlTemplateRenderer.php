<?php

namespace Kukux\PdfTemplateBuilder\Rendering;

use Illuminate\Support\Carbon;
use Kukux\PdfTemplateBuilder\Models\PdfTemplate;
use Kukux\PdfTemplateBuilder\PdfTemplateBuilderPlugin;

/**
 * Builds a print-ready HTML document from a PdfTemplate + record.
 *
 * Coordinates in the template are stored in points (1pt = 1/72 inch),
 * matching the React canvas. We emit positioned <div>s using `pt` units
 * so dompdf and browser print render identically.
 *
 * Field kinds mirror the React builder: bound, heading, text, divider,
 * rect, image, signature, checkbox, qr, page-number.
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
        $catalog  = $this->buildFieldCatalog($template);
        $fields   = $template->fields ?? [];
        $pages    = max(1, (int) ($template->pages ?? 1));

        $body = '';
        for ($p = 0; $p < $pages; $p++) {
            $body .= $this->renderPage($p, $pages, $pageW, $pageH, $fields, $resolver, $catalog);
        }

        return $this->document($template, $pageW, $pageH, $body);
    }

    protected function renderPage(int $page, int $totalPages, float $w, float $h, array $fields, FieldResolver $resolver, array $catalog): string
    {
        $pageFields = array_filter($fields, fn ($f) => ((int) ($f['page'] ?? 0)) === $page);

        $html = sprintf(
            '<div class="pdf-page" style="position:relative;width:%spt;height:%spt;page-break-after:always;overflow:hidden;">',
            $w, $h
        );

        foreach ($pageFields as $field) {
            $html .= $this->renderField($field, $resolver, $catalog, $page, $totalPages);
        }

        return $html . '</div>';
    }

    protected function renderField(array $field, FieldResolver $resolver, array $catalog, int $page, int $totalPages): string
    {
        // Accept both the React builder's shape (`kind`) and the legacy
        // shape used by older fixtures (`type`).
        $kind = $field['kind'] ?? $field['type'] ?? 'text';

        $style = sprintf(
            'position:absolute;left:%spt;top:%spt;width:%spt;height:%spt;overflow:hidden;%s%s',
            $field['x'] ?? 0,
            $field['y'] ?? 0,
            $field['w'] ?? 0,
            $field['h'] ?? 0,
            $this->boxStyle($kind, $field),
            $this->typographyStyle($field),
        );

        $content = $this->fieldContent($kind, $field, $resolver, $catalog, $page, $totalPages);

        return sprintf('<div style="%s">%s</div>', e($style), $content);
    }

    protected function fieldContent(string $kind, array $field, FieldResolver $resolver, array $catalog, int $page, int $totalPages): string
    {
        switch ($kind) {
            case 'bound':
                $bind = $field['bind'] ?? $field['key'] ?? '';
                if ($bind === '') {
                    return '';
                }
                $raw  = $resolver->resolve($bind);
                $def  = $catalog[$bind] ?? [];
                return $this->formatBound($def['type'] ?? 'text', $raw, $def);

            case 'currency':
            case 'date':
            case 'number':
            case 'longtext':
                // Legacy typed shape — resolve via bind/key, format using the
                // field's own type-specific settings.
                $token = $field['bind'] ?? $field['key'] ?? null;
                $raw   = $token ? $resolver->resolve($token) : ($field['sample'] ?? '');
                return $this->formatBound($kind, $raw, $field);

            case 'heading':
                return nl2br(e((string) ($field['text'] ?? '')));

            case 'text':
                // Builder: static text from `text`. Legacy: bind/key resolve.
                if (array_key_exists('text', $field)) {
                    return nl2br(e((string) ($field['text'] ?? '')));
                }
                $token = $field['bind'] ?? $field['key'] ?? null;
                $raw   = $token ? $resolver->resolve($token) : ($field['sample'] ?? $field['label'] ?? '');
                return e((string) ($raw ?? ''));

            case 'rect':
                // Visual styling is applied via boxStyle(); no inner content.
                return '';

            case 'image':
                $url = $field['url'] ?? null;
                if (! empty($field['bind'])) {
                    $resolved = $resolver->resolve($field['bind']);
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
                    || (! empty($field['bind']) && $resolver->resolve($field['bind']));
                return sprintf(
                    '<span style="display:inline-block;width:10pt;height:10pt;border:1pt solid #6b7280;text-align:center;line-height:10pt;">%s</span>',
                    $checked ? '&#10003;' : '&nbsp;'
                );

            case 'signature':
                $url = $field['url'] ?? null;
                if (! empty($field['bind'])) {
                    $resolved = $resolver->resolve($field['bind']);
                    if (is_string($resolved) && $resolved !== '') {
                        $url = $resolved;
                    }
                }
                if ($url) {
                    return sprintf('<img src="%s" style="width:100%%;height:100%%;object-fit:contain;" alt="" />', e($url));
                }
                return '';

            case 'qr':
                // No QR generator wired up — fall back to rendering the resolved
                // value as plain text so the placement is still visible.
                $value = $this->substituteTokens((string) ($field['value'] ?? ''), $resolver);
                return e($value);

            case 'page-number':
                $format = (string) ($field['format'] ?? 'Page {{page}} of {{total}}');
                return e(strtr($format, [
                    '{{page}}'  => (string) ($page + 1),
                    '{{total}}' => (string) $totalPages,
                ]));

            default:
                // Unknown kinds (incl. legacy typed kinds 'currency'/'date'/etc.)
                // — try $bind first, then $key, then sample/label.
                $value = ! empty($field['bind']) ? $resolver->resolve($field['bind'])
                       : (! empty($field['key']) ? $resolver->resolve($field['key'])
                       : ($field['sample'] ?? $field['label'] ?? ''));
                return e((string) ($value ?? ''));
        }
    }

    protected function formatBound(string $type, mixed $value, array $def): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        return match ($type) {
            'currency' => e($this->formatCurrency($value, $def['currency'] ?? null)),
            'date'     => e($this->formatDate($value, $def['format'] ?? null)),
            'number'   => e(is_numeric($value) ? number_format((float) $value, (int) ($def['decimals'] ?? 0)) : (string) $value),
            'longtext' => nl2br(e((string) $value)),
            default    => e((string) $value),
        };
    }

    protected function substituteTokens(string $input, FieldResolver $resolver): string
    {
        return (string) preg_replace_callback('/\{\{\s*([\w\.\-]+)\s*\}\}/', function (array $m) use ($resolver) {
            $resolved = $resolver->resolve($m[1]);
            return (string) ($resolved ?? '');
        }, $input);
    }

    protected function boxStyle(string $kind, array $field): string
    {
        if ($kind !== 'rect') {
            return '';
        }
        $safeColor = fn (string $c) => preg_replace('/[^a-zA-Z0-9#(),. ]/', '', $c);

        $parts = [];
        if (! empty($field['fill']))         $parts[] = 'background:' . $safeColor((string) $field['fill']);
        if (! empty($field['stroke']))       $parts[] = sprintf('border:%spt solid %s', (float) ($field['strokeWidth'] ?? 1), $safeColor((string) $field['stroke']));
        if (! empty($field['borderRadius'])) $parts[] = 'border-radius:' . (float) $field['borderRadius'] . 'pt';

        return $parts ? implode(';', $parts) . ';' : '';
    }

    protected function typographyStyle(array $field): string
    {
        $parts = [];
        if (! empty($field['fontSize']))   $parts[] = 'font-size:' . (float) $field['fontSize'] . 'pt';
        if (! empty($field['fontFamily'])) $parts[] = 'font-family:' . preg_replace('/[^a-zA-Z0-9 \-_,\']/', '', $field['fontFamily']);
        if (! empty($field['bold']))       $parts[] = 'font-weight:700';
        if (! empty($field['italic']))     $parts[] = 'font-style:italic';
        if (! empty($field['underline']))  $parts[] = 'text-decoration:underline';
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

    /**
     * Flatten the model definition's fields (and relation fields) into a map
     * keyed by token (e.g. "invoice.number" => ['type' => 'text', ...]).
     */
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
