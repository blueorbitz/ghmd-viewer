<?php

declare(strict_types=1);

/**
 * GET /api/proxy/contents/{owner}/{repo}/{path}
 * Proxies GitHub contents API requests with authentication.
 *
 * Flow:
 *   1. Read Session_Token from cookie
 *   2. Validate session exists and is not expired
 *   3. Extract installation_token from session
 *   4. Forward request to GitHub API with token
 *   5. Return response (or forward error)
 *   6. Timeout: 30 seconds max
 *
 * Requirements: 4.4, 4.6, 4.7, 4.9, 5.5
 */

require_once __DIR__ . '/../SessionManager.php';

use GhmdViewer\SessionManager;

// --- 1. Read Session_Token from cookie ---
$sessionToken = $_COOKIE['session_token'] ?? null;

if ($sessionToken === null || $sessionToken === '') {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Authentication required']);
    exit;
}

// --- 2. Validate session ---
$sessionManager = new SessionManager();
$session = $sessionManager->getSession($sessionToken);

if ($session === null) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Session invalid or expired']);
    exit;
}

// --- 3. Extract installation_token ---
$installationToken = $session['installation_token'] ?? null;

if ($installationToken === null || $installationToken === '') {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Session missing access token']);
    exit;
}

// --- 4. Parse {owner}/{repo}/{path} from request URI ---
$requestUri = $_SERVER['REQUEST_URI'] ?? '';
$uriPath = parse_url($requestUri, PHP_URL_PATH);
$prefix = '/api/proxy/contents/';

if (!str_starts_with($uriPath, $prefix)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid proxy path']);
    exit;
}

$remainder = substr($uriPath, strlen($prefix));

// remainder should be: {owner}/{repo}/{path...}
// We need at least owner/repo (path can be empty for root)
$parts = explode('/', $remainder, 3);

if (count($parts) < 2 || $parts[0] === '' || $parts[1] === '') {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid path: expected /api/proxy/contents/{owner}/{repo}/{path}']);
    exit;
}

$owner = $parts[0];
$repo = $parts[1];
$path = $parts[2] ?? '';

// --- Scope check: if session is scoped, verify the request is within allowed repo/path ---
if (!$sessionManager->isWithinScope($session, $owner, $repo, $path)) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Access denied: this session is restricted to a specific repository path']);
    exit;
}

// --- 5. Build GitHub API URL ---
$githubApiUrl = "https://api.github.com/repos/{$owner}/{$repo}/contents/{$path}";

// Forward the ?ref= query parameter for branch selection
$queryString = parse_url($requestUri, PHP_URL_QUERY);
if ($queryString !== null && $queryString !== '') {
    $githubApiUrl .= '?' . $queryString;
}

// --- 6. Forward request to GitHub API with 30-second timeout ---
$ch = curl_init();

curl_setopt_array($ch, [
    CURLOPT_URL => $githubApiUrl,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer {$installationToken}",
        'Accept: application/vnd.github.v3+json',
        'User-Agent: ghmd-viewer-backend',
    ],
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 3,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
$curlErrno = curl_errno($ch);

curl_close($ch);

// --- 7. Handle errors and forward response ---
if ($curlErrno !== 0) {
    // Curl error (timeout, network failure, etc.)
    // CURLE_OPERATION_TIMEDOUT = 28
    if ($curlErrno === CURLE_OPERATION_TIMEDOUT) {
        http_response_code(504);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Upstream request timed out']);
        exit;
    }

    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Failed to connect to GitHub API', 'detail' => $curlError]);
    exit;
}

// Forward the GitHub API response status code and body
http_response_code($httpCode);
header('Content-Type: application/json');
echo $response;
