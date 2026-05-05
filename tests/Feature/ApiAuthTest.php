<?php

use Illuminate\Foundation\Auth\User;
use Kukux\PdfTemplateBuilder\Models\PdfTemplate;

it('rejects unauthenticated GET on a template', function () {
    $template = PdfTemplate::create([
        'name' => 't', 'model_key' => 'invoice',
        'page_size' => 'Letter', 'orientation' => 'portrait',
        'pages' => 1, 'filename_pattern' => '{{id}}.pdf', 'fields' => [],
    ]);

    $this->getJson('/pdf-builder/api/templates/' . $template->id)
        ->assertStatus(401)
        ->assertJsonMissing(['name' => 't']);
})->skip('Filament auth middleware not configured in package test env — covered by integration tests in host app.');

it('validates field shape on update', function () {
    $template = PdfTemplate::create([
        'name' => 't', 'model_key' => 'invoice',
        'page_size' => 'Letter', 'orientation' => 'portrait',
        'pages' => 1, 'filename_pattern' => '{{id}}.pdf', 'fields' => [],
    ]);

    $user = new class extends User {
        protected $guarded = [];
        public $timestamps = false;
    };
    $user->id = 1;

    $this->actingAs($user)
        ->putJson('/pdf-builder/api/templates/' . $template->id, [
            'fields' => [['type' => 'text']], // missing required id, x, y, w, h
        ])
        ->assertStatus(422);
})->skip('Requires Filament panel auth — runs in host-app integration suite.');
