-- Additive, isolated payment records for school subscriptions. Personal teacher
-- transactions remain unchanged.
CREATE TABLE `school_payment_transactions` (
  `id` VARCHAR(191) NOT NULL,
  `school_id` VARCHAR(191) NOT NULL,
  `plan_id` VARCHAR(191) NOT NULL,
  `subscription_id` VARCHAR(191) NULL,
  `invoice_id` VARCHAR(191) NOT NULL,
  `gateway_id` VARCHAR(191) NOT NULL,
  `created_by_id` VARCHAR(191) NOT NULL,
  `billing_cycle` ENUM('MONTHLY','YEARLY') NOT NULL,
  `gateway_ref` VARCHAR(191) NOT NULL,
  `provider_ref` VARCHAR(191) NULL,
  `idempotency_key` VARCHAR(191) NOT NULL,
  `active_checkout_key` VARCHAR(191) NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `status` ENUM('PENDING','PAID','FAILED','EXPIRED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  `payment_method` VARCHAR(191) NULL,
  `paid_at` DATETIME(3) NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `school_payment_transactions_invoice_id_key`(`invoice_id`),
  UNIQUE INDEX `school_payment_transactions_gateway_ref_key`(`gateway_ref`),
  UNIQUE INDEX `school_payment_transactions_provider_ref_key`(`provider_ref`),
  UNIQUE INDEX `school_payment_transactions_idempotency_key_key`(`idempotency_key`),
  UNIQUE INDEX `school_payment_transactions_active_checkout_key_key`(`active_checkout_key`),
  INDEX `school_payment_transactions_school_id_status_created_at_idx`(`school_id`, `status`, `created_at`),
  INDEX `school_payment_transactions_plan_id_idx`(`plan_id`),
  INDEX `school_payment_transactions_subscription_id_idx`(`subscription_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `school_payment_transactions` ADD CONSTRAINT `school_payment_transactions_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_payment_transactions` ADD CONSTRAINT `school_payment_transactions_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `school_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `school_payment_transactions` ADD CONSTRAINT `school_payment_transactions_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `school_subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `school_payment_transactions` ADD CONSTRAINT `school_payment_transactions_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `school_invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `school_payment_transactions` ADD CONSTRAINT `school_payment_transactions_gateway_id_fkey` FOREIGN KEY (`gateway_id`) REFERENCES `payment_gateways`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `school_payment_transactions` ADD CONSTRAINT `school_payment_transactions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
