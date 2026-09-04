-- Additive school-commercialization domain. Existing user plans, transactions,
-- documents, credits, and PJJ tables are intentionally untouched.

CREATE TABLE `school_plans` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `price_monthly` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `price_yearly` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `max_teacher_seats` INTEGER NOT NULL DEFAULT 0,
  `max_students` INTEGER NOT NULL DEFAULT 0,
  `monthly_ai_credits` INTEGER NOT NULL DEFAULT 0,
  `features` JSON NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `school_plans_slug_key`(`slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `school_subscriptions` (
  `id` VARCHAR(191) NOT NULL,
  `school_id` VARCHAR(191) NOT NULL,
  `plan_id` VARCHAR(191) NOT NULL,
  `status` ENUM('TRIAL','ACTIVE','GRACE','READ_ONLY','SUSPENDED','EXPIRED','CANCELED') NOT NULL DEFAULT 'TRIAL',
  `starts_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `trial_ends_at` DATETIME(3) NULL,
  `current_period_end` DATETIME(3) NULL,
  `grace_ends_at` DATETIME(3) NULL,
  `pjj_add_on_enabled` BOOLEAN NOT NULL DEFAULT false,
  `credit_balance` INTEGER NOT NULL DEFAULT 0,
  `feature_overrides` JSON NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `school_subscriptions_school_id_status_idx`(`school_id`, `status`),
  INDEX `school_subscriptions_plan_id_idx`(`plan_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `school_seats` (
  `id` VARCHAR(191) NOT NULL,
  `subscription_id` VARCHAR(191) NOT NULL,
  `school_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `assigned_by_id` VARCHAR(191) NOT NULL,
  `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `released_at` DATETIME(3) NULL,
  UNIQUE INDEX `school_seats_subscription_id_user_id_key`(`subscription_id`, `user_id`),
  INDEX `school_seats_school_id_released_at_idx`(`school_id`, `released_at`),
  INDEX `school_seats_user_id_released_at_idx`(`user_id`, `released_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `school_subscription_audits` (
  `id` VARCHAR(191) NOT NULL,
  `subscription_id` VARCHAR(191) NOT NULL,
  `school_id` VARCHAR(191) NOT NULL,
  `actor_id` VARCHAR(191) NULL,
  `action` VARCHAR(191) NOT NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `school_subscription_audits_school_id_created_at_idx`(`school_id`, `created_at`),
  INDEX `school_subscription_audits_subscription_id_created_at_idx`(`subscription_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `school_credit_ledger` (
  `id` VARCHAR(191) NOT NULL,
  `school_id` VARCHAR(191) NOT NULL,
  `subscription_id` VARCHAR(191) NULL,
  `user_id` VARCHAR(191) NULL,
  `amount` INTEGER NOT NULL,
  `balance_after` INTEGER NOT NULL,
  `source` VARCHAR(191) NOT NULL,
  `reference_id` VARCHAR(191) NULL,
  `description` VARCHAR(500) NOT NULL,
  `idempotency_key` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `school_credit_ledger_idempotency_key_key`(`idempotency_key`),
  INDEX `school_credit_ledger_school_id_created_at_idx`(`school_id`, `created_at`),
  INDEX `school_credit_ledger_subscription_id_idx`(`subscription_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `school_invoices` (
  `id` VARCHAR(191) NOT NULL,
  `school_id` VARCHAR(191) NOT NULL,
  `subscription_id` VARCHAR(191) NULL,
  `number` VARCHAR(191) NOT NULL,
  `status` ENUM('DRAFT','ISSUED','PAID','VOID','OVERDUE') NOT NULL DEFAULT 'DRAFT',
  `amount` DECIMAL(12,2) NOT NULL,
  `due_at` DATETIME(3) NULL,
  `paid_at` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `created_by_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `school_invoices_number_key`(`number`),
  INDEX `school_invoices_school_id_status_idx`(`school_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `school_admin_documents` (
  `id` VARCHAR(191) NOT NULL,
  `school_id` VARCHAR(191) NOT NULL,
  `kind` ENUM('LETTER','DECREE','WORK_PROGRAM','MEETING_MINUTES','REPORT','SUPERVISION','OTHER') NOT NULL,
  `status` ENUM('DRAFT','IN_REVIEW','VERIFIED','APPROVED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `title` VARCHAR(191) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `input_data` JSON NULL,
  `document_number` VARCHAR(191) NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `created_by_id` VARCHAR(191) NOT NULL,
  `verified_by_id` VARCHAR(191) NULL,
  `approved_by_id` VARCHAR(191) NULL,
  `verified_at` DATETIME(3) NULL,
  `approved_at` DATETIME(3) NULL,
  `archived_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `school_admin_documents_school_id_document_number_key`(`school_id`, `document_number`),
  INDEX `school_admin_documents_school_id_status_created_at_idx`(`school_id`, `status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `school_document_versions` (
  `id` VARCHAR(191) NOT NULL,
  `document_id` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `content` LONGTEXT NOT NULL,
  `created_by_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `school_document_versions_document_id_version_key`(`document_id`, `version`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `school_document_templates` (
  `id` VARCHAR(191) NOT NULL,
  `school_id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `kind` ENUM('LETTER','DECREE','WORK_PROGRAM','MEETING_MINUTES','REPORT','SUPERVISION','OTHER') NOT NULL,
  `title_template` VARCHAR(191) NOT NULL,
  `content_template` LONGTEXT NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_by_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `school_doc_templates_school_name_uq`(`school_id`, `name`),
  INDEX `school_doc_templates_school_kind_idx`(`school_id`, `kind`, `is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `school_schedules` (
  `id` VARCHAR(191) NOT NULL,
  `school_id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `school_year` VARCHAR(191) NOT NULL,
  `term` VARCHAR(191) NOT NULL,
  `status` ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `version` INTEGER NOT NULL DEFAULT 1,
  `created_by_id` VARCHAR(191) NOT NULL,
  `published_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `school_schedules_school_id_status_idx`(`school_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `school_schedule_slots` (
  `id` VARCHAR(191) NOT NULL,
  `schedule_id` VARCHAR(191) NOT NULL,
  `class_room_id` VARCHAR(191) NOT NULL,
  `teacher_id` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(191) NOT NULL,
  `day_of_week` INTEGER NOT NULL,
  `period_start` INTEGER NOT NULL,
  `period_end` INTEGER NOT NULL,
  `room` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `school_slot_class_time_uq`(`schedule_id`, `class_room_id`, `day_of_week`, `period_start`),
  INDEX `school_slot_teacher_time_idx`(`schedule_id`, `teacher_id`, `day_of_week`, `period_start`, `period_end`),
  INDEX `school_slot_room_time_idx`(`schedule_id`, `room`, `day_of_week`, `period_start`, `period_end`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `school_calendar_events` (
  `id` VARCHAR(191) NOT NULL,
  `school_id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `starts_at` DATETIME(3) NOT NULL,
  `ends_at` DATETIME(3) NOT NULL,
  `created_by_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `school_calendar_events_school_id_starts_at_idx`(`school_id`, `starts_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `school_pjj_usage` (
  `id` VARCHAR(191) NOT NULL,
  `school_id` VARCHAR(191) NOT NULL,
  `live_session_id` VARCHAR(191) NOT NULL,
  `participant_minutes` INTEGER NOT NULL DEFAULT 0,
  `participant_seconds` INTEGER NOT NULL DEFAULT 0,
  `peak_participants` INTEGER NOT NULL DEFAULT 0,
  `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `metadata` JSON NULL,
  UNIQUE INDEX `school_pjj_usage_live_session_id_key`(`live_session_id`),
  INDEX `school_pjj_usage_school_id_recorded_at_idx`(`school_id`, `recorded_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `school_subscriptions` ADD CONSTRAINT `school_subscriptions_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_subscriptions` ADD CONSTRAINT `school_subscriptions_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `school_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `school_seats` ADD CONSTRAINT `school_seats_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `school_subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_seats` ADD CONSTRAINT `school_seats_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_seats` ADD CONSTRAINT `school_seats_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_seats` ADD CONSTRAINT `school_seats_assigned_by_id_fkey` FOREIGN KEY (`assigned_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `school_subscription_audits` ADD CONSTRAINT `school_subscription_audits_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `school_subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_subscription_audits` ADD CONSTRAINT `school_subscription_audits_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_subscription_audits` ADD CONSTRAINT `school_subscription_audits_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `school_credit_ledger` ADD CONSTRAINT `school_credit_ledger_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_credit_ledger` ADD CONSTRAINT `school_credit_ledger_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `school_subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `school_credit_ledger` ADD CONSTRAINT `school_credit_ledger_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `school_invoices` ADD CONSTRAINT `school_invoices_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_invoices` ADD CONSTRAINT `school_invoices_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `school_subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `school_invoices` ADD CONSTRAINT `school_invoices_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `school_admin_documents` ADD CONSTRAINT `school_admin_documents_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_admin_documents` ADD CONSTRAINT `school_admin_documents_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `school_admin_documents` ADD CONSTRAINT `school_admin_documents_verified_by_id_fkey` FOREIGN KEY (`verified_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `school_admin_documents` ADD CONSTRAINT `school_admin_documents_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `school_document_versions` ADD CONSTRAINT `school_document_versions_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `school_admin_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_document_versions` ADD CONSTRAINT `school_document_versions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `school_document_templates` ADD CONSTRAINT `school_document_templates_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_document_templates` ADD CONSTRAINT `school_document_templates_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `school_schedules` ADD CONSTRAINT `school_schedules_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_schedules` ADD CONSTRAINT `school_schedules_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `school_schedule_slots` ADD CONSTRAINT `school_schedule_slots_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `school_schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_schedule_slots` ADD CONSTRAINT `school_schedule_slots_class_room_id_fkey` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_schedule_slots` ADD CONSTRAINT `school_schedule_slots_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_calendar_events` ADD CONSTRAINT `school_calendar_events_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_calendar_events` ADD CONSTRAINT `school_calendar_events_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `school_pjj_usage` ADD CONSTRAINT `school_pjj_usage_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
