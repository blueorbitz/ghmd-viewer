<?php

declare(strict_types=1);

/**
 * GET /api/shares
 *
 * Lists all share links created by the authenticated user.
 * Returns share entries with scope, timestamps, auth_method, and computed status.
 */

require_once APP_BASE . '/src/SessionManager.php';
require_once APP_BASE . '/src/ShareLinkManager.php';

use GhmdViewer\SessionManager;
use GhmdViewer\ShareLinkManager;

header('Content-Type: application/json');

// Validate session cookie
$sessionToken = $_COOKIE['session_token'] ?? null;
if ($sessionToken === null || $sessionToken === '') {
    http_response_code(401);
    echo json_encode(['error' => 'Authentication required']);
    exit;
}

$sessionManager = new SessionManager();
$session = $sessionManager->getSession($sessionToken);

if ($session === null) {
    http_response_code(401);
    echo json_encode(['error' => 'Session invalid or expired']);
    exit;
}

// Reject scoped sessions (they don't own shares)
if (isset($session['scope'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Share management requires a full session']);
    exit;
}

// Check for github_user_id
$githubUserId = $session['github_user_id'] ?? null;
if ($githubUserId === null) {
    http_response_code(503);
    echo json_encode(['error' => 'Share management temporarily unavailable']);
    exit;
}

// List shares
$shareLinkManager = new ShareLinkManager($sessionManager);
$shares = $shareLinkManager->listShares($githubUserId);

echo json_encode($shares);
