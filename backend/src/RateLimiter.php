<?php

declare(strict_types=1);

namespace GhmdViewer;

/**
 * File-based rate limiter for authentication endpoints.
 *
 * Tracks requests per IP address in a sliding window.
 * Uses the filesystem (no database or Redis required).
 *
 * Security: Prevents brute-force attacks on PAT login,
 * OAuth login (state file spam), and share token redemption.
 */
class RateLimiter
{
    private string $storageDir;
    private int $maxAttempts;
    private int $windowSeconds;

    /**
     * @param int $maxAttempts Maximum requests allowed within the window
     * @param int $windowSeconds Time window in seconds
     * @param string|null $storageDir Directory to store rate limit files
     */
    public function __construct(int $maxAttempts = 10, int $windowSeconds = 60, ?string $storageDir = null)
    {
        $this->maxAttempts = $maxAttempts;
        $this->windowSeconds = $windowSeconds;
        $this->storageDir = $storageDir ?? __DIR__ . '/../rate_limits';

        if (!is_dir($this->storageDir)) {
            mkdir($this->storageDir, 0700, true);
        }

        // Probabilistic cleanup: ~2% chance per request
        if (random_int(1, 50) === 1) {
            $this->purgeExpired();
        }
    }

    /**
     * Check if the given identifier (IP) is rate limited.
     *
     * @param string $identifier The client identifier (typically IP address)
     * @param string $action The action being rate limited (e.g., 'pat_login', 'oauth_login')
     * @return bool True if the request is allowed, false if rate limited
     */
    public function attempt(string $identifier, string $action): bool
    {
        $key = $this->getKey($identifier, $action);
        $path = $this->getPath($key);
        $now = time();
        $windowStart = $now - $this->windowSeconds;

        $attempts = $this->loadAttempts($path, $windowStart);

        if (count($attempts) >= $this->maxAttempts) {
            return false;
        }

        // Record this attempt
        $attempts[] = $now;
        $this->saveAttempts($path, $attempts);

        return true;
    }

    /**
     * Get the number of remaining attempts for the given identifier.
     *
     * @param string $identifier The client identifier
     * @param string $action The action being rate limited
     * @return int Number of remaining attempts
     */
    public function remaining(string $identifier, string $action): int
    {
        $key = $this->getKey($identifier, $action);
        $path = $this->getPath($key);
        $windowStart = time() - $this->windowSeconds;

        $attempts = $this->loadAttempts($path, $windowStart);

        return max(0, $this->maxAttempts - count($attempts));
    }

    /**
     * Get the number of seconds until the rate limit resets.
     *
     * @param string $identifier The client identifier
     * @param string $action The action being rate limited
     * @return int Seconds until the oldest attempt exits the window
     */
    public function retryAfter(string $identifier, string $action): int
    {
        $key = $this->getKey($identifier, $action);
        $path = $this->getPath($key);
        $now = time();
        $windowStart = $now - $this->windowSeconds;

        $attempts = $this->loadAttempts($path, $windowStart);

        if (empty($attempts)) {
            return 0;
        }

        // Time until the oldest attempt in the window expires
        $oldestAttempt = min($attempts);
        return max(0, ($oldestAttempt + $this->windowSeconds) - $now);
    }

    /**
     * Remove expired rate limit files from disk.
     */
    public function purgeExpired(): void
    {
        $now = time();
        $files = glob($this->storageDir . '/rl_*.json');
        if ($files === false) {
            return;
        }

        foreach ($files as $file) {
            // If file hasn't been modified within the window, it's stale
            $mtime = filemtime($file);
            if ($mtime !== false && ($now - $mtime) > $this->windowSeconds * 2) {
                @unlink($file);
            }
        }
    }

    /**
     * Load valid attempts from file (within the current window).
     */
    private function loadAttempts(string $path, int $windowStart): array
    {
        if (!file_exists($path)) {
            return [];
        }

        $content = file_get_contents($path);
        if ($content === false) {
            return [];
        }

        $data = json_decode($content, true);
        if (!is_array($data) || !isset($data['attempts']) || !is_array($data['attempts'])) {
            return [];
        }

        // Filter to only include attempts within the current window
        return array_values(array_filter($data['attempts'], fn(int $ts) => $ts >= $windowStart));
    }

    /**
     * Save attempts to file.
     */
    private function saveAttempts(string $path, array $attempts): void
    {
        file_put_contents(
            $path,
            json_encode(['attempts' => $attempts], JSON_THROW_ON_ERROR),
            LOCK_EX
        );
    }

    /**
     * Generate a safe filename key from identifier and action.
     */
    private function getKey(string $identifier, string $action): string
    {
        return hash('sha256', $action . ':' . $identifier);
    }

    /**
     * Get the file path for a rate limit key.
     */
    private function getPath(string $key): string
    {
        return $this->storageDir . '/rl_' . $key . '.json';
    }

    /**
     * Get the client IP address, respecting common proxy headers.
     * Falls back to REMOTE_ADDR.
     */
    public static function getClientIp(): string
    {
        // Check common proxy headers (in order of trust)
        $headers = ['HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'];

        foreach ($headers as $header) {
            $value = $_SERVER[$header] ?? null;
            if ($value !== null && $value !== '') {
                // X-Forwarded-For may contain multiple IPs; take the first (client)
                $ip = trim(explode(',', $value)[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }

        return '0.0.0.0';
    }
}
