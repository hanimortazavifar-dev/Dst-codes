<?php
// LUBESTATION API settings. The Excel source address can also be changed from the site's admin
// page; a value saved there takes precedence over 'excel_url' here.

return [
    // Online Excel file to read data from (http/https). Empty = use the file uploaded on the admin page.
    'excel_url' => '',

    // How long a downloaded copy of the online file is reused before fetching again (minutes).
    'cache_minutes' => 10,

    // Largest accepted Excel file (bytes).
    'max_bytes' => 15 * 1024 * 1024,

    // Sign-in lifetime without activity (hours).
    'session_hours' => 12,

    // Where users, the uploaded file and sessions are kept. Web access to it is denied by .htaccess;
    // if your host allows it, move it outside public_html and put the full path here.
    'storage_dir' => __DIR__ . '/storage',
];
