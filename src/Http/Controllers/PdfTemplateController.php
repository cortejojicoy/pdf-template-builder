<?php

namespace Kukux\PdfTemplateBuilder\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Storage;
use Kukux\PdfTemplateBuilder\Models\PdfTemplate;
use Kukux\PdfTemplateBuilder\PdfTemplateBuilderPlugin;
use Symfony\Component\HttpFoundation\Response;

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

        // Validate structure only. Field-shape properties (bind, text, url,
        // format, checked, value, fill, stroke, …) vary per `kind` and are
        // preserved verbatim from the request — listing them here would strip
        // any not-yet-known keys from $validated.
        $request->validate([
            'name'                  => 'sometimes|string|max:255',
            'fields'                => 'sometimes|array',
            'fields.*.id'           => 'required_with:fields|string|max:64',
            'fields.*.kind'         => 'required_with:fields|string|max:32',
            'fields.*.x'            => 'required_with:fields|numeric',
            'fields.*.y'            => 'required_with:fields|numeric',
            'fields.*.w'            => 'required_with:fields|numeric|min:0',
            'fields.*.h'            => 'required_with:fields|numeric|min:0',
            'fields.*.page'         => 'sometimes|integer|min:0',
            'pages'                 => 'sometimes|integer|min:1|max:200',
            'page_size'             => 'sometimes|string|in:Letter,A4,Legal',
            'orientation'           => 'sometimes|string|in:portrait,landscape',
            'filename_pattern'      => 'sometimes|string|max:255',
            'used_in'               => 'sometimes|nullable|string|max:255',
        ]);

        $data = $request->only([
            'name', 'pages', 'page_size', 'orientation', 'filename_pattern', 'used_in',
        ]);

        if ($request->has('fields')) {
            $data['fields'] = $request->input('fields');
        }

        $template->update($data);

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

        // Resolve the configured plugin singleton directly. The API routes
        // run outside of any Filament panel, so filament()->getPlugin() would
        // throw "Plugin … is not registered for panel".
        $plugin = app(PdfTemplateBuilderPlugin::class);
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

    /** GET /pdf-builder/api/templates/{id}/preview — render PDF with sample data, inline */
    public function preview(int $id): Response
    {
        $template = PdfTemplate::findOrFail($id);
        $this->authorize('view', $template);

        $plugin   = app(PdfTemplateBuilderPlugin::class);
        $modelDef = $plugin->getModels()[$template->model_key] ?? null;

        $sample = [];
        $assign = function (array $f) use ($template, &$sample) {
            $key = $f['key'] ?? '';
            $rel = ($template->model_key && str_starts_with($key, $template->model_key . '.'))
                ? substr($key, strlen($template->model_key) + 1)
                : $key;
            if ($rel !== '') {
                data_set($sample, $rel, $f['sample'] ?? '');
            }
        };

        foreach ($modelDef['fields'] ?? [] as $f) {
            $assign($f);
        }
        foreach ($modelDef['relations'] ?? [] as $relation) {
            foreach ($relation['fields'] ?? [] as $f) {
                $assign($f);
            }
        }

        return $template->stream($sample);
    }

    /** DELETE /pdf-builder/api/templates/{id} */
    public function destroy(int $id): JsonResponse
    {
        $template = PdfTemplate::findOrFail($id);
        $this->authorize('delete', $template);

        if ($template->background_pdf) {
            $disk = $template->disk ?: app(PdfTemplateBuilderPlugin::class)->getDisk();
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
