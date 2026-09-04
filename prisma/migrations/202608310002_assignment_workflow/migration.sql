-- Extend assignments without changing the behavior of existing text assignments.
ALTER TABLE `assignments`
  ADD COLUMN `mode` ENUM('LEGACY_TEXT', 'QUESTION_SET') NOT NULL DEFAULT 'LEGACY_TEXT',
  ADD COLUMN `max_score` DOUBLE NOT NULL DEFAULT 100,
  ADD COLUMN `allow_late` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `allow_resubmit` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `published_at` DATETIME(3) NULL;

UPDATE `assignments`
SET `published_at` = `created_at`
WHERE `status` = 'PUBLISHED' AND `published_at` IS NULL;

ALTER TABLE `assignment_submissions`
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `auto_score` DOUBLE NULL;

CREATE TABLE `assignment_questions` (
  `id` VARCHAR(191) NOT NULL,
  `assignment_id` VARCHAR(191) NOT NULL,
  `type` ENUM('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY') NOT NULL,
  `prompt` TEXT NOT NULL,
  `options` JSON NULL,
  `correct_answer` JSON NULL,
  `points` DOUBLE NOT NULL DEFAULT 1,
  `required` BOOLEAN NOT NULL DEFAULT true,
  `explanation` TEXT NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `assignment_questions_assignment_id_sort_order_idx` (`assignment_id`, `sort_order`),
  PRIMARY KEY (`id`),
  CONSTRAINT `assignment_questions_assignment_id_fkey`
    FOREIGN KEY (`assignment_id`) REFERENCES `assignments` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `assignment_submission_answers` (
  `id` VARCHAR(191) NOT NULL,
  `submission_id` VARCHAR(191) NOT NULL,
  `question_id` VARCHAR(191) NOT NULL,
  `response` JSON NOT NULL,
  `score` DOUBLE NULL,
  `feedback` TEXT NULL,
  `auto_graded` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `assignment_submission_answers_submission_id_question_id_key` (`submission_id`, `question_id`),
  INDEX `assignment_submission_answers_question_id_idx` (`question_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `assignment_submission_answers_submission_id_fkey`
    FOREIGN KEY (`submission_id`) REFERENCES `assignment_submissions` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `assignment_submission_answers_question_id_fkey`
    FOREIGN KEY (`question_id`) REFERENCES `assignment_questions` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
