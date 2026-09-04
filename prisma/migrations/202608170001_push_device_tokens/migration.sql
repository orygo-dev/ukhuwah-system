CREATE TABLE `push_device_tokens` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `token` VARCHAR(512) NOT NULL,
  `platform` VARCHAR(20) NOT NULL,
  `app_id` VARCHAR(160) NOT NULL,
  `device_name` VARCHAR(255) NULL,
  `user_agent` TEXT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `push_device_tokens_token_key` (`token`),
  INDEX `push_device_tokens_user_id_active_platform_idx` (`user_id`, `active`, `platform`),
  INDEX `push_device_tokens_last_seen_at_idx` (`last_seen_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `push_device_tokens_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
