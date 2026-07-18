<?php

declare(strict_types=1);

/**
 * GET /api/proxy/raw/{owner}/{repo}/{path}
 * Proxies GitHub raw file content requests with authentication.
 *
 * Flow:
 *   1. Read Session_Token from cookie
 *   2. Validate session exists and is not expired
 *   3. Extract installation_token from session
 *   4. Forward request to raw.githubusercontent.com with token
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

// --- 3b. Refresh token if expired ---
if ($sessionManager->isTokenExpired($session)) {
    $clientId = \GhmdViewer\Env::get('GITHUB_CLIENT_ID');
    $clientSecret = \GhmdViewer\Env::get('GITHUB_CLIENT_SECRET');

    $refreshed = $sessionManager->refreshAccessToken($sessionToken, $session, $clientId, $clientSecret);
    if ($refreshed === null) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Session expired and token refresh failed. Please re-authenticate.']);
        exit;
    }
    $session = $refreshed;
    $installationToken = $session['installation_token'];
}

// --- 4. Parse {owner}/{repo}/{path} from request URI ---
$requestUri = $_SERVER['REQUEST_URI'] ?? '';
$uriPath = parse_url($requestUri, PHP_URL_PATH);
$prefix = '/api/proxy/raw/';

if (!str_starts_with($uriPath, $prefix)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid proxy path']);
    exit;
}

$remainder = substr($uriPath, strlen($prefix));

// remainder should be: {owner}/{repo}/{path...}
// We need at least owner/repo/path for raw content
$parts = explode('/', $remainder, 3);

if (count($parts) < 3 || $parts[0] === '' || $parts[1] === '' || $parts[2] === '') {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid path: expected /api/proxy/raw/{owner}/{repo}/{path}']);
    exit;
}

$owner = $parts[0];
$repo = $parts[1];
$path = $parts[2];

// --- Scope check: if session is scoped, verify the request is within allowed repo/path ---
if (!$sessionManager->isWithinScope($session, $owner, $repo, $path)) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Session is restricted to a specific repository path']);
    exit;
}

// Forward the ?ref= query parameter for branch selection
$queryString = parse_url($requestUri, PHP_URL_QUERY);
$ref = '';
if ($queryString !== null && $queryString !== '') {
    parse_str($queryString, $queryParams);
    $ref = $queryParams['ref'] ?? '';
}

// --- 5. Build raw.githubusercontent.com URL ---
// Format: https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path}
$refSegment = $ref !== '' ? $ref : 'main';
$rawUrl = "https://raw.githubusercontent.com/{$owner}/{$repo}/{$refSegment}/{$path}";

// --- 6. Forward request with 30-second timeout ---
$ch = curl_init();

curl_setopt_array($ch, [
    CURLOPT_URL => $rawUrl,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_HTTPHEADER => [
        "Authorization: token {$installationToken}",
        'User-Agent: ghmd-viewer-backend',
    ],
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 3,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$curlError = curl_error($ch);
$curlErrno = curl_errno($ch);

curl_close($ch);

// --- 7. Handle errors and forward response ---
if ($curlErrno !== 0) {
    // CURLE_OPERATION_TIMEDOUT = 28
    if ($curlErrno === CURLE_OPERATION_TIMEDOUT) {
        http_response_code(504);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Upstream request timed out']);
        exit;
    }

    http_response_code(502);
    header('Content-Type: application/json');
    error_log('proxy_raw: curl error ' . $curlErrno . ': ' . $curlError);
    echo json_encode(['error' => 'Failed to connect to GitHub']);
    exit;
}

// Forward the response with appropriate content type
http_response_code($httpCode);

if ($httpCode >= 400) {
    // Error responses forwarded as JSON
    header('Content-Type: application/json');
    echo json_encode(['error' => 'GitHub returned an error', 'status' => $httpCode]);
} else {
    // Success - forward with the content type from upstream
    if ($contentType !== null && $contentType !== '') {
        header("Content-Type: {$contentType}");
    } else {
        header('Content-Type: text/plain; charset=utf-8');
    }
    echo $response;
}
