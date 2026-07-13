<?php

declare(strict_types=1);

/**
 * GET /api/auth/status
 *
 * Returns the current authentication status based on the session cookie.
 *
 * Response:
 *   { "authenticated": true }  — valid, non-expired session exists
 *   { "authenticated": false } — no session or expired session
 *
 * Requirements: 3.2, 5.3
 */

require_once __DIR__ . '/../SessionManager.php';

use GhmdViewer\SessionManager;

header('Content-Type: application/json');

// Read the session token from the cookie
$sessionToken = $_COOKIE['session_token'] ?? null;

if ($sessionToken === null || $sessionToken === '') {
    http_response_code(200);
    echo json_encode(['authenticated' => false]);
    exit;
}

// Validate the session exists and is not expired
$sessionManager = new SessionManager();
$session = $sessionManager->getSession($sessionToken);

if ($session === null) {
    http_response_code(200);
    echo json_encode(['authenticated' => false]);
    exit;
}

http_response_code(200);
echo json_encode(['authenticated' => true]);
