<?php

/**
 * Router script for PHP's built-in development server.
 *
 * The built-in server serves files directly when the URI matches a real file
 * on disk. For paths like /api/proxy/raw/.../file.md, it tries to find a
 * literal file and returns 404 instead of routing to index.php.
 *
 * This script forces all requests through index.php unless the file actually
 * exists in the public directory.
 *
 * Usage: php -S localhost:8080 router.php
 */

$uri = $_SERVER['REQUEST_URI'];
$path = parse_url($uri, PHP_URL_PATH);

// If the file exists on disk (e.g., static assets), serve it directly
if ($path !== '/' && file_exists(__DIR__ . $path)) {
    return false; // Let the built-in server handle it
}

// Otherwise, route everything through index.php
require __DIR__ . '/index.php';
