<?php

declare(strict_types=1);

namespace GhmdViewer;

/**
 * File-based session manager for OAuth sessions.
 * Stores session data as JSON files in the sessions directory.
 * No database required.
 */
class SessionManager
{
    private string $sessionsDir;
    private string $statesDir;

    public function __construct(?string $sessionsDir = null, ?string $statesDir = null)
    {
        $this->sessionsDir = $sessionsDir ?? __DIR__ . '/../sessions';
        $this->statesDir = $statesDir ?? __DIR__ . '/../states';

        if (!is_dir($this->sessionsDir)) {
            mkdir($this->sessionsDir, 0700, true);
        }
        if (!is_dir($this->statesDir)) {
            mkdir($this->statesDir, 0700, true);
        }
    }

    /**
     * Generate a cryptographically secure random token.
     */
    public function generateToken(int $length = 32): string
    {
        return bin2hex(random_bytes($length));
    }

    /**
     * Store a CSRF state token with associated data (e.g., original hash).
     * States expire after 10 minutes.
     */
    public function storeState(string $state, array $data = []): void
    {
        $payload = [
            'data' => $data,
            'created_at' => time(),
            'expires_at' => time() + 600, // 10 minutes
        ];

        file_put_contents(
            $this->getStatePath($state),
            json_encode($payload, JSON_THROW_ON_ERROR),
            LOCK_EX
        );
    }

    /**
     * Validate and consume a CSRF state token.
     * Returns the associated data if valid, null if invalid or expired.
     * The state file is deleted after validation (single-use).
     */
    public function validateState(string $state): ?array
    {
        $path = $this->getStatePath($state);

        if (!file_exists($path)) {
            return null;
        }

        $content = file_get_contents($path);
        if ($content === false) {
            return null;
        }

        // Delete the state file immediately (single-use token)
        unlink($path);

        $payload = json_decode($content, true);
        if (!is_array($payload)) {
            return null;
        }

        // Check expiration
        if (($payload['expires_at'] ?? 0) < time()) {
            return null;
        }

        return $payload['data'] ?? [];
    }

    /**
     * Create a new session with the given access token.
     * Returns the session token string.
     */
    public function createSession(string $accessToken): string
    {
        $sessionToken = $this->generateToken();
        $now = time();

        $sessionData = [
            'installation_token' => $accessToken,
            'created_at' => $now,
            'expires_at' => $now + 3600, // 1 hour
        ];

        file_put_contents(
            $this->getSessionPath($sessionToken),
            json_encode($sessionData, JSON_THROW_ON_ERROR),
            LOCK_EX
        );

        return $sessionToken;
    }

    /**
     * Retrieve a valid session by token.
     * Returns session data if valid, null if invalid or expired.
     */
    public function getSession(string $sessionToken): ?array
    {
        $path = $this->getSessionPath($sessionToken);

        if (!file_exists($path)) {
            return null;
        }

        $content = file_get_contents($path);
        if ($content === false) {
            return null;
        }

        $session = json_decode($content, true);
        if (!is_array($session)) {
            return null;
        }

        // Check expiration
        if (($session['expires_at'] ?? 0) < time()) {
            // Clean up expired session
            unlink($path);
            return null;
        }

        return $session;
    }

    /**
     * Invalidate (delete) a session.
     */
    public function destroySession(string $sessionToken): void
    {
        $path = $this->getSessionPath($sessionToken);
        if (file_exists($path)) {
            unlink($path);
        }
    }

    /**
     * Get the file path for a session token.
     */
    private function getSessionPath(string $token): string
    {
        // Use hash to prevent directory traversal attacks
        return $this->sessionsDir . '/sess_' . hash('sha256', $token) . '.json';
    }

    /**
     * Get the file path for a state token.
     */
    private function getStatePath(string $state): string
    {
        return $this->statesDir . '/state_' . hash('sha256', $state) . '.json';
    }
}
