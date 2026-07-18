<?php

declare(strict_types=1);

/**
 * GET /api/auth/callback
 *
 * Handles the OAuth callback from GitHub after user authorization.
 * Flow:
 *   1. Validate CSRF state parameter against stored state
 *   2. Exchange authorization code for access token via GitHub API
 *   3. Generate a random Session_Token with 1-hour expiry
 *   4. Store session in file-based server-side store
 *   5. Set httpOnly, Secure, SameSite=Strict cookie
 *   6. Redirect back to SPA with original hash state
 *
 * Requirements: 4.1, 4.3, 4.5, 4.8, 5.1, 5.2
 */

require_once __DIR__ . '/../Env.php';
require_once __DIR__ . '/../SessionManager.php';

use GhmdViewer\Env;
use GhmdViewer\SessionManager;

// Check for OAuth error from GitHub (user denied access, etc.)
$error = $_GET['error'] ?? null;
if ($error !== null) {
    $errorDescription = $_GET['error_description'] ?? 'Authorization was cancelled or failed.';
    $frontendUrl = Env::get('FRONTEND_URL', 'http://localhost:5173');
    header("Location: {$frontendUrl}#/auth/error?message=" . urlencode($errorDescription));
    exit;
}

// Validate required parameters
$code = $_GET['code'] ?? null;
$state = $_GET['state'] ?? null;

if ($code === null || $state === null) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Missing required parameters: code and state']);
    exit;
}

// Validate CSRF state parameter
$sessionManager = new SessionManager();
$stateData = $sessionManager->validateState($state);

if ($stateData === null) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid or expired state parameter']);
    exit;
}

// Extract original hash from state data (for redirect after auth)
$originalHash = $stateData['original_hash'] ?? '';

// Exchange authorization code for access token
$clientId = Env::get('GITHUB_CLIENT_ID');
$clientSecret = Env::get('GITHUB_CLIENT_SECRET');

$tokenResponse = exchangeCodeForToken($code, $clientId, $clientSecret);

if ($tokenResponse === null) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Failed to exchange authorization code for access token']);
    exit;
}

if (isset($tokenResponse['error'])) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => $tokenResponse['error'],
        'error_description' => $tokenResponse['error_description'] ?? 'Token exchange failed',
    ]);
    exit;
}

$accessToken = $tokenResponse['access_token'] ?? null;
if ($accessToken === null) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'No access token in response']);
    exit;
}

// Extract refresh token and expiry (GitHub App user tokens expire after ~8 hours)
$refreshToken = $tokenResponse['refresh_token'] ?? null;
$expiresIn = isset($tokenResponse['expires_in']) ? (int) $tokenResponse['expires_in'] : null;

// Create session storing access token, refresh token, and token expiry
$sessionToken = $sessionManager->createSession($accessToken, $refreshToken, $expiresIn);

// Set httpOnly, Secure, SameSite=Lax cookie (24 hours to allow refresh cycles)
$secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
setcookie('session_token', $sessionToken, [
    'expires' => time() + 86400,
    'path' => '/',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Lax',
]);

// Redirect back to SPA OAuth callback route so the frontend can verify and store auth state
$frontendUrl = Env::get('FRONTEND_URL', 'http://localhost:5173');
$callbackHash = '/oauth/callback?return_hash=' . urlencode($originalHash);
$redirectUrl = $frontendUrl . '#' . $callbackHash;

header("Location: {$redirectUrl}");
exit;

/**
 * Exchange an OAuth authorization code for an access token via GitHub's API.
 *
 * @param string $code The authorization code from the OAuth callback
 * @param string $clientId The GitHub App client ID
 * @param string $clientSecret The GitHub App client secret
 * @return array|null The parsed JSON response, or null on failure
 */
function exchangeCodeForToken(string $code, string $clientId, string $clientSecret): ?array
{
    $url = 'https://github.com/login/oauth/access_token';

    $postData = http_build_query([
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'code' => $code,
    ]);

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", [
                'Accept: application/json',
                'Content-Type: application/x-www-form-urlencoded',
                'User-Agent: ghmd-viewer-backend',
            ]),
            'content' => $postData,
            'timeout' => 30,
        ],
    ]);

    $response = @file_get_contents($url, false, $context);

    if ($response === false) {
        return null;
    }

    $decoded = json_decode($response, true);
    if (!is_array($decoded)) {
        return null;
    }

    return $decoded;
}
