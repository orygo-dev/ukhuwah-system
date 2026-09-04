-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'PROVINCE_ADMIN', 'SCHOOL_ADMIN', 'STUDENT', 'TEACHER') NOT NULL DEFAULT 'TEACHER',
    `school_id` VARCHAR(191) NULL,
    `province_id` VARCHAR(191) NULL,
    `nip` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `avatar_url` VARCHAR(191) NULL,
    `credits_remaining` INTEGER NOT NULL DEFAULT 10,
    `wallet_balance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `plan_id` VARCHAR(191) NULL,
    `plan_expires_at` DATETIME(3) NULL,
    `profile_defaults` JSON NULL,
    `email_verified_at` DATETIME(3) NULL,
    `referral_code` VARCHAR(191) NULL,
    `referred_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_referral_code_key`(`referral_code`),
    INDEX `users_province_id_idx`(`province_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schools` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `npsn` VARCHAR(191) NULL,
    `level` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `province` VARCHAR(191) NULL,
    `regency_id` VARCHAR(191) NULL,
    `logo_url` VARCHAR(191) NULL,
    `settings` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `schools_npsn_key`(`npsn`),
    INDEX `schools_regency_id_idx`(`regency_id`),
    INDEX `schools_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teacher_school_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `school_id` VARCHAR(191) NULL,
    `school_name` VARCHAR(191) NOT NULL,
    `npsn` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `province` VARCHAR(191) NULL,
    `jenjang` VARCHAR(191) NOT NULL,
    `mapel` VARCHAR(191) NOT NULL,
    `tahun_ajaran` VARCHAR(191) NOT NULL,
    `semester` VARCHAR(191) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `teacher_school_profiles_user_id_is_primary_idx`(`user_id`, `is_primary`),
    INDEX `teacher_school_profiles_school_id_idx`(`school_id`),
    INDEX `teacher_school_profiles_jenjang_idx`(`jenjang`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provinces` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `provinces_name_key`(`name`),
    UNIQUE INDEX `provinces_code_key`(`code`),
    INDEX `provinces_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `regencies` (
    `id` VARCHAR(191) NOT NULL,
    `province_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'Kabupaten',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `regencies_code_key`(`code`),
    INDEX `regencies_province_id_idx`(`province_id`),
    INDEX `regencies_name_idx`(`name`),
    UNIQUE INDEX `regencies_province_id_name_key`(`province_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_providers` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `base_url` VARCHAR(191) NULL,
    `api_key` TEXT NOT NULL,
    `default_model` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `is_fallback` BOOLEAN NOT NULL DEFAULT false,
    `max_tokens` INTEGER NOT NULL DEFAULT 4096,
    `temperature` DECIMAL(3, 2) NOT NULL DEFAULT 0.70,
    `cost_per_1k_in` DECIMAL(10, 4) NOT NULL DEFAULT 0,
    `cost_per_1k_out` DECIMAL(10, 4) NOT NULL DEFAULT 0,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ai_providers_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_tool_configs` (
    `id` VARCHAR(191) NOT NULL,
    `tool_slug` VARCHAR(191) NOT NULL,
    `tool_name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `provider_id` VARCHAR(191) NOT NULL,
    `model_override` VARCHAR(191) NULL,
    `system_prompt` LONGTEXT NOT NULL,
    `max_tokens` INTEGER NOT NULL DEFAULT 4096,
    `credit_cost` INTEGER NOT NULL DEFAULT 1,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ai_tool_configs_tool_slug_key`(`tool_slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provider_clients` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `api_key_hash` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `plan_name` VARCHAR(191) NOT NULL DEFAULT 'pilot',
    `monthly_credit_limit` INTEGER NOT NULL DEFAULT 1000,
    `used_credits` INTEGER NOT NULL DEFAULT 0,
    `period_start` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `period_end` DATETIME(3) NULL,
    `allowed_tools` JSON NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `provider_clients_slug_key`(`slug`),
    UNIQUE INDEX `provider_clients_api_key_hash_key`(`api_key_hash`),
    INDEX `provider_clients_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provider_usage_logs` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `provider_client_id` VARCHAR(191) NOT NULL,
    `tool_slug` VARCHAR(191) NOT NULL,
    `external_tenant_id` VARCHAR(191) NULL,
    `external_user_id` VARCHAR(191) NULL,
    `external_request_id` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `credit_charged` INTEGER NOT NULL DEFAULT 0,
    `provider_used` VARCHAR(191) NULL,
    `is_demo` BOOLEAN NOT NULL DEFAULT false,
    `latency_ms` INTEGER NULL,
    `error_code` VARCHAR(191) NULL,
    `error_message` TEXT NULL,
    `input_hash` VARCHAR(191) NULL,
    `response_title` VARCHAR(191) NULL,
    `usage_request_id` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `provider_usage_logs_provider_client_id_created_at_idx`(`provider_client_id`, `created_at`),
    INDEX `provider_usage_logs_tool_slug_created_at_idx`(`tool_slug`, `created_at`),
    INDEX `provider_usage_logs_status_created_at_idx`(`status`, `created_at`),
    UNIQUE INDEX `provider_usage_logs_provider_client_id_external_request_id_key`(`provider_client_id`, `external_request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_gateways` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_sandbox` BOOLEAN NOT NULL DEFAULT true,
    `config` JSON NOT NULL,
    `supported_methods` JSON NOT NULL,
    `fee_type` VARCHAR(191) NOT NULL DEFAULT 'percentage',
    `fee_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_gateways_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_plans` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price_monthly` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `price_yearly` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `credits_monthly` INTEGER NOT NULL DEFAULT 0,
    `features` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_popular` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subscription_plans_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `credit_packages` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `credits` INTEGER NOT NULL,
    `bonus_credits` INTEGER NOT NULL DEFAULT 0,
    `price` DECIMAL(12, 2) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_popular` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `credit_packages_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('SUBSCRIPTION', 'CREDIT_TOPUP') NOT NULL DEFAULT 'SUBSCRIPTION',
    `user_id` VARCHAR(191) NOT NULL,
    `plan_id` VARCHAR(191) NULL,
    `credit_package_id` VARCHAR(191) NULL,
    `gateway_id` VARCHAR(191) NOT NULL,
    `gateway_ref` VARCHAR(191) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `payment_method` VARCHAR(191) NULL,
    `paid_at` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `transactions_user_id_status_idx`(`user_id`, `status`),
    INDEX `transactions_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `tool_config_id` VARCHAR(191) NULL,
    `tool_slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `input_data` JSON NULL,
    `metadata` JSON NULL,
    `status` ENUM('DRAFT', 'FINAL') NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `documents_user_id_tool_slug_idx`(`user_id`, `tool_slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_usage_logs` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `document_id` VARCHAR(191) NULL,
    `provider_id` VARCHAR(191) NULL,
    `feature` VARCHAR(191) NOT NULL,
    `tool_slug` VARCHAR(191) NOT NULL,
    `phase` VARCHAR(191) NULL,
    `provider_slug` VARCHAR(191) NOT NULL,
    `provider_name` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `input_tokens` INTEGER NULL,
    `output_tokens` INTEGER NULL,
    `reasoning_tokens` INTEGER NULL,
    `cached_tokens` INTEGER NULL,
    `total_tokens` INTEGER NULL,
    `usage_estimated` BOOLEAN NOT NULL DEFAULT false,
    `provider_cost_usd` DECIMAL(14, 8) NULL,
    `provider_cost_idr` DECIMAL(14, 2) NULL,
    `credit_charged` INTEGER NOT NULL DEFAULT 0,
    `revenue_idr` DECIMAL(14, 2) NULL,
    `margin_idr` DECIMAL(14, 2) NULL,
    `latency_ms` INTEGER NULL,
    `error_message` TEXT NULL,
    `raw_usage` JSON NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ai_usage_logs_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `ai_usage_logs_document_id_idx`(`document_id`),
    INDEX `ai_usage_logs_provider_id_created_at_idx`(`provider_id`, `created_at`),
    INDEX `ai_usage_logs_tool_slug_created_at_idx`(`tool_slug`, `created_at`),
    INDEX `ai_usage_logs_status_created_at_idx`(`status`, `created_at`),
    INDEX `ai_usage_logs_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_provider_balance_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `provider_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(14, 4) NULL,
    `currency` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `raw` JSON NULL,
    `error` TEXT NULL,
    `checked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_provider_balance_snapshots_provider_id_checked_at_idx`(`provider_id`, `checked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_settings` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `platform_settings_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `whatsapp_gateways` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `provider` ENUM('FONNTE', 'WABLAS', 'CUSTOM') NOT NULL DEFAULT 'FONNTE',
    `base_url` VARCHAR(191) NULL,
    `token` TEXT NULL,
    `sender` VARCHAR(191) NULL,
    `config` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_sandbox` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `whatsapp_gateways_provider_idx`(`provider`),
    INDEX `whatsapp_gateways_is_active_is_default_idx`(`is_active`, `is_default`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `whatsapp_message_logs` (
    `id` VARCHAR(191) NOT NULL,
    `gateway_id` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NULL,
    `purpose` ENUM('OTP_REGISTER', 'OTP_PASSWORD_RESET', 'OTP_AFFILIATE_PAYOUT', 'TOPUP_SUCCESS', 'AFFILIATE_PAYOUT_SUCCESS', 'SUBSCRIPTION_PURCHASE', 'SUBSCRIPTION_EXPIRY_REMINDER', 'TEST') NOT NULL,
    `target` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `provider_ref` VARCHAR(191) NULL,
    `error` TEXT NULL,
    `response` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sent_at` DATETIME(3) NULL,

    INDEX `whatsapp_message_logs_purpose_idx`(`purpose`),
    INDEX `whatsapp_message_logs_status_idx`(`status`),
    INDEX `whatsapp_message_logs_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `otp_codes` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NOT NULL,
    `purpose` ENUM('REGISTER', 'PASSWORD_RESET', 'AFFILIATE_PAYOUT') NOT NULL,
    `code_hash` VARCHAR(191) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `max_attempts` INTEGER NOT NULL DEFAULT 5,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `otp_codes_phone_purpose_idx`(`phone`, `purpose`),
    INDEX `otp_codes_user_id_purpose_idx`(`user_id`, `purpose`),
    INDEX `otp_codes_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `class_rooms` (
    `id` VARCHAR(191) NOT NULL,
    `teacher_id` VARCHAR(191) NOT NULL,
    `school_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `jenjang` VARCHAR(191) NOT NULL,
    `tahun_ajaran` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `delivery_mode` ENUM('REGULAR', 'PJJ', 'HYBRID') NOT NULL DEFAULT 'REGULAR',
    `pjj_program_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `class_rooms_teacher_id_idx`(`teacher_id`),
    INDEX `class_rooms_pjj_program_id_delivery_mode_idx`(`pjj_program_id`, `delivery_mode`),
    UNIQUE INDEX `class_rooms_teacher_id_name_tahun_ajaran_key`(`teacher_id`, `name`, `tahun_ajaran`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `id` VARCHAR(191) NOT NULL,
    `class_room_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `nis` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `gender` VARCHAR(191) NULL,
    `parent_phone` VARCHAR(191) NULL,
    `parent_access_code_hash` VARCHAR(191) NULL,
    `parent_access_code_lookup` VARCHAR(191) NULL,
    `parent_access_enabled` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `students_user_id_key`(`user_id`),
    UNIQUE INDEX `students_parent_access_code_lookup_key`(`parent_access_code_lookup`),
    INDEX `students_class_room_id_idx`(`class_room_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `class_room_id` VARCHAR(191) NOT NULL,
    `teacher_id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `mapel` VARCHAR(191) NOT NULL DEFAULT '',
    `jam_ke` INTEGER NOT NULL DEFAULT 0,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_sessions_teacher_id_date_idx`(`teacher_id`, `date`),
    UNIQUE INDEX `attendance_sessions_class_room_id_date_mapel_jam_ke_key`(`class_room_id`, `date`, `mapel`, `jam_ke`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_records` (
    `id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `status` ENUM('PRESENT', 'EXCUSED', 'SICK', 'ABSENT') NOT NULL DEFAULT 'PRESENT',
    `note` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_records_student_id_idx`(`student_id`),
    UNIQUE INDEX `attendance_records_session_id_student_id_key`(`session_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_journals` (
    `id` VARCHAR(191) NOT NULL,
    `teacher_id` VARCHAR(191) NOT NULL,
    `class_room_id` VARCHAR(191) NULL,
    `attendance_session_id` VARCHAR(191) NULL,
    `date` DATE NOT NULL,
    `mapel` VARCHAR(191) NOT NULL,
    `jam_ke` INTEGER NOT NULL DEFAULT 0,
    `materi` VARCHAR(191) NOT NULL,
    `tujuan_pembelajaran` TEXT NULL,
    `kegiatan` TEXT NULL,
    `evaluasi` TEXT NULL,
    `refleksi` TEXT NULL,
    `tindak_lanjut` TEXT NULL,
    `kendala` TEXT NULL,
    `status` ENUM('DRAFT', 'FINAL') NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `daily_journals_attendance_session_id_key`(`attendance_session_id`),
    INDEX `daily_journals_teacher_id_date_idx`(`teacher_id`, `date`),
    INDEX `daily_journals_class_room_id_date_idx`(`class_room_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assessments` (
    `id` VARCHAR(191) NOT NULL,
    `class_room_id` VARCHAR(191) NOT NULL,
    `teacher_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `mapel` VARCHAR(191) NOT NULL,
    `type` ENUM('QUIZ', 'TUGAS', 'UTS', 'UAS', 'PROYEK', 'LAINNYA') NOT NULL DEFAULT 'LAINNYA',
    `date` DATE NOT NULL,
    `semester` VARCHAR(191) NULL,
    `tahun_ajaran` VARCHAR(191) NULL,
    `max_score` DOUBLE NOT NULL DEFAULT 100,
    `note` TEXT NULL,
    `status` ENUM('DRAFT', 'FINAL') NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `assessments_teacher_id_date_idx`(`teacher_id`, `date`),
    UNIQUE INDEX `assessments_class_room_id_title_date_mapel_key`(`class_room_id`, `title`, `date`, `mapel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grade_records` (
    `id` VARCHAR(191) NOT NULL,
    `assessment_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `score` DOUBLE NULL,
    `note` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `grade_records_student_id_idx`(`student_id`),
    UNIQUE INDEX `grade_records_assessment_id_student_id_key`(`assessment_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assignments` (
    `id` VARCHAR(191) NOT NULL,
    `class_room_id` VARCHAR(191) NOT NULL,
    `teacher_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `mapel` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `due_date` DATE NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'PUBLISHED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `assignments_class_room_id_status_due_date_idx`(`class_room_id`, `status`, `due_date`),
    INDEX `assignments_teacher_id_created_at_idx`(`teacher_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assignment_submissions` (
    `id` VARCHAR(191) NOT NULL,
    `assignment_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `answer` TEXT NOT NULL,
    `score` DOUBLE NULL,
    `feedback` TEXT NULL,
    `status` ENUM('SUBMITTED', 'LATE', 'GRADED', 'RETURNED') NOT NULL DEFAULT 'SUBMITTED',
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `graded_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `assignment_submissions_student_id_status_idx`(`student_id`, `status`),
    INDEX `assignment_submissions_assignment_id_status_idx`(`assignment_id`, `status`),
    UNIQUE INDEX `assignment_submissions_assignment_id_student_id_key`(`assignment_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quizzes` (
    `id` VARCHAR(191) NOT NULL,
    `class_room_id` VARCHAR(191) NOT NULL,
    `teacher_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `mapel` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'PUBLISHED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `quizzes_class_room_id_status_created_at_idx`(`class_room_id`, `status`, `created_at`),
    INDEX `quizzes_teacher_id_created_at_idx`(`teacher_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quiz_questions` (
    `id` VARCHAR(191) NOT NULL,
    `quiz_id` VARCHAR(191) NOT NULL,
    `prompt` TEXT NOT NULL,
    `options` JSON NOT NULL,
    `correct_option_index` INTEGER NOT NULL,
    `explanation` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `quiz_questions_quiz_id_sort_order_idx`(`quiz_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quiz_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `quiz_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `score` DOUBLE NOT NULL DEFAULT 0,
    `correct_count` INTEGER NOT NULL DEFAULT 0,
    `total_questions` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('SUBMITTED') NOT NULL DEFAULT 'SUBMITTED',
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `quiz_attempts_student_id_submitted_at_idx`(`student_id`, `submitted_at`),
    INDEX `quiz_attempts_quiz_id_score_idx`(`quiz_id`, `score`),
    UNIQUE INDEX `quiz_attempts_quiz_id_student_id_key`(`quiz_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quiz_attempt_answers` (
    `id` VARCHAR(191) NOT NULL,
    `attempt_id` VARCHAR(191) NOT NULL,
    `question_id` VARCHAR(191) NOT NULL,
    `selected_option_index` INTEGER NOT NULL,
    `is_correct` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `quiz_attempt_answers_question_id_idx`(`question_id`),
    UNIQUE INDEX `quiz_attempt_answers_attempt_id_question_id_key`(`attempt_id`, `question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_quizzes` (
    `id` VARCHAR(191) NOT NULL,
    `date_key` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `theme` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `question_count` INTEGER NOT NULL DEFAULT 0,
    `generated_by_ai` BOOLEAN NOT NULL DEFAULT false,
    `created_by_id` VARCHAR(191) NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `daily_quizzes_date_key_key`(`date_key`),
    INDEX `daily_quizzes_status_date_key_idx`(`status`, `date_key`),
    INDEX `daily_quizzes_created_by_id_idx`(`created_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_quiz_questions` (
    `id` VARCHAR(191) NOT NULL,
    `daily_quiz_id` VARCHAR(191) NOT NULL,
    `prompt` TEXT NOT NULL,
    `options` JSON NOT NULL,
    `correct_option_index` INTEGER NOT NULL,
    `explanation` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `daily_quiz_questions_daily_quiz_id_sort_order_idx`(`daily_quiz_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_quiz_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `daily_quiz_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `score` DOUBLE NOT NULL DEFAULT 0,
    `correct_count` INTEGER NOT NULL DEFAULT 0,
    `total_questions` INTEGER NOT NULL DEFAULT 0,
    `xp_earned` INTEGER NOT NULL DEFAULT 0,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `daily_quiz_attempts_student_id_submitted_at_idx`(`student_id`, `submitted_at`),
    INDEX `daily_quiz_attempts_daily_quiz_id_score_idx`(`daily_quiz_id`, `score`),
    UNIQUE INDEX `daily_quiz_attempts_daily_quiz_id_student_id_key`(`daily_quiz_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_quiz_attempt_answers` (
    `id` VARCHAR(191) NOT NULL,
    `attempt_id` VARCHAR(191) NOT NULL,
    `question_id` VARCHAR(191) NOT NULL,
    `selected_option_index` INTEGER NOT NULL,
    `is_correct` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `daily_quiz_attempt_answers_question_id_idx`(`question_id`),
    UNIQUE INDEX `daily_quiz_attempt_answers_attempt_id_question_id_key`(`attempt_id`, `question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exams` (
    `id` VARCHAR(191) NOT NULL,
    `class_room_id` VARCHAR(191) NOT NULL,
    `teacher_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `mapel` VARCHAR(191) NOT NULL,
    `instructions` TEXT NULL,
    `start_at` DATETIME(3) NOT NULL,
    `end_at` DATETIME(3) NOT NULL,
    `duration_minutes` INTEGER NOT NULL DEFAULT 60,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'PUBLISHED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `exams_class_room_id_status_start_at_end_at_idx`(`class_room_id`, `status`, `start_at`, `end_at`),
    INDEX `exams_teacher_id_created_at_idx`(`teacher_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_questions` (
    `id` VARCHAR(191) NOT NULL,
    `exam_id` VARCHAR(191) NOT NULL,
    `prompt` TEXT NOT NULL,
    `options` JSON NOT NULL,
    `correct_option_index` INTEGER NOT NULL,
    `explanation` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `exam_questions_exam_id_sort_order_idx`(`exam_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `exam_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `score` DOUBLE NOT NULL DEFAULT 0,
    `correct_count` INTEGER NOT NULL DEFAULT 0,
    `total_questions` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('SUBMITTED') NOT NULL DEFAULT 'SUBMITTED',
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `exam_attempts_student_id_submitted_at_idx`(`student_id`, `submitted_at`),
    INDEX `exam_attempts_exam_id_score_idx`(`exam_id`, `score`),
    UNIQUE INDEX `exam_attempts_exam_id_student_id_key`(`exam_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_attempt_answers` (
    `id` VARCHAR(191) NOT NULL,
    `attempt_id` VARCHAR(191) NOT NULL,
    `question_id` VARCHAR(191) NOT NULL,
    `selected_option_index` INTEGER NOT NULL,
    `is_correct` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `exam_attempt_answers_question_id_idx`(`question_id`),
    UNIQUE INDEX `exam_attempt_answers_attempt_id_question_id_key`(`attempt_id`, `question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_board_posts` (
    `id` VARCHAR(191) NOT NULL,
    `class_room_id` VARCHAR(191) NOT NULL,
    `author_id` VARCHAR(191) NULL,
    `student_id` VARCHAR(191) NULL,
    `reviewer_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'Karya Siswa',
    `content` TEXT NOT NULL,
    `image_url` TEXT NULL,
    `visibility` ENUM('CLASS', 'SCHOOL', 'GLOBAL') NOT NULL DEFAULT 'CLASS',
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REVISION_REQUESTED', 'REJECTED', 'ARCHIVED') NOT NULL DEFAULT 'PENDING_REVIEW',
    `review_note` TEXT NULL,
    `published_at` DATETIME(3) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `student_board_posts_class_room_id_status_published_at_idx`(`class_room_id`, `status`, `published_at`),
    INDEX `student_board_posts_student_id_status_idx`(`student_id`, `status`),
    INDEX `student_board_posts_author_id_created_at_idx`(`author_id`, `created_at`),
    INDEX `student_board_posts_visibility_status_published_at_idx`(`visibility`, `status`, `published_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_spotlight_submissions` (
    `id` VARCHAR(191) NOT NULL,
    `class_room_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `reviewer_id` VARCHAR(191) NULL,
    `caption` TEXT NOT NULL,
    `video_url` TEXT NOT NULL,
    `thumbnail_url` TEXT NULL,
    `visibility` ENUM('CLASS', 'SCHOOL', 'GLOBAL') NOT NULL DEFAULT 'CLASS',
    `status` ENUM('PENDING_REVIEW', 'PUBLISHED', 'REVISION_REQUESTED', 'REJECTED', 'ARCHIVED') NOT NULL DEFAULT 'PENDING_REVIEW',
    `review_note` TEXT NULL,
    `published_at` DATETIME(3) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `hidden_by_reports_at` DATETIME(3) NULL,
    `moderation_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `student_spotlight_submissions_class_room_id_status_published_idx`(`class_room_id`, `status`, `published_at`),
    INDEX `student_spotlight_submissions_student_id_status_idx`(`student_id`, `status`),
    INDEX `student_spotlight_submissions_visibility_status_published_at_idx`(`visibility`, `status`, `published_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_spotlight_likes` (
    `id` VARCHAR(191) NOT NULL,
    `submission_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `student_spotlight_likes_user_id_idx`(`user_id`),
    UNIQUE INDEX `student_spotlight_likes_submission_id_user_id_key`(`submission_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_spotlight_reports` (
    `id` VARCHAR(191) NOT NULL,
    `submission_id` VARCHAR(191) NOT NULL,
    `reporter_id` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `details` TEXT NULL,
    `status` ENUM('OPEN', 'DISMISSED', 'ACTIONED') NOT NULL DEFAULT 'OPEN',
    `reviewer_id` VARCHAR(191) NULL,
    `review_note` TEXT NULL,
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `student_spotlight_reports_status_created_at_idx`(`status`, `created_at`),
    INDEX `student_spotlight_reports_reviewer_id_reviewed_at_idx`(`reviewer_id`, `reviewed_at`),
    UNIQUE INDEX `student_spotlight_reports_submission_id_reporter_id_key`(`submission_id`, `reporter_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `spotlight_posts` (
    `id` VARCHAR(191) NOT NULL,
    `author_id` VARCHAR(191) NOT NULL,
    `caption` TEXT NOT NULL,
    `video_url` TEXT NOT NULL,
    `thumbnail_url` TEXT NULL,
    `is_published` BOOLEAN NOT NULL DEFAULT true,
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `spotlight_posts_created_at_idx`(`created_at`),
    INDEX `spotlight_posts_author_id_idx`(`author_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `spotlight_likes` (
    `id` VARCHAR(191) NOT NULL,
    `post_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `spotlight_likes_user_id_idx`(`user_id`),
    UNIQUE INDEX `spotlight_likes_post_id_user_id_key`(`post_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `spotlight_comments` (
    `id` VARCHAR(191) NOT NULL,
    `post_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `spotlight_comments_post_id_created_at_idx`(`post_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `affiliate_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `bank_name` VARCHAR(191) NULL,
    `bank_account` VARCHAR(191) NULL,
    `bank_holder` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `affiliate_profiles_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `affiliate_referrals` (
    `id` VARCHAR(191) NOT NULL,
    `affiliate_id` VARCHAR(191) NOT NULL,
    `referred_user_id` VARCHAR(191) NOT NULL,
    `referral_code` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `affiliate_referrals_referred_user_id_key`(`referred_user_id`),
    INDEX `affiliate_referrals_affiliate_id_idx`(`affiliate_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `affiliate_commissions` (
    `id` VARCHAR(191) NOT NULL,
    `affiliate_id` VARCHAR(191) NOT NULL,
    `referral_id` VARCHAR(191) NOT NULL,
    `transaction_id` VARCHAR(191) NOT NULL,
    `order_amount` DECIMAL(12, 2) NOT NULL,
    `commission_rate` DECIMAL(5, 2) NOT NULL,
    `commission_amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `available_at` DATETIME(3) NOT NULL,
    `approved_at` DATETIME(3) NULL,
    `wallet_settled_at` DATETIME(3) NULL,
    `paid_at` DATETIME(3) NULL,
    `payout_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `affiliate_commissions_transaction_id_key`(`transaction_id`),
    INDEX `affiliate_commissions_affiliate_id_status_idx`(`affiliate_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `affiliate_payouts` (
    `id` VARCHAR(191) NOT NULL,
    `affiliate_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'PAID', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `bank_name` VARCHAR(191) NULL,
    `bank_account` VARCHAR(191) NULL,
    `bank_holder` VARCHAR(191) NULL,
    `admin_note` TEXT NULL,
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `affiliate_payouts_affiliate_id_idx`(`affiliate_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `affiliate_partners` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'REGION',
    `contact_name` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `code` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NULL,
    `regency_id` VARCHAR(191) NULL,
    `school_id` VARCHAR(191) NULL,
    `commission_percent` DECIMAL(5, 2) NOT NULL DEFAULT 5,
    `wallet_balance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `bank_name` VARCHAR(191) NULL,
    `bank_account` VARCHAR(191) NULL,
    `bank_holder` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `affiliate_partners_code_key`(`code`),
    INDEX `affiliate_partners_regency_id_idx`(`regency_id`),
    INDEX `affiliate_partners_school_id_idx`(`school_id`),
    INDEX `affiliate_partners_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `partner_commissions` (
    `id` VARCHAR(191) NOT NULL,
    `partner_id` VARCHAR(191) NOT NULL,
    `transaction_id` VARCHAR(191) NOT NULL,
    `referred_user_id` VARCHAR(191) NOT NULL,
    `order_amount` DECIMAL(12, 2) NOT NULL,
    `commission_rate` DECIMAL(5, 2) NOT NULL,
    `commission_amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `available_at` DATETIME(3) NOT NULL,
    `approved_at` DATETIME(3) NULL,
    `wallet_settled_at` DATETIME(3) NULL,
    `paid_at` DATETIME(3) NULL,
    `payout_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `partner_commissions_partner_id_status_idx`(`partner_id`, `status`),
    INDEX `partner_commissions_transaction_id_idx`(`transaction_id`),
    INDEX `partner_commissions_referred_user_id_idx`(`referred_user_id`),
    UNIQUE INDEX `partner_commissions_partner_id_transaction_id_key`(`partner_id`, `transaction_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `partner_payouts` (
    `id` VARCHAR(191) NOT NULL,
    `partner_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'PAID', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `bank_name` VARCHAR(191) NULL,
    `bank_account` VARCHAR(191) NULL,
    `bank_holder` VARCHAR(191) NULL,
    `admin_note` TEXT NULL,
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `partner_payouts_partner_id_idx`(`partner_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reward_missions` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `credit_reward` INTEGER NOT NULL,
    `mission_type` ENUM('ONE_TIME', 'DAILY') NOT NULL,
    `max_per_day` INTEGER NOT NULL DEFAULT 1,
    `action_url` VARCHAR(191) NULL,
    `icon` VARCHAR(191) NOT NULL DEFAULT 'gift',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `reward_missions_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reward_mission_claims` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `mission_id` VARCHAR(191) NOT NULL,
    `credits` INTEGER NOT NULL,
    `claim_key` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reward_mission_claims_user_id_created_at_idx`(`user_id`, `created_at`),
    UNIQUE INDEX `reward_mission_claims_user_id_mission_id_claim_key_key`(`user_id`, `mission_id`, `claim_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `credit_ledger` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `balance_after` INTEGER NOT NULL,
    `source` ENUM('REWARD_MISSION', 'REWARDED_AD', 'SUBSCRIPTION', 'TOPUP', 'AFFILIATE', 'WALLET_CONVERSION', 'REFERRAL_BONUS', 'ADMIN', 'REGISTRATION', 'SPEND_GENERATE') NOT NULL,
    `reference_id` VARCHAR(191) NULL,
    `description` VARCHAR(500) NOT NULL,
    `credit_type` VARCHAR(191) NOT NULL DEFAULT 'GENERAL',
    `expires_at` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `idempotency_key` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `credit_ledger_idempotency_key_key`(`idempotency_key`),
    INDEX `credit_ledger_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallet_ledger` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `balance_after` DECIMAL(12, 2) NOT NULL,
    `source` ENUM('AFFILIATE_COMMISSION', 'CONVERT_TO_CREDIT', 'WITHDRAWAL', 'ADMIN', 'REVERSAL') NOT NULL,
    `reference_id` VARCHAR(191) NULL,
    `description` VARCHAR(500) NOT NULL,
    `metadata` JSON NULL,
    `idempotency_key` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `wallet_ledger_idempotency_key_key`(`idempotency_key`),
    INDEX `wallet_ledger_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reward_ad_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'EXPIRED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `provider` VARCHAR(191) NOT NULL DEFAULT 'sandbox',
    `external_tx_id` VARCHAR(191) NULL,
    `credits_awarded` INTEGER NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `ip_address` VARCHAR(191) NULL,

    UNIQUE INDEX `reward_ad_sessions_external_tx_id_key`(`external_tx_id`),
    INDEX `reward_ad_sessions_user_id_started_at_idx`(`user_id`, `started_at`),
    INDEX `reward_ad_sessions_user_id_status_idx`(`user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversations` (
    `id` VARCHAR(191) NOT NULL,
    `direct_key` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `conversations_direct_key_key`(`direct_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation_participants` (
    `id` VARCHAR(191) NOT NULL,
    `conversation_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `last_read_at` DATETIME(3) NULL,
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `conversation_participants_user_id_idx`(`user_id`),
    UNIQUE INDEX `conversation_participants_conversation_id_user_id_key`(`conversation_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` VARCHAR(191) NOT NULL,
    `conversation_id` VARCHAR(191) NOT NULL,
    `sender_id` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `messages_conversation_id_created_at_idx`(`conversation_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `sender_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `category` ENUM('GENERAL', 'ACADEMIC', 'ASSIGNMENT', 'TKA', 'PJJ', 'READING', 'ADMINISTRATION', 'EVENT') NOT NULL DEFAULT 'GENERAL',
    `priority` ENUM('NORMAL', 'IMPORTANT', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `target_type` ENUM('ALL', 'ROLE', 'SCHOOL', 'CLASS') NOT NULL DEFAULT 'ALL',
    `target_role` ENUM('SUPER_ADMIN', 'PROVINCE_ADMIN', 'SCHOOL_ADMIN', 'STUDENT', 'TEACHER') NULL,
    `school_id` VARCHAR(191) NULL,
    `class_room_id` VARCHAR(191) NULL,
    `target_label` VARCHAR(191) NOT NULL,
    `action_url` VARCHAR(191) NULL,
    `image_url` TEXT NULL,
    `publish_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NULL,
    `published_at` DATETIME(3) NULL,
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `notifications_sender_id_created_at_idx`(`sender_id`, `created_at`),
    INDEX `notifications_status_publish_at_expires_at_idx`(`status`, `publish_at`, `expires_at`),
    INDEX `notifications_school_id_idx`(`school_id`),
    INDEX `notifications_class_room_id_idx`(`class_room_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_recipients` (
    `id` VARCHAR(191) NOT NULL,
    `notification_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `delivered_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notification_recipients_user_id_read_at_delivered_at_idx`(`user_id`, `read_at`, `delivered_at`),
    UNIQUE INDEX `notification_recipients_notification_id_user_id_key`(`notification_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tka_subjects` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'ELECTIVE',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tka_subjects_slug_key`(`slug`),
    INDEX `tka_subjects_category_sort_order_idx`(`category`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tka_questions` (
    `id` VARCHAR(191) NOT NULL,
    `subject_id` VARCHAR(191) NOT NULL,
    `author_id` VARCHAR(191) NOT NULL,
    `reviewer_id` VARCHAR(191) NULL,
    `school_id` VARCHAR(191) NULL,
    `class_room_id` VARCHAR(191) NULL,
    `scope` ENUM('CLASS', 'SCHOOL', 'GLOBAL') NOT NULL DEFAULT 'CLASS',
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `type` ENUM('SINGLE_CHOICE', 'MULTIPLE_CHOICE') NOT NULL DEFAULT 'SINGLE_CHOICE',
    `stimulus` TEXT NULL,
    `prompt` TEXT NOT NULL,
    `options` JSON NOT NULL,
    `correct_answers` JSON NOT NULL,
    `explanation` TEXT NULL,
    `competency` VARCHAR(191) NULL,
    `difficulty` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `version` INTEGER NOT NULL DEFAULT 1,
    `review_note` TEXT NULL,
    `reviewed_at` DATETIME(3) NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tka_questions_scope_status_subject_id_idx`(`scope`, `status`, `subject_id`),
    INDEX `tka_questions_author_id_status_idx`(`author_id`, `status`),
    INDEX `tka_questions_school_id_status_idx`(`school_id`, `status`),
    INDEX `tka_questions_class_room_id_status_idx`(`class_room_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tka_packages` (
    `id` VARCHAR(191) NOT NULL,
    `subject_id` VARCHAR(191) NOT NULL,
    `author_id` VARCHAR(191) NOT NULL,
    `reviewer_id` VARCHAR(191) NULL,
    `school_id` VARCHAR(191) NULL,
    `class_room_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `scope` ENUM('CLASS', 'SCHOOL', 'GLOBAL') NOT NULL DEFAULT 'CLASS',
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `duration_minutes` INTEGER NOT NULL DEFAULT 45,
    `starts_at` DATETIME(3) NULL,
    `ends_at` DATETIME(3) NULL,
    `show_discussion` BOOLEAN NOT NULL DEFAULT true,
    `review_note` TEXT NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tka_packages_scope_status_subject_id_idx`(`scope`, `status`, `subject_id`),
    INDEX `tka_packages_class_room_id_status_idx`(`class_room_id`, `status`),
    INDEX `tka_packages_school_id_status_idx`(`school_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tka_package_questions` (
    `id` VARCHAR(191) NOT NULL,
    `package_id` VARCHAR(191) NOT NULL,
    `question_id` VARCHAR(191) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `tka_package_questions_package_id_sort_order_idx`(`package_id`, `sort_order`),
    UNIQUE INDEX `tka_package_questions_package_id_question_id_key`(`package_id`, `question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tka_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `package_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `status` ENUM('IN_PROGRESS', 'SUBMITTED', 'EXPIRED') NOT NULL DEFAULT 'IN_PROGRESS',
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `submitted_at` DATETIME(3) NULL,
    `score` DOUBLE NULL,
    `correct_count` INTEGER NOT NULL DEFAULT 0,
    `total_questions` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tka_attempts_student_id_status_idx`(`student_id`, `status`),
    UNIQUE INDEX `tka_attempts_package_id_student_id_key`(`package_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tka_answers` (
    `id` VARCHAR(191) NOT NULL,
    `attempt_id` VARCHAR(191) NOT NULL,
    `question_id` VARCHAR(191) NOT NULL,
    `selected_answers` JSON NOT NULL,
    `is_correct` BOOLEAN NULL,
    `answered_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tka_answers_question_id_idx`(`question_id`),
    UNIQUE INDEX `tka_answers_attempt_id_question_id_key`(`attempt_id`, `question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tka_subject_choices` (
    `id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `subject_id` VARCHAR(191) NOT NULL,
    `priority` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tka_subject_choices_student_id_subject_id_key`(`student_id`, `subject_id`),
    UNIQUE INDEX `tka_subject_choices_student_id_priority_key`(`student_id`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reading_books` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `author_name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'id',
    `target_level` VARCHAR(191) NOT NULL DEFAULT 'SMA/SMK',
    `cover_url` TEXT NULL,
    `content_type` ENUM('ARTICLE', 'PDF', 'EXTERNAL_LINK') NOT NULL DEFAULT 'ARTICLE',
    `content_url` TEXT NULL,
    `content_text` LONGTEXT NULL,
    `page_count` INTEGER NOT NULL DEFAULT 1,
    `estimated_minutes` INTEGER NOT NULL DEFAULT 10,
    `license_name` VARCHAR(191) NULL,
    `rights_holder` VARCHAR(191) NULL,
    `source_url` TEXT NULL,
    `scope` ENUM('GLOBAL', 'SCHOOL', 'CLASS') NOT NULL DEFAULT 'CLASS',
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `school_id` VARCHAR(191) NULL,
    `class_room_id` VARCHAR(191) NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `reviewer_id` VARCHAR(191) NULL,
    `review_note` TEXT NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `reading_books_slug_key`(`slug`),
    INDEX `reading_books_scope_status_published_at_idx`(`scope`, `status`, `published_at`),
    INDEX `reading_books_school_id_status_idx`(`school_id`, `status`),
    INDEX `reading_books_class_room_id_status_idx`(`class_room_id`, `status`),
    INDEX `reading_books_created_by_id_status_idx`(`created_by_id`, `status`),
    INDEX `reading_books_category_status_idx`(`category`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reading_progress` (
    `id` VARCHAR(191) NOT NULL,
    `book_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `progress_percent` INTEGER NOT NULL DEFAULT 0,
    `current_page` INTEGER NOT NULL DEFAULT 1,
    `seconds_read` INTEGER NOT NULL DEFAULT 0,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_read_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reading_progress_student_id_last_read_at_idx`(`student_id`, `last_read_at`),
    INDEX `reading_progress_completed_at_idx`(`completed_at`),
    UNIQUE INDEX `reading_progress_book_id_student_id_key`(`book_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reading_favorites` (
    `id` VARCHAR(191) NOT NULL,
    `book_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reading_favorites_student_id_created_at_idx`(`student_id`, `created_at`),
    UNIQUE INDEX `reading_favorites_book_id_student_id_key`(`book_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reading_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `instructions` TEXT NULL,
    `book_id` VARCHAR(191) NOT NULL,
    `class_room_id` VARCHAR(191) NOT NULL,
    `teacher_id` VARCHAR(191) NOT NULL,
    `due_at` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'PUBLISHED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reading_assignments_class_room_id_status_due_at_idx`(`class_room_id`, `status`, `due_at`),
    INDEX `reading_assignments_teacher_id_created_at_idx`(`teacher_id`, `created_at`),
    INDEX `reading_assignments_book_id_idx`(`book_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reading_submissions` (
    `id` VARCHAR(191) NOT NULL,
    `assignment_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `reflection` TEXT NULL,
    `teacher_note` TEXT NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reading_submissions_student_id_submitted_at_idx`(`student_id`, `submitted_at`),
    UNIQUE INDEX `reading_submissions_assignment_id_student_id_key`(`assignment_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pjj_programs` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `province` VARCHAR(191) NOT NULL,
    `school_year` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `starts_at` DATE NULL,
    `ends_at` DATE NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `pjj_programs_created_by_id_status_idx`(`created_by_id`, `status`),
    INDEX `pjj_programs_province_school_year_idx`(`province`, `school_year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pjj_program_schools` (
    `id` VARCHAR(191) NOT NULL,
    `program_id` VARCHAR(191) NOT NULL,
    `school_id` VARCHAR(191) NOT NULL,
    `role` ENUM('INDUK', 'MITRA') NOT NULL,
    `is_approved` BOOLEAN NOT NULL DEFAULT false,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `pjj_program_schools_school_id_role_is_approved_idx`(`school_id`, `role`, `is_approved`),
    UNIQUE INDEX `pjj_program_schools_program_id_school_id_key`(`program_id`, `school_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pjj_enrollments` (
    `id` VARCHAR(191) NOT NULL,
    `program_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'AT_RISK', 'WITHDRAWN', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `access_barrier` TEXT NULL,
    `learning_center_name` VARCHAR(191) NULL,
    `joined_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `pjj_enrollments_program_id_status_idx`(`program_id`, `status`),
    INDEX `pjj_enrollments_student_id_status_idx`(`student_id`, `status`),
    UNIQUE INDEX `pjj_enrollments_program_id_student_id_key`(`program_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `class_teacher_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `class_room_id` VARCHAR(191) NOT NULL,
    `teacher_id` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `role` ENUM('COORDINATOR', 'SUBJECT_TEACHER', 'TUTOR', 'COUNSELOR', 'SUBSTITUTE') NOT NULL DEFAULT 'SUBJECT_TEACHER',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `starts_at` DATE NULL,
    `ends_at` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `class_teacher_assignments_teacher_id_is_active_idx`(`teacher_id`, `is_active`),
    UNIQUE INDEX `class_teacher_assignments_class_room_id_teacher_id_subject_r_key`(`class_room_id`, `teacher_id`, `subject`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `live_class_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `class_room_id` VARCHAR(191) NOT NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `attendance_session_id` VARCHAR(191) NULL,
    `room_name` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `scheduled_start` DATETIME(3) NOT NULL,
    `scheduled_end` DATETIME(3) NOT NULL,
    `actual_start` DATETIME(3) NULL,
    `actual_end` DATETIME(3) NULL,
    `status` ENUM('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `max_participants` INTEGER NOT NULL DEFAULT 50,
    `min_attendance_percent` INTEGER NOT NULL DEFAULT 70,
    `recording_url` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `live_class_sessions_attendance_session_id_key`(`attendance_session_id`),
    UNIQUE INDEX `live_class_sessions_room_name_key`(`room_name`),
    INDEX `live_class_sessions_class_room_id_scheduled_start_idx`(`class_room_id`, `scheduled_start`),
    INDEX `live_class_sessions_status_scheduled_start_idx`(`status`, `scheduled_start`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `live_class_participants` (
    `id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NULL,
    `role` ENUM('TEACHER', 'STUDENT', 'TUTOR', 'MODERATOR') NOT NULL,
    `first_joined_at` DATETIME(3) NULL,
    `last_joined_at` DATETIME(3) NULL,
    `last_left_at` DATETIME(3) NULL,
    `total_seconds` INTEGER NOT NULL DEFAULT 0,
    `join_count` INTEGER NOT NULL DEFAULT 0,
    `connection_quality` VARCHAR(191) NULL,
    `attendance_status` ENUM('PRESENT', 'PARTIAL', 'LATE', 'ABSENT', 'NEEDS_REVIEW') NOT NULL DEFAULT 'NEEDS_REVIEW',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `live_class_participants_student_id_attendance_status_idx`(`student_id`, `attendance_status`),
    UNIQUE INDEX `live_class_participants_session_id_user_id_key`(`session_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `live_class_questions` (
    `id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `is_hand_raise` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('OPEN', 'ANSWERED', 'DISMISSED') NOT NULL DEFAULT 'OPEN',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `answered_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `live_class_questions_session_id_status_created_at_idx`(`session_id`, `status`, `created_at`),
    INDEX `live_class_questions_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pjj_interventions` (
    `id` VARCHAR(191) NOT NULL,
    `student_id` VARCHAR(191) NOT NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `note` TEXT NOT NULL,
    `follow_up_at` DATETIME(3) NULL,
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `pjj_interventions_student_id_resolved_at_idx`(`student_id`, `resolved_at`),
    INDEX `pjj_interventions_created_by_id_created_at_idx`(`created_by_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `livekit_webhook_events` (
    `id` VARCHAR(191) NOT NULL,
    `event` VARCHAR(191) NOT NULL,
    `room_name` VARCHAR(191) NULL,
    `processed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `livekit_webhook_events_event_processed_at_idx`(`event`, `processed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_province_id_fkey` FOREIGN KEY (`province_id`) REFERENCES `provinces`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_referred_by_id_fkey` FOREIGN KEY (`referred_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schools` ADD CONSTRAINT `schools_regency_id_fkey` FOREIGN KEY (`regency_id`) REFERENCES `regencies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_school_profiles` ADD CONSTRAINT `teacher_school_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_school_profiles` ADD CONSTRAINT `teacher_school_profiles_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `regencies` ADD CONSTRAINT `regencies_province_id_fkey` FOREIGN KEY (`province_id`) REFERENCES `provinces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_tool_configs` ADD CONSTRAINT `ai_tool_configs_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `ai_providers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_usage_logs` ADD CONSTRAINT `provider_usage_logs_provider_client_id_fkey` FOREIGN KEY (`provider_client_id`) REFERENCES `provider_clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_credit_package_id_fkey` FOREIGN KEY (`credit_package_id`) REFERENCES `credit_packages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_gateway_id_fkey` FOREIGN KEY (`gateway_id`) REFERENCES `payment_gateways`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_tool_config_id_fkey` FOREIGN KEY (`tool_config_id`) REFERENCES `ai_tool_configs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_usage_logs` ADD CONSTRAINT `ai_usage_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_usage_logs` ADD CONSTRAINT `ai_usage_logs_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_usage_logs` ADD CONSTRAINT `ai_usage_logs_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `ai_providers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_provider_balance_snapshots` ADD CONSTRAINT `ai_provider_balance_snapshots_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `ai_providers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `whatsapp_message_logs` ADD CONSTRAINT `whatsapp_message_logs_gateway_id_fkey` FOREIGN KEY (`gateway_id`) REFERENCES `whatsapp_gateways`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `whatsapp_message_logs` ADD CONSTRAINT `whatsapp_message_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `otp_codes` ADD CONSTRAINT `otp_codes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_rooms` ADD CONSTRAINT `class_rooms_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_rooms` ADD CONSTRAINT `class_rooms_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_rooms` ADD CONSTRAINT `class_rooms_pjj_program_id_fkey` FOREIGN KEY (`pjj_program_id`) REFERENCES `pjj_programs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_class_room_id_fkey` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_sessions` ADD CONSTRAINT `attendance_sessions_class_room_id_fkey` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_sessions` ADD CONSTRAINT `attendance_sessions_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_journals` ADD CONSTRAINT `daily_journals_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_journals` ADD CONSTRAINT `daily_journals_class_room_id_fkey` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_journals` ADD CONSTRAINT `daily_journals_attendance_session_id_fkey` FOREIGN KEY (`attendance_session_id`) REFERENCES `attendance_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_class_room_id_fkey` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grade_records` ADD CONSTRAINT `grade_records_assessment_id_fkey` FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grade_records` ADD CONSTRAINT `grade_records_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_class_room_id_fkey` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignment_submissions` ADD CONSTRAINT `assignment_submissions_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignment_submissions` ADD CONSTRAINT `assignment_submissions_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quizzes` ADD CONSTRAINT `quizzes_class_room_id_fkey` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quizzes` ADD CONSTRAINT `quizzes_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz_questions` ADD CONSTRAINT `quiz_questions_quiz_id_fkey` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz_attempts` ADD CONSTRAINT `quiz_attempts_quiz_id_fkey` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz_attempts` ADD CONSTRAINT `quiz_attempts_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz_attempt_answers` ADD CONSTRAINT `quiz_attempt_answers_attempt_id_fkey` FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz_attempt_answers` ADD CONSTRAINT `quiz_attempt_answers_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `quiz_questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_quizzes` ADD CONSTRAINT `daily_quizzes_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_quiz_questions` ADD CONSTRAINT `daily_quiz_questions_daily_quiz_id_fkey` FOREIGN KEY (`daily_quiz_id`) REFERENCES `daily_quizzes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_quiz_attempts` ADD CONSTRAINT `daily_quiz_attempts_daily_quiz_id_fkey` FOREIGN KEY (`daily_quiz_id`) REFERENCES `daily_quizzes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_quiz_attempts` ADD CONSTRAINT `daily_quiz_attempts_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_quiz_attempt_answers` ADD CONSTRAINT `daily_quiz_attempt_answers_attempt_id_fkey` FOREIGN KEY (`attempt_id`) REFERENCES `daily_quiz_attempts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_quiz_attempt_answers` ADD CONSTRAINT `daily_quiz_attempt_answers_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `daily_quiz_questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `exams_class_room_id_fkey` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `exams_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_questions` ADD CONSTRAINT `exam_questions_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_attempts` ADD CONSTRAINT `exam_attempts_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_attempts` ADD CONSTRAINT `exam_attempts_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_attempt_answers` ADD CONSTRAINT `exam_attempt_answers_attempt_id_fkey` FOREIGN KEY (`attempt_id`) REFERENCES `exam_attempts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_attempt_answers` ADD CONSTRAINT `exam_attempt_answers_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `exam_questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_board_posts` ADD CONSTRAINT `student_board_posts_class_room_id_fkey` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_board_posts` ADD CONSTRAINT `student_board_posts_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_board_posts` ADD CONSTRAINT `student_board_posts_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_board_posts` ADD CONSTRAINT `student_board_posts_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_spotlight_submissions` ADD CONSTRAINT `student_spotlight_submissions_class_room_id_fkey` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_spotlight_submissions` ADD CONSTRAINT `student_spotlight_submissions_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_spotlight_submissions` ADD CONSTRAINT `student_spotlight_submissions_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_spotlight_likes` ADD CONSTRAINT `student_spotlight_likes_submission_id_fkey` FOREIGN KEY (`submission_id`) REFERENCES `student_spotlight_submissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_spotlight_likes` ADD CONSTRAINT `student_spotlight_likes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_spotlight_reports` ADD CONSTRAINT `student_spotlight_reports_submission_id_fkey` FOREIGN KEY (`submission_id`) REFERENCES `student_spotlight_submissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_spotlight_reports` ADD CONSTRAINT `student_spotlight_reports_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_spotlight_reports` ADD CONSTRAINT `student_spotlight_reports_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `spotlight_posts` ADD CONSTRAINT `spotlight_posts_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `spotlight_likes` ADD CONSTRAINT `spotlight_likes_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `spotlight_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `spotlight_likes` ADD CONSTRAINT `spotlight_likes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `spotlight_comments` ADD CONSTRAINT `spotlight_comments_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `spotlight_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `spotlight_comments` ADD CONSTRAINT `spotlight_comments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `affiliate_profiles` ADD CONSTRAINT `affiliate_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `affiliate_referrals` ADD CONSTRAINT `affiliate_referrals_affiliate_id_fkey` FOREIGN KEY (`affiliate_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `affiliate_referrals` ADD CONSTRAINT `affiliate_referrals_referred_user_id_fkey` FOREIGN KEY (`referred_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `affiliate_commissions` ADD CONSTRAINT `affiliate_commissions_affiliate_id_fkey` FOREIGN KEY (`affiliate_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `affiliate_commissions` ADD CONSTRAINT `affiliate_commissions_referral_id_fkey` FOREIGN KEY (`referral_id`) REFERENCES `affiliate_referrals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `affiliate_commissions` ADD CONSTRAINT `affiliate_commissions_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `affiliate_commissions` ADD CONSTRAINT `affiliate_commissions_payout_id_fkey` FOREIGN KEY (`payout_id`) REFERENCES `affiliate_payouts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `affiliate_payouts` ADD CONSTRAINT `affiliate_payouts_affiliate_id_fkey` FOREIGN KEY (`affiliate_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `affiliate_partners` ADD CONSTRAINT `affiliate_partners_regency_id_fkey` FOREIGN KEY (`regency_id`) REFERENCES `regencies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `affiliate_partners` ADD CONSTRAINT `affiliate_partners_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `partner_commissions` ADD CONSTRAINT `partner_commissions_partner_id_fkey` FOREIGN KEY (`partner_id`) REFERENCES `affiliate_partners`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `partner_commissions` ADD CONSTRAINT `partner_commissions_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `partner_commissions` ADD CONSTRAINT `partner_commissions_referred_user_id_fkey` FOREIGN KEY (`referred_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `partner_commissions` ADD CONSTRAINT `partner_commissions_payout_id_fkey` FOREIGN KEY (`payout_id`) REFERENCES `partner_payouts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `partner_payouts` ADD CONSTRAINT `partner_payouts_partner_id_fkey` FOREIGN KEY (`partner_id`) REFERENCES `affiliate_partners`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reward_mission_claims` ADD CONSTRAINT `reward_mission_claims_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reward_mission_claims` ADD CONSTRAINT `reward_mission_claims_mission_id_fkey` FOREIGN KEY (`mission_id`) REFERENCES `reward_missions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credit_ledger` ADD CONSTRAINT `credit_ledger_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_ledger` ADD CONSTRAINT `wallet_ledger_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reward_ad_sessions` ADD CONSTRAINT `reward_ad_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_participants` ADD CONSTRAINT `conversation_participants_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_participants` ADD CONSTRAINT `conversation_participants_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_class_room_id_fkey` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_recipients` ADD CONSTRAINT `notification_recipients_notification_id_fkey` FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_recipients` ADD CONSTRAINT `notification_recipients_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_questions` ADD CONSTRAINT `tka_questions_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `tka_subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_questions` ADD CONSTRAINT `tka_questions_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_questions` ADD CONSTRAINT `tka_questions_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_questions` ADD CONSTRAINT `tka_questions_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_questions` ADD CONSTRAINT `tka_questions_class_room_id_fkey` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_packages` ADD CONSTRAINT `tka_packages_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `tka_subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_packages` ADD CONSTRAINT `tka_packages_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_packages` ADD CONSTRAINT `tka_packages_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_packages` ADD CONSTRAINT `tka_packages_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_packages` ADD CONSTRAINT `tka_packages_class_room_id_fkey` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_package_questions` ADD CONSTRAINT `tka_package_questions_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `tka_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_package_questions` ADD CONSTRAINT `tka_package_questions_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `tka_questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_attempts` ADD CONSTRAINT `tka_attempts_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `tka_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_attempts` ADD CONSTRAINT `tka_attempts_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_answers` ADD CONSTRAINT `tka_answers_attempt_id_fkey` FOREIGN KEY (`attempt_id`) REFERENCES `tka_attempts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_answers` ADD CONSTRAINT `tka_answers_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `tka_questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_subject_choices` ADD CONSTRAINT `tka_subject_choices_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tka_subject_choices` ADD CONSTRAINT `tka_subject_choices_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `tka_subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reading_books` ADD CONSTRAINT `reading_books_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reading_books` ADD CONSTRAINT `reading_books_class_room_id_fkey` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reading_books` ADD CONSTRAINT `reading_books_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reading_books` ADD CONSTRAINT `reading_books_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reading_progress` ADD CONSTRAINT `reading_progress_book_id_fkey` FOREIGN KEY (`book_id`) REFERENCES `reading_books`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reading_progress` ADD CONSTRAINT `reading_progress_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reading_favorites` ADD CONSTRAINT `reading_favorites_book_id_fkey` FOREIGN KEY (`book_id`) REFERENCES `reading_books`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reading_favorites` ADD CONSTRAINT `reading_favorites_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reading_assignments` ADD CONSTRAINT `reading_assignments_book_id_fkey` FOREIGN KEY (`book_id`) REFERENCES `reading_books`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reading_assignments` ADD CONSTRAINT `reading_assignments_class_room_id_fkey` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reading_assignments` ADD CONSTRAINT `reading_assignments_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reading_submissions` ADD CONSTRAINT `reading_submissions_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `reading_assignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reading_submissions` ADD CONSTRAINT `reading_submissions_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pjj_programs` ADD CONSTRAINT `pjj_programs_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pjj_program_schools` ADD CONSTRAINT `pjj_program_schools_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `pjj_programs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pjj_program_schools` ADD CONSTRAINT `pjj_program_schools_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pjj_enrollments` ADD CONSTRAINT `pjj_enrollments_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `pjj_programs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pjj_enrollments` ADD CONSTRAINT `pjj_enrollments_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_teacher_assignments` ADD CONSTRAINT `class_teacher_assignments_class_room_id_fkey` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_teacher_assignments` ADD CONSTRAINT `class_teacher_assignments_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_class_sessions` ADD CONSTRAINT `live_class_sessions_class_room_id_fkey` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_class_sessions` ADD CONSTRAINT `live_class_sessions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_class_sessions` ADD CONSTRAINT `live_class_sessions_attendance_session_id_fkey` FOREIGN KEY (`attendance_session_id`) REFERENCES `attendance_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_class_participants` ADD CONSTRAINT `live_class_participants_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `live_class_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_class_participants` ADD CONSTRAINT `live_class_participants_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_class_participants` ADD CONSTRAINT `live_class_participants_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_class_questions` ADD CONSTRAINT `live_class_questions_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `live_class_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_class_questions` ADD CONSTRAINT `live_class_questions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_class_questions` ADD CONSTRAINT `live_class_questions_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pjj_interventions` ADD CONSTRAINT `pjj_interventions_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pjj_interventions` ADD CONSTRAINT `pjj_interventions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
