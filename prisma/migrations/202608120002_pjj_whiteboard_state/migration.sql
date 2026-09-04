ALTER TABLE `live_class_sessions`
  ADD COLUMN `whiteboard_version` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `whiteboard_snapshot_version` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `whiteboard_snapshot` JSON NULL;

CREATE TABLE `live_class_whiteboard_events` (
  `id` VARCHAR(191) NOT NULL,
  `session_id` VARCHAR(191) NOT NULL,
  `author_id` VARCHAR(191) NOT NULL,
  `sequence` INTEGER NOT NULL,
  `kind` VARCHAR(32) NOT NULL,
  `payload` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `live_class_whiteboard_events_session_id_sequence_key` (`session_id`, `sequence`),
  INDEX `live_class_whiteboard_events_session_id_created_at_idx` (`session_id`, `created_at`),
  INDEX `live_class_whiteboard_events_author_id_idx` (`author_id`),
  CONSTRAINT `live_class_whiteboard_events_session_id_fkey`
    FOREIGN KEY (`session_id`) REFERENCES `live_class_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `live_class_whiteboard_events_author_id_fkey`
    FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
