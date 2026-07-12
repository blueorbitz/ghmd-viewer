<?php

declare(strict_types=1);

/**
 * Entry point and router for the GitHub Markdown Viewer Auth Backend.
 *
 * Routes:
 *   GET  /api/auth/login       - Initiate OAuth redirect to GitHub
 *   GET  /api/auth/callback    - Handle OAuth callback
 *   POST /api/auth/logout      - Invalidate session
 *   GET  /api/auth/status      - Check auth status
 *   GET  /api/proxy/contents/… - Proxy GitHub contents API
 *   GET  /api/proxy/raw/…      - Proxy GitHub raw file content
 */

// Load environment variables
require_once __DIR__ . '/../src/Env.php';

use GhmdViewer\Env;

Env::load(__DIR__ . '/../.env');

// CORS handling
$frontendUrl = Env::get('FRONTEND_URL', 'http://localhost:5173');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($origin === $frontendUrl) {
    header("Access-Control-Allow-Origin: {$frontendUrl}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Accept');
}

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Parse request URI
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($requestUri, PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Route matching
switch (true) {
    // Auth routes
    case $method === 'GET' && $path === '/api/auth/login':
        require __DIR__ . '/../src/routes/auth_login.php';
        break;

    case $method === 'GET' && $path === '/api/auth/callback':
        require __DIR__ . '/../src/routes/auth_callback.php';
        break;

    case $method === 'POST' && $path === '/api/auth/logout':
        require __DIR__ . '/../src/routes/auth_logout.php';
        break;

    case $method === 'POST' && $path === '/api/share/create':
        require __DIR__ . '/../src/routes/share_create.php';
        break;

    case $method === 'POST' && $path === '/api/share/redeem':
        require __DIR__ . '/../src/routes/share_redeem.php';
        break;

    case $method === 'GET' && $path === '/api/auth/status':
        require __DIR__ . '/../src/routes/auth_status.php';
        break;

    // Proxy routes
    case $method === 'GET' && str_starts_with($path, '/api/proxy/contents/'):
        require __DIR__ . '/../src/routes/proxy_contents.php';
        break;

    case $method === 'GET' && str_starts_with($path, '/api/proxy/raw/'):
        require __DIR__ . '/../src/routes/proxy_raw.php';
        break;

    // Not found
    default:
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Not found']);
        break;
}
