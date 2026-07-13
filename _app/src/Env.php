<?php

declare(strict_types=1);

namespace GhmdViewer;

/**
 * Simple .env file loader for GitHub App secrets.
 * Reads key=value pairs from a .env file and makes them available
 * via getenv() and the Env::get() helper.
 */
class Env
{
    private static bool $loaded = false;

    /**
     * Load environment variables from a .env file.
     * Skips if the file doesn't exist (production may use real env vars).
     */
    public static function load(string $path): void
    {
        if (self::$loaded) {
            return;
        }

        if (!file_exists($path)) {
            self::$loaded = true;
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            self::$loaded = true;
            return;
        }

        foreach ($lines as $line) {
            $line = trim($line);

            // Skip comments
            if (str_starts_with($line, '#')) {
                continue;
            }

            // Parse KEY=VALUE
            $eqPos = strpos($line, '=');
            if ($eqPos === false) {
                continue;
            }

            $key = trim(substr($line, 0, $eqPos));
            $value = trim(substr($line, $eqPos + 1));

            // Remove surrounding quotes if present
            if (
                (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                (str_starts_with($value, "'") && str_ends_with($value, "'"))
            ) {
                $value = substr($value, 1, -1);
            }

            // Only set if not already defined in the environment
            if (getenv($key) === false) {
                putenv("{$key}={$value}");
                $_ENV[$key] = $value;
            }
        }

        self::$loaded = true;
    }

    /**
     * Get an environment variable value.
     */
    public static function get(string $key, string $default = ''): string
    {
        $value = getenv($key);
        if ($value === false) {
            return $_ENV[$key] ?? $default;
        }
        return $value;
    }

    /**
     * Reset loaded state (useful for testing).
     */
    public static function reset(): void
    {
        self::$loaded = false;
    }
}
