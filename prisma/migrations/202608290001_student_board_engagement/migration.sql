CREATE TABLE `student_board_post_likes` (
  `id` VARCHAR(191) NOT NULL,
  `post_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `student_board_post_likes_post_id_user_id_key`(`post_id`, `user_id`),
  INDEX `student_board_post_likes_user_id_idx`(`user_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `student_board_post_likes_post_id_fkey`
    FOREIGN KEY (`post_id`) REFERENCES `student_board_posts`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `student_board_post_likes_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_board_post_comments` (
  `id` VARCHAR(191) NOT NULL,
  `post_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `content` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `student_board_post_comments_post_id_created_at_idx`(`post_id`, `created_at`),
  INDEX `student_board_post_comments_user_id_idx`(`user_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `student_board_post_comments_post_id_fkey`
    FOREIGN KEY (`post_id`) REFERENCES `student_board_posts`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `student_board_post_comments_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_board_post_bookmarks` (
  `id` VARCHAR(191) NOT NULL,
  `post_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `student_board_post_bookmarks_post_id_user_id_key`(`post_id`, `user_id`),
  INDEX `student_board_post_bookmarks_user_id_idx`(`user_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `student_board_post_bookmarks_post_id_fkey`
    FOREIGN KEY (`post_id`) REFERENCES `student_board_posts`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `student_board_post_bookmarks_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
