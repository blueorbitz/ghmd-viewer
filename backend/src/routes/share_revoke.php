<?php

declare(strict_types=1);

/**
 * POST /api/shares/revoke
 *
 * Revokes a specific share link by deleting its scoped session file
 * and removing it from the user's share manifest.
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

// Reject scoped sessions
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

// Parse request body
$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body) || !isset($body['token_hash']) || !is_string($body['token_hash']) || trim($body['token_hash']) === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required field: token_hash']);
    exit;
}

$tokenHash = trim($body['token_hash']);

// Revoke the share
$shareLinkManager = new ShareLinkManager($sessionManager);
$revoked = $shareLinkManager->revokeShare($githubUserId, $tokenHash);

if (!$revoked) {
    http_response_code(404);
    echo json_encode(['error' => 'Share link not found']);
    exit;
}

echo json_encode(['revoked' => true]);
