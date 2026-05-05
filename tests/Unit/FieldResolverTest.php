<?php

use Kukux\PdfTemplateBuilder\Rendering\FieldResolver;

it('strips matching model_key prefix from token', function () {
    $resolver = new FieldResolver(['number' => 'INV-001'], 'invoice');

    expect($resolver->resolve('invoice.number'))->toBe('INV-001');
});

it('falls back to dot-path when prefix does not match', function () {
    $invoice = ['customer' => ['name' => 'Acme']];
    $resolver = new FieldResolver($invoice, 'invoice');

    expect($resolver->resolve('customer.name'))->toBe('Acme');
});

it('resolves named contexts', function () {
    $resolver = new FieldResolver(
        record: ['number' => 'INV-001'],
        modelKey: 'invoice',
        contexts: ['org' => ['name' => 'Anthropic']],
    );

    expect($resolver->resolve('org.name'))->toBe('Anthropic');
});

it('returns null for empty or unknown tokens', function () {
    $resolver = new FieldResolver(['x' => 1], 'invoice');

    expect($resolver->resolve(''))->toBeNull();
    expect($resolver->resolve('nope.unknown'))->toBeNull();
});
