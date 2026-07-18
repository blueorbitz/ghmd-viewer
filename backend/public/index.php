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

// Resolve base path for backend internals.
// In production (flat deploy), files are in _app/ alongside index.php.
// In local dev (php -S from public/), files are one level up (../).
if (is_dir(__DIR__ . '/_app/src')) {
    define('APP_BASE', __DIR__ . '/_app');
} else {
    define('APP_BASE', dirname(__DIR__));
}

// Load environment variables
require_once APP_BASE . '/src/Env.php';

use GhmdViewer\Env;

Env::load(APP_BASE . '/.env');

// CORS handling
$frontendUrl = Env::get('FRONTEND_URL', 'http://localhost:5173');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($origin === $frontendUrl) {
    header("Access-Control-Allow-Origin: {$frontendUrl}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Accept, X-Requested-With');
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

// CSRF protection: POST requests to API must include X-Requested-With header.
// This prevents cross-origin form submissions since custom headers trigger
// a CORS preflight that will be blocked for unauthorized origins.
if ($method === 'POST') {
    $xRequestedWith = $_SERVER['HTTP_X_REQUESTED_WITH'] ?? '';
    if ($xRequestedWith !== 'XMLHttpRequest') {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Forbidden: missing CSRF header']);
        exit;
    }
}

// Route matching
switch (true) {
    // Auth routes
    case $method === 'GET' && $path === '/api/auth/login':
        require APP_BASE . '/src/routes/auth_login.php';
        break;

    case $method === 'GET' && $path === '/api/auth/callback':
        require APP_BASE . '/src/routes/auth_callback.php';
        break;

    case $method === 'POST' && $path === '/api/auth/pat-login':
        require APP_BASE . '/src/routes/auth_pat_login.php';
        break;

    case $method === 'POST' && $path === '/api/auth/logout':
        require APP_BASE . '/src/routes/auth_logout.php';
        break;

    case $method === 'POST' && $path === '/api/share/create':
        require APP_BASE . '/src/routes/share_create.php';
        break;

    case $method === 'POST' && $path === '/api/share/redeem':
        require APP_BASE . '/src/routes/share_redeem.php';
        break;

    case $method === 'POST' && $path === '/api/shares/revoke':
        require APP_BASE . '/src/routes/share_revoke.php';
        break;

    case $method === 'GET' && $path === '/api/shares':
        require APP_BASE . '/src/routes/share_list.php';
        break;

    case $method === 'POST' && $path === '/api/shares/revoke':
        require APP_BASE . '/src/routes/share_revoke.php';
        break;

    case $method === 'GET' && $path === '/api/auth/status':
        require APP_BASE . '/src/routes/auth_status.php';
        break;

    // Proxy routes
    case $method === 'GET' && str_starts_with($path, '/api/proxy/contents/'):
        require APP_BASE . '/src/routes/proxy_contents.php';
        break;

    case $method === 'GET' && str_starts_with($path, '/api/proxy/raw/'):
        require APP_BASE . '/src/routes/proxy_raw.php';
        break;

    // Not found
    default:
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Not found']);
        break;
}
