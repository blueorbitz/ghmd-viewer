<?php

declare(strict_types=1);

/**
 * POST /api/share/redeem
 *
 * Sets a session cookie from a scoped token (received after client-side decryption).
 * This allows the share recipient to use the proxy endpoints with the scoped session.
 *
 * Request body (JSON):
 *   - scopedToken (string): The scoped session token
 *
 * Returns JSON:
 *   - authenticated (bool): Whether the token is valid
 *   - scope (object): The scope restrictions on the session
 */

require_once __DIR__ . '/../SessionManager.php';
require_once __DIR__ . '/../RateLimiter.php';

use GhmdViewer\SessionManager;
use GhmdViewer\RateLimiter;

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Rate limit: 10 redemption attempts per minute per IP
$rateLimiter = new RateLimiter(10, 60);
$clientIp = RateLimiter::getClientIp();

if (!$rateLimiter->attempt($clientIp, 'share_redeem')) {
    $retryAfter = $rateLimiter->retryAfter($clientIp, 'share_redeem');
    http_response_code(429);
    header('Content-Type: application/json');
    header("Retry-After: {$retryAfter}");
    echo json_encode(['error' => 'Too many attempts. Please try again later.']);
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

$scopedToken = trim($body['scopedToken'] ?? '');

if ($scopedToken === '') {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Missing scopedToken']);
    exit;
}

// Validate the scoped token
$sessionManager = new SessionManager();
$session = $sessionManager->getSession($scopedToken);

if ($session === null) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid or expired scoped token']);
    exit;
}

// Verify it's actually a scoped session
if (!isset($session['scope'])) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Token is not a scoped session']);
    exit;
}

// Set the session cookie so the proxy endpoints can use it
$secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
$expiresAt = $session['expires_at'] ?? (time() + 3600);

setcookie('session_token', $scopedToken, [
    'expires' => $expiresAt,
    'path' => '/',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Strict',
]);

http_response_code(200);
header('Content-Type: application/json');
echo json_encode([
    'authenticated' => true,
    'scope' => $session['scope'],
]);
