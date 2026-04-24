<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Navigation Group
    |--------------------------------------------------------------------------
    | The Filament navigation group to nest the PDF Templates link under.
    | Set to null to show at the top level.
    */
    'navigation_group' => null,

    /*
    |--------------------------------------------------------------------------
    | Storage Disk
    |--------------------------------------------------------------------------
    | The Laravel filesystem disk used to store uploaded background PDFs.
    */
    'disk' => env('PDF_TEMPLATE_DISK', 'public'),

    /*
    |--------------------------------------------------------------------------
    | Upload Path
    |--------------------------------------------------------------------------
    | Directory within the disk where background PDFs are stored.
    */
    'upload_path' => 'pdf-templates/backgrounds',

    /*
    |--------------------------------------------------------------------------
    | Models
    |--------------------------------------------------------------------------
    | Register the Eloquent models and their field definitions here.
    | Each entry maps a short "key" to a descriptor used by the builder.
    |
    | You may override this at runtime via:
    |   PdfTemplateBuilderPlugin::make()->models([...])
    |
    | Field types: text | longtext | number | currency | date | image | signature | table
    */
    'models' => [
        // Example:
        // 'invoice' => [
        //     'label'  => 'Invoice',
        //     'icon'   => 'receipt',
        //     'class'  => App\Models\Invoice::class,
        //     'fields' => [
        //         ['key' => 'invoice.number',    'label' => 'Number',    'type' => 'text',     'sample' => 'INV-0001'],
        //         ['key' => 'invoice.issued_at', 'label' => 'Issued at', 'type' => 'date',     'sample' => 'Jan 1, 2026'],
        //         ['key' => 'invoice.total',     'label' => 'Total',     'type' => 'currency', 'sample' => '$1,200.00'],
        //         ['key' => 'invoice.line_items','label' => 'Line items','type' => 'table',    'sample' => '[table]'],
        //         ['key' => 'invoice.notes',     'label' => 'Notes',     'type' => 'longtext', 'sample' => 'Thank you.'],
        //     ],
        //     'relations' => [
        //         'customer' => [
        //             'label'  => 'Customer',
        //             'fields' => [
        //                 ['key' => 'customer.name',    'label' => 'Name',    'type' => 'text', 'sample' => 'Acme Inc.'],
        //                 ['key' => 'customer.email',   'label' => 'Email',   'type' => 'text', 'sample' => 'hi@acme.co'],
        //                 ['key' => 'customer.address', 'label' => 'Address', 'type' => 'longtext', 'sample' => '221B Baker St'],
        //             ],
        //         ],
        //     ],
        // ],
    ],

];