-- AlterTable
ALTER TABLE `live_class_sessions`
  ADD COLUMN `room_mode` ENUM('MEETING', 'CLASSROOM') NOT NULL DEFAULT 'MEETING';

-- AlterTable
ALTER TABLE `live_class_participants`
  ADD COLUMN `can_publish_media` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `live_class_quizzes` (
  `id` VARCHAR(191) NOT NULL,
  `session_id` VARCHAR(191) NOT NULL,
  `created_by_id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `status` ENUM('DRAFT', 'LIVE', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
  `duration_sec` INT NOT NULL DEFAULT 120,
  `launched_at` DATETIME(3) NULL,
  `closed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `live_class_quizzes_session_id_status_created_at_idx`(`session_id`, `status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `live_class_quiz_questions` (
  `id` VARCHAR(191) NOT NULL,
  `quiz_id` VARCHAR(191) NOT NULL,
  `prompt` TEXT NOT NULL,
  `options` JSON NOT NULL,
  `correct_option_index` INT NOT NULL,
  `points` INT NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `live_class_quiz_questions_quiz_id_sort_order_idx`(`quiz_id`, `sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `live_class_quiz_attempts` (
  `id` VARCHAR(191) NOT NULL,
  `quiz_id` VARCHAR(191) NOT NULL,
  `student_id` VARCHAR(191) NOT NULL,
  `score` DOUBLE NOT NULL DEFAULT 0,
  `status` ENUM('IN_PROGRESS', 'SUBMITTED') NOT NULL DEFAULT 'IN_PROGRESS',
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `submitted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `live_class_quiz_attempts_student_id_created_at_idx`(`student_id`, `created_at`),
  UNIQUE INDEX `live_class_quiz_attempts_quiz_id_student_id_key`(`quiz_id`, `student_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `live_class_quiz_answers` (
  `id` VARCHAR(191) NOT NULL,
  `attempt_id` VARCHAR(191) NOT NULL,
  `question_id` VARCHAR(191) NOT NULL,
  `selected_index` INT NOT NULL,
  `is_correct` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `live_class_quiz_answers_attempt_id_question_id_key`(`attempt_id`, `question_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `live_class_quizzes`
  ADD CONSTRAINT `live_class_quizzes_session_id_fkey`
  FOREIGN KEY (`session_id`) REFERENCES `live_class_sessions`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `live_class_quizzes`
  ADD CONSTRAINT `live_class_quizzes_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `live_class_quiz_questions`
  ADD CONSTRAINT `live_class_quiz_questions_quiz_id_fkey`
  FOREIGN KEY (`quiz_id`) REFERENCES `live_class_quizzes`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `live_class_quiz_attempts`
  ADD CONSTRAINT `live_class_quiz_attempts_quiz_id_fkey`
  FOREIGN KEY (`quiz_id`) REFERENCES `live_class_quizzes`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `live_class_quiz_attempts`
  ADD CONSTRAINT `live_class_quiz_attempts_student_id_fkey`
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `live_class_quiz_answers`
  ADD CONSTRAINT `live_class_quiz_answers_attempt_id_fkey`
  FOREIGN KEY (`attempt_id`) REFERENCES `live_class_quiz_attempts`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `live_class_quiz_answers`
  ADD CONSTRAINT `live_class_quiz_answers_question_id_fkey`
  FOREIGN KEY (`question_id`) REFERENCES `live_class_quiz_questions`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
