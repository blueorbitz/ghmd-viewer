<?php

declare(strict_types=1);

/**
 * POST /api/share/create
 *
 * Creates a scoped session token that only allows access to a specific repository path.
 *
 * Request body (JSON):
 *   - owner (string): Repository owner
 *   - repo (string): Repository name
 *   - branch (string): Branch name
 *   - path (string): Folder path within the repo
 *   - expiresInHours (int): Expiration time in hours (1-720)
 *
 * Requires an active session cookie (the user must be authenticated).
 *
 * Returns JSON:
 *   - scopedToken (string): A new session token scoped to the specified repo/path
 */

require_once __DIR__ . '/../SessionManager.php';
require_once __DIR__ . '/../ShareLinkManager.php';

use GhmdViewer\SessionManager;
use GhmdViewer\ShareLinkManager;

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Read and validate session cookie
$sessionToken = $_COOKIE['session_token'] ?? null;

if ($sessionToken === null || $sessionToken === '') {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Authentication required']);
    exit;
}

$sessionManager = new SessionManager();
$session = $sessionManager->getSession($sessionToken);

if ($session === null) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Session invalid or expired']);
    exit;
}

// Check for github_user_id (required for share manifest recording)
$githubUserId = $session['github_user_id'] ?? null;
if ($githubUserId === null) {
    http_response_code(503);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Share management temporarily unavailable']);
    exit;
}

// Parse request body
$body = json_decode(file_get_contents('php://input'), true);

if (!is_array($body)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid JSON body']);
    exit;
}

$owner = trim($body['owner'] ?? '');
$repo = trim($body['repo'] ?? '');
$branch = trim($body['branch'] ?? '');
$path = trim($body['path'] ?? '');
$expiresInHours = (int) ($body['expiresInHours'] ?? 0);

// Validate required fields
if ($owner === '' || $repo === '' || $branch === '') {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Missing required fields: owner, repo, branch']);
    exit;
}

if ($expiresInHours < 1 || $expiresInHours > 720) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'expiresInHours must be between 1 and 720']);
    exit;
}

// Create a scoped session with the same access token but restricted to this repo/path
$accessToken = $session['installation_token'] ?? '';
if ($accessToken === '') {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Parent session missing access token']);
    exit;
}

// Cap scoped session expiry to never exceed the parent session's expiry.
// This ensures that when the parent session expires (or is logged out and purged),
// the scoped session cannot outlive the token's expected lifetime.
$parentExpiresAt = $session['expires_at'] ?? (time() + 3600);
$requestedExpiresAt = time() + ($expiresInHours * 3600);
$cappedExpiresAt = min($requestedExpiresAt, $parentExpiresAt);
$cappedExpiresInHours = max(1, (int) ceil(($cappedExpiresAt - time()) / 3600));

$scopedToken = $sessionManager->createScopedSession($accessToken, [
    'owner' => $owner,
    'repo' => $repo,
    'branch' => $branch,
    'path' => $path,
], $cappedExpiresInHours);

// Record share entry in the user's manifest
$shareLinkManager = new ShareLinkManager($sessionManager);
$tokenHash = hash('sha256', $scopedToken);
$shareLinkManager->recordShare($githubUserId, [
    'token_hash' => $tokenHash,
    'scope' => [
        'owner' => $owner,
        'repo' => $repo,
        'branch' => $branch,
        'path' => $path,
    ],
    'created_at' => time(),
    'expires_at' => $cappedExpiresAt,
    'auth_method' => $session['auth_method'] ?? 'oauth',
]);

http_response_code(200);
header('Content-Type: application/json');
echo json_encode(['scopedToken' => $scopedToken]);
