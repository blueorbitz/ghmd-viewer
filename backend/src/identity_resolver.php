<?php

declare(strict_types=1);

/**
 * Identity Resolver
 *
 * Fetches the GitHub numeric user ID from the /user endpoint.
 * Used during OAuth and PAT authentication flows to associate
 * a stable identity with the session for share manifest lookup.
 */

/**
 * Resolve the GitHub user ID by calling GET https://api.github.com/user.
 *
 * @param string $accessToken A valid GitHub access token (OAuth or PAT)
 * @return int|null The numeric GitHub user ID, or null on failure
 */
function resolveGitHubUserId(string $accessToken): ?int
{
    $url = 'https://api.github.com/user';

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => implode("\r\n", [
                'Authorization: Bearer ' . $accessToken,
                'Accept: application/json',
                'User-Agent: ghmd-viewer-backend',
            ]),
            'timeout' => 10,
            'ignore_errors' => true,
        ],
    ]);

    $response = @file_get_contents($url, false, $context);

    if ($response === false) {
        return null;
    }

    // Check HTTP status code
    $httpCode = 0;
    if (isset($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $header) {
            if (preg_match('/^HTTP\/[\d.]+ (\d+)/', $header, $matches)) {
                $httpCode = (int) $matches[1];
            }
        }
    }

    if ($httpCode !== 200) {
        return null;
    }

    $data = json_decode($response, true);

    if (!is_array($data) || !isset($data['id']) || !is_int($data['id'])) {
        return null;
    }

    return $data['id'];
}
