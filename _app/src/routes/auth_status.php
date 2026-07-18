<?php

declare(strict_types=1);

/**
 * GET /api/auth/status
 *
 * Returns the current authentication status based on the session cookie.
 *
 * Response:
 *   { "authenticated": true, "auth_method": "oauth" }  — valid OAuth session
 *   { "authenticated": true, "auth_method": "pat" }    — valid PAT session
 *   { "authenticated": false }                         — no session or expired session
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
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

// Include auth_method from session data, defaulting to "oauth" for backward compatibility
$authMethod = $session['auth_method'] ?? 'oauth';

// Include app install URL so the frontend can prompt installation if needed
$appSlug = \GhmdViewer\Env::get('GITHUB_APP_SLUG');
$response = ['authenticated' => true, 'auth_method' => $authMethod];
if (!empty($appSlug)) {
    $response['app_install_url'] = "https://github.com/apps/{$appSlug}/installations/new";
}

// Indicate if this is a scoped (share link) session
if (isset($session['scope'])) {
    $response['scoped'] = true;
}

http_response_code(200);
echo json_encode($response);
