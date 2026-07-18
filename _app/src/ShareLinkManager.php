<?php

declare(strict_types=1);

namespace GhmdViewer;

require_once __DIR__ . '/Env.php';

/**
 * Manages per-user share link manifests.
 * Tracks share links created by each user (keyed by GitHub user ID),
 * providing record, list, and revoke operations.
 * Uses AES-256-GCM encryption consistent with SessionManager.
 */
class ShareLinkManager
{
    private string $sessionsDir;
    private ?string $encryptionKey;

    public function __construct(SessionManager $sessionManager, ?string $sessionsDir = null)
    {
        $this->sessionsDir = $sessionsDir ?? __DIR__ . '/../sessions';

        // Load encryption key from environment (hex-encoded 32-byte key)
        $keyHex = Env::get('SESSION_ENCRYPTION_KEY', '');
        $this->encryptionKey = ($keyHex !== '') ? hex2bin($keyHex) : null;

        if (!is_dir($this->sessionsDir)) {
            mkdir($this->sessionsDir, 0700, true);
        }
    }

    /**
     * Get the manifest file path for a given GitHub user ID.
     * Uses SHA-256 hash of the string representation of the user ID.
     */
    public function getManifestPath(int $githubUserId): string
    {
        $hash = hash('sha256', (string) $githubUserId);
        return $this->sessionsDir . '/manifest_' . $hash . '.json';
    }

    /**
     * Read and decrypt the user's share manifest, performing orphan cleanup.
     * Removes entries whose corresponding session file no longer exists on disk.
     *
     * @param int $githubUserId The GitHub numeric user ID
     * @return array Associative array of entries keyed by token_hash
     */
    private function readManifest(int $githubUserId): array
    {
        $path = $this->getManifestPath($githubUserId);

        if (!file_exists($path)) {
            return [];
        }

        $content = file_get_contents($path);
        if ($content === false) {
            return [];
        }

        $data = $this->decryptData($content);
        if ($data === null || !isset($data['entries']) || !is_array($data['entries'])) {
            return [];
        }

        $entries = $data['entries'];
        $cleaned = [];
        $removed = false;

        // Orphan cleanup: remove entries whose session file no longer exists
        foreach ($entries as $tokenHash => $entry) {
            $sessionFile = $this->sessionsDir . '/sess_' . $tokenHash . '.json';
            if (file_exists($sessionFile)) {
                $cleaned[$tokenHash] = $entry;
            } else {
                $removed = true;
            }
        }

        // Persist cleaned manifest if orphans were removed
        if ($removed) {
            $this->writeManifest($githubUserId, $cleaned);
        }

        return $cleaned;
    }

    /**
     * Encrypt and write entries to the user's manifest file.
     * Deletes the manifest file if entries are empty.
     *
     * @param int $githubUserId The GitHub numeric user ID
     * @param array $entries Associative array of entries keyed by token_hash
     */
    private function writeManifest(int $githubUserId, array $entries): void
    {
        $path = $this->getManifestPath($githubUserId);

        // Delete manifest file when all entries are removed
        if (empty($entries)) {
            if (file_exists($path)) {
                unlink($path);
            }
            return;
        }

        $data = ['entries' => $entries];
        $encrypted = $this->encryptData($data);

        file_put_contents($path, $encrypted, LOCK_EX);
    }

    /**
     * Record a new share entry in the user's manifest.
     *
     * @param int $githubUserId The GitHub numeric user ID
     * @param array $shareEntry Associative array containing: token_hash, scope (owner, repo, branch, path), created_at, expires_at, auth_method
     */
    public function recordShare(int $githubUserId, array $shareEntry): void
    {
        $entries = $this->readManifest($githubUserId);
        $entries[$shareEntry['token_hash']] = $shareEntry;
        $this->writeManifest($githubUserId, $entries);
    }

    /**
     * List all share entries for a user with computed status.
     * Reads the manifest (which performs orphan cleanup), then computes
     * status for each entry based on expiration time and session file existence.
     *
     * @param int $githubUserId The GitHub numeric user ID
     * @return array Indexed array of share entries with computed "status" field
     */
    public function listShares(int $githubUserId): array
    {
        $entries = $this->readManifest($githubUserId);
        $result = [];

        foreach ($entries as $tokenHash => $entry) {
            $sessionFile = $this->sessionsDir . '/sess_' . $tokenHash . '.json';
            $isActive = ($entry['expires_at'] >= time()) && file_exists($sessionFile);
            $entry['status'] = $isActive ? 'active' : 'expired';
            $result[] = $entry;
        }

        return $result;
    }

    /**
     * Revoke a share by token hash — deletes the scoped session file and removes the manifest entry.
     *
     * @param int $githubUserId The GitHub numeric user ID
     * @param string $tokenHash The SHA-256 hash of the scoped session token
     * @return bool True if the entry existed and was revoked, false if not found
     */
    public function revokeShare(int $githubUserId, string $tokenHash): bool
    {
        $entries = $this->readManifest($githubUserId);

        if (!array_key_exists($tokenHash, $entries)) {
            return false;
        }

        // Delete the scoped session file (suppress error if already gone)
        @unlink($this->sessionsDir . '/sess_' . $tokenHash . '.json');

        // Remove the entry from the manifest
        unset($entries[$tokenHash]);

        // Persist updated manifest (writeManifest handles empty manifest deletion)
        $this->writeManifest($githubUserId, $entries);

        return true;
    }

    /**
     * Encrypt data for at-rest storage using AES-256-GCM.
     * If no encryption key is configured, returns plain JSON.
     *
     * @param array $data Data to encrypt
     * @return string Encrypted payload or plain JSON
     */
    private function encryptData(array $data): string
    {
        $json = json_encode($data, JSON_THROW_ON_ERROR);

        if ($this->encryptionKey === null) {
            return $json;
        }

        $iv = random_bytes(12); // 96-bit IV for AES-GCM
        $ciphertext = openssl_encrypt(
            $json,
            'aes-256-gcm',
            $this->encryptionKey,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            16
        );

        if ($ciphertext === false) {
            throw new \RuntimeException('Manifest encryption failed');
        }

        // Format: ENC: prefix + base64(iv + tag + ciphertext)
        return 'ENC:' . base64_encode($iv . $tag . $ciphertext);
    }

    /**
     * Decrypt data from storage.
     * Handles both encrypted and plain JSON formats.
     *
     * @param string $content Raw file content
     * @return array|null Decrypted data, or null on failure
     */
    private function decryptData(string $content): ?array
    {
        // Check if content is encrypted
        if (str_starts_with($content, 'ENC:')) {
            if ($this->encryptionKey === null) {
                return null;
            }

            $payload = base64_decode(substr($content, 4), true);
            if ($payload === false || strlen($payload) < 28) {
                // 12 (IV) + 16 (tag) = 28 minimum
                return null;
            }

            $iv = substr($payload, 0, 12);
            $tag = substr($payload, 12, 16);
            $ciphertext = substr($payload, 28);

            $json = openssl_decrypt(
                $ciphertext,
                'aes-256-gcm',
                $this->encryptionKey,
                OPENSSL_RAW_DATA,
                $iv,
                $tag
            );

            if ($json === false) {
                return null;
            }

            $data = json_decode($json, true);
            return is_array($data) ? $data : null;
        }

        // Plain JSON (when no encryption key is configured)
        $data = json_decode($content, true);
        return is_array($data) ? $data : null;
    }
}
