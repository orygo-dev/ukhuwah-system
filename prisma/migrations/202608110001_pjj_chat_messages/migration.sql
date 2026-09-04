CREATE TABLE `live_class_chat_messages` (
  `id` VARCHAR(191) NOT NULL,
  `session_id` VARCHAR(191) NOT NULL,
  `sender_id` VARCHAR(191) NOT NULL,
  `client_message_id` VARCHAR(191) NOT NULL,
  `body` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `live_class_chat_messages_session_id_sender_id_client_message_key`(`session_id`, `sender_id`, `client_message_id`),
  INDEX `live_class_chat_messages_session_id_created_at_idx`(`session_id`, `created_at`),
  INDEX `live_class_chat_messages_sender_id_idx`(`sender_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `live_class_chat_messages`
  ADD CONSTRAINT `live_class_chat_messages_session_id_fkey`
  FOREIGN KEY (`session_id`) REFERENCES `live_class_sessions`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `live_class_chat_messages`
  ADD CONSTRAINT `live_class_chat_messages_sender_id_fkey`
  FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
