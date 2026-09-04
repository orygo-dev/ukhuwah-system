-- Security hardening: invalidate stale sessions and persist abuse throttling.
ALTER TABLE `users`
  ADD COLUMN `auth_version` INTEGER NOT NULL DEFAULT 0;

CREATE TABLE `security_rate_limits` (
  `key_hash` VARCHAR(64) NOT NULL,
  `bucket` VARCHAR(64) NOT NULL,
  `count` INTEGER NOT NULL DEFAULT 0,
  `window_started_at` DATETIME(3) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `security_rate_limits_bucket_idx` (`bucket`),
  INDEX `security_rate_limits_expires_at_idx` (`expires_at`),
  PRIMARY KEY (`key_hash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
