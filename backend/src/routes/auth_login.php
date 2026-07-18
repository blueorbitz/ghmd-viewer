<?php

declare(strict_types=1);

/**
 * GET /api/auth/login
 *
 * Initiates the OAuth flow by redirecting to GitHub's authorization page.
 * After authorization, the callback will redirect the user to install the app
 * so that the token gains access to the selected repositories.
 *
 * Query parameters:
 *   - return_hash (optional): The SPA hash state to return to after auth
 */

require_once __DIR__ . '/../Env.php';
require_once __DIR__ . '/../SessionManager.php';

use GhmdViewer\Env;
use GhmdViewer\SessionManager;

$clientId = Env::get('GITHUB_CLIENT_ID');

if (empty($clientId)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'GitHub App client ID not configured']);
    exit;
}

// Get optional return hash from query parameter
$returnHash = $_GET['return_hash'] ?? '';

// Generate CSRF state token and store it with the original hash
$sessionManager = new SessionManager();
$state = $sessionManager->generateToken();
$sessionManager->storeState($state, [
    'original_hash' => $returnHash,
]);

// The callback URL points to the backend
$backendUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http')
    . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
$callbackUrl = $backendUrl . '/api/auth/callback';

$params = http_build_query([
    'client_id' => $clientId,
    'redirect_uri' => $callbackUrl,
    'state' => $state,
]);

$authorizationUrl = 'https://github.com/login/oauth/authorize?' . $params;

header("Location: {$authorizationUrl}");
exit;
