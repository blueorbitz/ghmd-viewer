<?php

declare(strict_types=1);

/**
 * POST /api/auth/pat-login
 *
 * Authenticates a user via a GitHub Personal Access Token (PAT).
 * Flow:
 *   1. Parse and validate JSON request body
 *   2. Enforce token length limit (≤ 256 characters)
 *   3. Enforce HTTPS in production mode
 *   4. Validate optional scope field
 *   5. Call GitHub /user endpoint to validate the token (10-second timeout)
 *   6. Create session and set cookie on success
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.1, 5.2, 6.1, 6.3, 6.4
 */

require_once __DIR__ . '/../Env.php';
require_once __DIR__ . '/../SessionManager.php';

use GhmdViewer\Env;
use GhmdViewer\SessionManager;

header('Content-Type: application/json');

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Enforce HTTPS in production mode
if (Env::get('APP_ENV') === 'production') {
    $isHttps = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    if (!$isHttps) {
        http_response_code(400);
        echo json_encode(['error' => 'Secure connection required']);
        exit;
    }
}

// Parse JSON request body
$rawBody = file_get_contents('php://input');
$body = json_decode($rawBody, true);

// Validate JSON and token field
if (
    !is_array($body)
    || !isset($body['token'])
    || !is_string($body['token'])
    || trim($body['token']) === ''
) {
    http_response_code(400);
    echo json_encode(['error' => 'A valid token is required']);
    exit;
}

$token = $body['token'];

// Enforce token length limit (≤ 256 characters)
if (strlen($token) > 256) {
    http_response_code(400);
    echo json_encode(['error' => 'Token format is invalid']);
    exit;
}

// Validate optional scope field
$scope = null;
if (isset($body['scope'])) {
    $scopeData = $body['scope'];
    if (
        !is_array($scopeData)
        || !isset($scopeData['owner'])
        || !isset($scopeData['repo'])
        || !is_string($scopeData['owner'])
        || !is_string($scopeData['repo'])
        || trim($scopeData['owner']) === ''
        || trim($scopeData['repo']) === ''
    ) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid scope format: owner and repo are required']);
        exit;
    }
    $scope = [
        'owner' => $scopeData['owner'],
        'repo' => $scopeData['repo'],
    ];
}

// Call GitHub /user endpoint to validate the token
$githubResponse = validateTokenWithGitHub($token);

if ($githubResponse['status'] === 'timeout') {
    http_response_code(502);
    echo json_encode(['error' => 'Unable to verify token: GitHub API is unreachable']);
    exit;
}

if ($githubResponse['status'] === 'unauthorized') {
    http_response_code(401);
    echo json_encode(['error' => 'Token is invalid or expired']);
    exit;
}

if ($githubResponse['status'] !== 'success') {
    http_response_code(502);
    echo json_encode(['error' => 'Unable to verify token: GitHub API is unreachable']);
    exit;
}

// Create session via SessionManager
$sessionManager = new SessionManager();
$sessionToken = $sessionManager->createPatSession($token, $scope);

// Set httpOnly, Secure, SameSite=Strict cookie (24 hours for PAT sessions)
$secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
setcookie('session_token', $sessionToken, [
    'expires' => time() + 86400,
    'path' => '/',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Strict',
]);

// Return success response (never include the PAT value)
http_response_code(200);
echo json_encode(['authenticated' => true]);
exit;

/**
 * Validate a GitHub PAT by calling the /user endpoint.
 *
 * @param string $token The GitHub Personal Access Token
 * @return array{status: string} Result with status: 'success', 'unauthorized', or 'timeout'
 */
function validateTokenWithGitHub(string $token): array
{
    $url = 'https://api.github.com/user';

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => implode("\r\n", [
                'Authorization: Bearer ' . $token,
                'Accept: application/json',
                'User-Agent: ghmd-viewer-backend',
            ]),
            'timeout' => 10,
            'ignore_errors' => true,
        ],
    ]);

    $response = @file_get_contents($url, false, $context);

    // Check if the request failed entirely (timeout or unreachable)
    if ($response === false) {
        return ['status' => 'timeout'];
    }

    // Parse response headers to get the HTTP status code
    $httpCode = 0;
    if (isset($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $header) {
            if (preg_match('/^HTTP\/[\d.]+ (\d+)/', $header, $matches)) {
                $httpCode = (int) $matches[1];
            }
        }
    }

    if ($httpCode === 200) {
        return ['status' => 'success'];
    }

    if ($httpCode === 401) {
        return ['status' => 'unauthorized'];
    }

    // Any other status code is treated as an error
    return ['status' => 'error'];
}
