CREATE TABLE `student_presences` (
  `student_id` VARCHAR(191) NOT NULL,
  `last_seen_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`student_id`),
  INDEX `student_presences_last_seen_at_idx` (`last_seen_at`),
  CONSTRAINT `student_presences_student_id_fkey`
    FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
