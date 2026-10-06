<?php

namespace App\Services;

use RuntimeException;

/**
 * Thrown by NexWallClient for any non-2xx response or connection failure.
 *
 * status: 401 (bad/missing key), 404 (not found), 422 (invalid parameters),
 *         429 (rate limit; see $retryAfter), 0 (could not connect), or other.
 */
class NexWallException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $status = 0,
        public readonly ?int $retryAfter = null,
        public readonly array $body = [],
    ) {
        parent::__construct($message, $status);
    }

    public function isRateLimited(): bool
    {
        return $this->status === 429;
    }
}
