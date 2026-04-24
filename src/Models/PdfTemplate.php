<?php

namespace Kukux\PdfTemplateBuilder\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

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

        return Storage::disk($disk)->url($this->background_pdf);
    }

    /** Number of fields placed on the canvas. */
    public function getFieldCountAttribute(): int
    {
        return count($this->fields ?? []);
    }
}
