-- Additive student social graph and safe direct-message request workflow.
CREATE TABLE `student_follows` (
  `id` VARCHAR(191) NOT NULL,
  `follower_id` VARCHAR(191) NOT NULL,
  `following_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `student_follows_follower_id_following_id_key` (`follower_id`, `following_id`),
  INDEX `student_follows_following_id_created_at_idx` (`following_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `student_follows_follower_id_fkey` FOREIGN KEY (`follower_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `student_follows_following_id_fkey` FOREIGN KEY (`following_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_blocks` (
  `id` VARCHAR(191) NOT NULL,
  `blocker_id` VARCHAR(191) NOT NULL,
  `blocked_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `student_blocks_blocker_id_blocked_id_key` (`blocker_id`, `blocked_id`),
  INDEX `student_blocks_blocked_id_idx` (`blocked_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `student_blocks_blocker_id_fkey` FOREIGN KEY (`blocker_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `student_blocks_blocked_id_fkey` FOREIGN KEY (`blocked_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_message_requests` (
  `id` VARCHAR(191) NOT NULL,
  `sender_id` VARCHAR(191) NOT NULL,
  `recipient_id` VARCHAR(191) NOT NULL,
  `message` VARCHAR(500) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `conversation_id` VARCHAR(191) NULL,
  `responded_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `student_message_requests_conversation_id_key` (`conversation_id`),
  UNIQUE INDEX `student_message_requests_sender_id_recipient_id_key` (`sender_id`, `recipient_id`),
  INDEX `student_message_requests_recipient_id_status_created_at_idx` (`recipient_id`, `status`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `student_message_requests_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `student_message_requests_recipient_id_fkey` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `student_message_requests_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `messages`
  ADD COLUMN `client_message_id` VARCHAR(80) NULL,
  ADD UNIQUE INDEX `messages_client_message_id_key` (`client_message_id`);
