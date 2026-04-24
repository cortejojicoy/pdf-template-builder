<?php

namespace Kukux\PdfTemplateBuilder\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Storage;
use Kukux\PdfTemplateBuilder\Models\PdfTemplate;
use Kukux\PdfTemplateBuilder\PdfTemplateBuilderPlugin;

class PdfTemplateController extends Controller
{
    public function __construct()
    {
        $this->middleware(['web', 'auth']);
    }

    /** GET /filament-pdf-builder/api/base — just for route naming */
    public function base(): JsonResponse
    {
        return response()->json(['ok' => true]);
    }

    /** GET /filament-pdf-builder/api/templates/{id} */
    public function show(int $id): JsonResponse
    {
        $template = PdfTemplate::findOrFail($id);

        return response()->json($this->templatePayload($template));
    }

    /** PUT /filament-pdf-builder/api/templates/{id} */
    public function update(Request $request, int $id): JsonResponse
    {
        $template = PdfTemplate::findOrFail($id);

        $validated = $request->validate([
            'name'             => 'sometimes|string|max:255',
            'fields'           => 'sometimes|array',
            'pages'            => 'sometimes|integer|min:1',
            'page_size'        => 'sometimes|string|in:Letter,A4,Legal',
            'orientation'      => 'sometimes|string|in:portrait,landscape',
            'filename_pattern' => 'sometimes|string|max:255',
            'used_in'          => 'sometimes|nullable|string|max:255',
        ]);

        $template->update($validated);

        return response()->json($this->templatePayload($template));
    }

    /** POST /filament-pdf-builder/api/templates/{id}/upload — replace background PDF */
    public function upload(Request $request, int $id): JsonResponse
    {
        $template = PdfTemplate::findOrFail($id);

        $request->validate([
            'pdf' => 'required|file|mimes:pdf|max:10240',
        ]);

        /** @var PdfTemplateBuilderPlugin $plugin */
        $plugin = filament()->getPlugin('pdf-template-builder');
        $disk   = $plugin->getDisk();
        $path   = $plugin->getUploadPath();

        // Delete previous file if exists
        if ($template->background_pdf) {
            Storage::disk($disk)->delete($template->background_pdf);
        }

        $stored = $request->file('pdf')->store($path, $disk);

        $template->update([
            'background_pdf' => $stored,
            'disk'           => $disk,
        ]);

        return response()->json([
            'background_url' => Storage::disk($disk)->url($stored),
        ]);
    }

    /** DELETE /filament-pdf-builder/api/templates/{id} */
    public function destroy(int $id): JsonResponse
    {
        $template = PdfTemplate::findOrFail($id);

        if ($template->background_pdf) {
            $disk = $template->disk ?: filament()->getPlugin('pdf-template-builder')->getDisk();
            Storage::disk($disk)->delete($template->background_pdf);
        }

        $template->delete();

        return response()->json(['ok' => true]);
    }

    protected function templatePayload(PdfTemplate $template): array
    {
        return [
            'id'               => $template->id,
            'name'             => $template->name,
            'model_key'        => $template->model_key,
            'page_size'        => $template->page_size,
            'orientation'      => $template->orientation,
            'pages'            => $template->pages,
            'filename_pattern' => $template->filename_pattern,
            'fields'           => $template->fields ?? [],
            'background_url'   => $template->background_url,
            'used_in'          => $template->used_in,
            'updated_at'       => $template->updated_at?->toISOString(),
        ];
    }
}