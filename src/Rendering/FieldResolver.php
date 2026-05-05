<?php

namespace Kukux\PdfTemplateBuilder\Rendering;

use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Database\Eloquent\Model;

/**
 * Resolves a field's `key` token (e.g. "invoice.number", "customer.name")
 * against an Eloquent model, array, or arbitrary data context.
 *
 * The first segment of the key may match the template's `model_key`, in
 * which case it's stripped (so "invoice.number" becomes "number" against
 * an Invoice model). Otherwise the full key is treated as a relation path
 * (e.g. "customer.name" walks $invoice->customer->name).
 */
class FieldResolver
{
    public function __construct(
        protected mixed $record,
        protected ?string $modelKey = null,
        /** @var array<string, mixed> Additional named contexts keyed by name. */
        protected array $contexts = [],
    ) {}

    public function resolve(string $token): mixed
    {
        $token = trim($token);
        if ($token === '') {
            return null;
        }

        $segments = explode('.', $token);
        $head     = array_shift($segments);

        if ($head === $this->modelKey) {
            return data_get($this->normalize($this->record), implode('.', $segments));
        }

        if (array_key_exists($head, $this->contexts)) {
            return data_get($this->normalize($this->contexts[$head]), implode('.', $segments));
        }

        return data_get($this->normalize($this->record), $token);
    }

    protected function normalize(mixed $value): mixed
    {
        if ($value instanceof Model) {
            return $value;
        }

        if ($value instanceof Arrayable) {
            return $value->toArray();
        }

        return $value;
    }
}
