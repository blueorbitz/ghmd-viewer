<?php

declare(strict_types=1);

/**
 * POST /api/auth/logout
 *
 * Invalidates the current session and clears the session cookie.
 *
 * Flow:
 *   1. Read session_token from cookie
 *   2. Destroy the session server-side
 *   3. Clear the cookie by setting expired Max-Age
 *   4. Return 200 JSON response
 *
 * Requirements: 5.3, 5.4
 */

require_once __DIR__ . '/../SessionManager.php';
require_once __DIR__ . '/../Env.php';

use GhmdViewer\SessionManager;
use GhmdViewer\Env;

header('Content-Type: application/json');

// Read the session token from the cookie
$sessionToken = $_COOKIE['session_token'] ?? null;

$sessionManager = new SessionManager();

if ($sessionToken !== null && $sessionToken !== '') {
    // Invalidate the session server-side so subsequent requests return 401
    $sessionManager->destroySession($sessionToken);
}

// Clear the session cookie by setting it with an expired Max-Age
$secure = Env::get('APP_ENV', 'production') !== 'development';
$cookieOptions = [
    'expires' => time() - 3600,
    'path' => '/',
    'httponly' => true,
    'secure' => $secure,
    'samesite' => 'Strict',
];
setcookie('session_token', '', $cookieOptions);

http_response_code(200);
echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
