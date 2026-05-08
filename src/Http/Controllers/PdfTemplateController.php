<?php

namespace Kukux\PdfTemplateBuilder\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Storage;
use Kukux\PdfTemplateBuilder\Models\PdfTemplate;
use Kukux\PdfTemplateBuilder\PdfTemplateBuilderPlugin;

class PdfTemplateController extends Controller
{
    use AuthorizesRequests;

    /** GET /pdf-builder/api — health check / route name anchor */
    public function base(): JsonResponse
    {
        return response()->json(['ok' => true]);
    }

    /** GET /pdf-builder/api/templates/{id} */
    public function show(int $id): JsonResponse
    {
        $template = PdfTemplate::findOrFail($id);
        $this->authorize('view', $template);

        return response()->json($this->templatePayload($template));
    }

    /** PUT /pdf-builder/api/templates/{id} */
    public function update(Request $request, int $id): JsonResponse
    {
        $template = PdfTemplate::findOrFail($id);
        $this->authorize('update', $template);

        $validated = $request->validate([
            'name'                  => 'sometimes|string|max:255',
            'fields'                => 'sometimes|array',
            'fields.*.id'           => 'required_with:fields|string|max:64',
            'fields.*.kind'         => 'required_with:fields|string|max:32',
            'fields.*.x'            => 'required_with:fields|numeric',
            'fields.*.y'            => 'required_with:fields|numeric',
            'fields.*.w'            => 'required_with:fields|numeric|min:0',
            'fields.*.h'            => 'required_with:fields|numeric|min:0',
            'fields.*.page'         => 'sometimes|integer|min:0',
            'fields.*.key'          => 'sometimes|nullable|string|max:255',
            'fields.*.label'        => 'sometimes|nullable|string|max:255',
            'fields.*.fontSize'     => 'sometimes|nullable|numeric|min:1|max:512',
            'fields.*.fontFamily'   => 'sometimes|nullable|string|max:64',
            'fields.*.color'        => 'sometimes|nullable|string|max:32',
            'fields.*.align'        => 'sometimes|nullable|in:left,center,right',
            'fields.*.bold'         => 'sometimes|boolean',
            'fields.*.italic'       => 'sometimes|boolean',
            'pages'                 => 'sometimes|integer|min:1|max:200',
            'page_size'             => 'sometimes|string|in:Letter,A4,Legal',
            'orientation'           => 'sometimes|string|in:portrait,landscape',
            'filename_pattern'      => 'sometimes|string|max:255',
            'used_in'               => 'sometimes|nullable|string|max:255',
        ]);

        $template->update($validated);

        return response()->json($this->templatePayload($template));
    }

    /** POST /pdf-builder/api/templates/{id}/upload — replace background PDF */
    public function upload(Request $request, int $id): JsonResponse
    {
        $template = PdfTemplate::findOrFail($id);
        $this->authorize('update', $template);

        $request->validate([
            'pdf' => 'required|file|mimes:pdf|mimetypes:application/pdf|max:10240',
        ]);

        /** @var PdfTemplateBuilderPlugin $plugin */
        $plugin = filament()->getPlugin('pdf-template-builder');
        $disk   = $plugin->getDisk();
        $path   = $plugin->getUploadPath();

        if ($template->background_pdf) {
            Storage::disk($template->disk ?: $disk)->delete($template->background_pdf);
        }

        $stored = $request->file('pdf')->store($path, $disk);

        $template->update([
            'background_pdf' => $stored,
            'disk'           => $disk,
        ]);

        return response()->json([
            'background_url' => $template->fresh()->background_url,
        ]);
    }

    /** DELETE /pdf-builder/api/templates/{id} */
    public function destroy(int $id): JsonResponse
    {
        $template = PdfTemplate::findOrFail($id);
        $this->authorize('delete', $template);

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
