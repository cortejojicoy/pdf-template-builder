<?php

namespace Kukux\PdfTemplateBuilder\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Kukux\PdfTemplateBuilder\Rendering\Contracts\PdfEngine;
use Kukux\PdfTemplateBuilder\Rendering\Contracts\TemplateAwarePdfEngine;
use Kukux\PdfTemplateBuilder\Rendering\FieldResolver;
use Kukux\PdfTemplateBuilder\Rendering\HtmlTemplateRenderer;
use Symfony\Component\HttpFoundation\Response;

class PdfTemplate extends Model
{
    protected $table = 'pdf_templates';

    protected $fillable = [
        'name',
        'model_key',
        'page_size',
        'orientation',
        'pages',
        'filename_pattern',
        'fields',
        'background_pdf',
        'used_in',
        'disk',
    ];

    protected $casts = [
        'fields' => 'array',
        'pages'  => 'integer',
    ];

    /** URL to the background PDF (if uploaded). */
    public function getBackgroundUrlAttribute(): ?string
    {
        if (! $this->background_pdf) {
            return null;
        }

        $disk = $this->disk ?: config('pdf-template-builder.disk', 'public');
        $fs   = Storage::disk($disk);

        if (method_exists($fs, 'temporaryUrl')) {
            try {
                return $fs->temporaryUrl($this->background_pdf, now()->addMinutes(30));
            } catch (\Throwable) {
                // Falls through to public url
            }
        }

        return $fs->url($this->background_pdf);
    }

    /** Number of fields placed on the canvas. */
    public function getFieldCountAttribute(): int
    {
        return count($this->fields ?? []);
    }

    /**
     * Render the template against an Eloquent record (or array) to HTML.
     *
     * @param  array<string,mixed>  $contexts  Extra named contexts available to field tokens.
     */
    public function render(mixed $record, array $contexts = []): string
    {
        return app(HtmlTemplateRenderer::class)->render($this, $record, $contexts);
    }

    /**
     * Render the template to the configured PDF engine and return an HTTP response.
     */
    public function stream(mixed $record, array $contexts = [], ?PdfEngine $engine = null): Response
    {
        $engine ??= app(PdfEngine::class);

        $options = [
            'page_size'   => $this->page_size,
            'orientation' => $this->orientation,
        ];

        // Template-aware engines (e.g. FpdiEngine) bypass HTML and operate on the template directly.
        if ($engine instanceof TemplateAwarePdfEngine) {
            return $engine->renderTemplate($this, $record, $contexts, $options);
        }

        $html     = $this->render($record, $contexts);
        $filename = $this->resolveFilename($record);

        return $engine->render($html, $filename, $options);
    }

    /**
     * Replace {{token}} placeholders in `filename_pattern` with values from $record.
     */
    public function resolveFilename(mixed $record): string
    {
        $pattern  = $this->filename_pattern ?: '{{id}}.pdf';
        $resolver = new FieldResolver($record, $this->model_key);

        $filename = preg_replace_callback('/\{\{\s*([\w\.\-]+)\s*\}\}/', function (array $m) use ($resolver, $record) {
            $token = $m[1];
            if ($token === 'id' && is_object($record) && method_exists($record, 'getKey')) {
                return (string) $record->getKey();
            }
            $value = $resolver->resolve($token);
            return (string) ($value ?? $m[0]);
        }, $pattern);

        // Sanitize for filesystem
        $filename = preg_replace('/[^A-Za-z0-9\.\-_]+/', '_', $filename ?? '');

        if (! str_ends_with(strtolower($filename), '.pdf')) {
            $filename .= '.pdf';
        }

        return $filename;
    }
}
