<?php

namespace Kukux\PdfTemplateBuilder\Filament\Actions\Concerns;

use Closure;
use Kukux\PdfTemplateBuilder\Models\PdfTemplate;

/**
 * Shared configuration for the page-level and table-level GeneratePdfAction.
 *
 * Consumers configure the action by:
 *   - ->template(1)                       — by template id
 *   - ->template('invoice-default')       — by name (first match)
 *   - ->templateUsing(fn ($r) => …)       — dynamic resolver
 *   - ->withContexts(['org' => $org])     — extra named contexts for field tokens
 */
trait RendersPdfTemplate
{
    protected int|string|null $templateRef = null;

    protected ?Closure $templateResolver = null;

    protected array|Closure $extraContexts = [];

    public function template(int|string $idOrName): static
    {
        $this->templateRef = $idOrName;

        return $this;
    }

    public function templateUsing(Closure $resolver): static
    {
        $this->templateResolver = $resolver;

        return $this;
    }

    public function withContexts(array|Closure $contexts): static
    {
        $this->extraContexts = $contexts;

        return $this;
    }

    protected function resolveTemplate(mixed $record): ?PdfTemplate
    {
        if ($this->templateResolver) {
            $resolved = ($this->templateResolver)($record);
            return $resolved instanceof PdfTemplate ? $resolved : ($resolved ? PdfTemplate::find($resolved) : null);
        }

        if (is_int($this->templateRef) || ctype_digit((string) $this->templateRef)) {
            return PdfTemplate::find((int) $this->templateRef);
        }

        if (is_string($this->templateRef) && $this->templateRef !== '') {
            return PdfTemplate::query()->where('name', $this->templateRef)->first();
        }

        return null;
    }

    protected function resolveContexts(mixed $record): array
    {
        $ctx = $this->extraContexts;

        if ($ctx instanceof Closure) {
            $ctx = $ctx($record);
        }

        return is_array($ctx) ? $ctx : [];
    }

    protected function configureDefaults(): void
    {
        $this->label('Generate PDF');
        $this->icon('heroicon-o-document-arrow-down');
        $this->color('primary');
    }
}
