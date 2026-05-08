<?php

namespace Kukux\PdfTemplateBuilder\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureAuthenticatedJson
{
    public function handle(Request $request, Closure $next)
    {
        if (! auth()->check()) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return $next($request);
    }
}
