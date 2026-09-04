ALTER TABLE `student_board_posts`
MODIFY `visibility` ENUM('CLASS', 'SCHOOL', 'GLOBAL') NOT NULL DEFAULT 'GLOBAL';

CREATE TABLE `student_board_post_reports` (
    `id` VARCHAR(191) NOT NULL,
    `post_id` VARCHAR(191) NOT NULL,
    `reporter_id` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `details` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `student_board_post_reports_post_id_reporter_id_key`(`post_id`, `reporter_id`),
    INDEX `student_board_post_reports_reporter_id_created_at_idx`(`reporter_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `student_board_post_reports`
ADD CONSTRAINT `student_board_post_reports_post_id_fkey`
FOREIGN KEY (`post_id`) REFERENCES `student_board_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `student_board_post_reports`
ADD CONSTRAINT `student_board_post_reports_reporter_id_fkey`
FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
