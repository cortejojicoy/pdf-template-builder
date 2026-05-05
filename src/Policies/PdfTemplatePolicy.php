<?php

namespace Kukux\PdfTemplateBuilder\Policies;

use Illuminate\Contracts\Auth\Authenticatable;
use Kukux\PdfTemplateBuilder\Models\PdfTemplate;

/**
 * Default permissive policy: any authenticated panel user may manage templates.
 * Override by registering your own policy in AuthServiceProvider:
 *
 *   Gate::policy(PdfTemplate::class, App\Policies\PdfTemplatePolicy::class);
 */
class PdfTemplatePolicy
{
    public function viewAny(?Authenticatable $user): bool
    {
        return $user !== null;
    }

    public function view(?Authenticatable $user, PdfTemplate $template): bool
    {
        return $user !== null;
    }

    public function create(?Authenticatable $user): bool
    {
        return $user !== null;
    }

    public function update(?Authenticatable $user, PdfTemplate $template): bool
    {
        return $user !== null;
    }

    public function delete(?Authenticatable $user, PdfTemplate $template): bool
    {
        return $user !== null;
    }

    public function render(?Authenticatable $user, PdfTemplate $template): bool
    {
        return $user !== null;
    }
}
