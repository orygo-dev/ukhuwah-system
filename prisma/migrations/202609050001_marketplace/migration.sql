-- Marketplace domain was in schema.prisma (local `db push`) but never
-- shipped as a Prisma migration, so production `migrate deploy` omitted it.

ALTER TABLE `users`
  MODIFY `role` ENUM('SUPER_ADMIN', 'PROVINCE_ADMIN', 'SCHOOL_ADMIN', 'STUDENT', 'TEACHER', 'MERCHANT') NOT NULL DEFAULT 'TEACHER';

CREATE TABLE `merchant_stores` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `address` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `bank_name` VARCHAR(191) NULL,
    `bank_account` VARCHAR(191) NULL,
    `bank_holder` VARCHAR(191) NULL,
    `flat_shipping_fee` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status` ENUM('PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW',
    `rejection_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `merchant_stores_user_id_key`(`user_id`),
    UNIQUE INDEX `merchant_stores_slug_key`(`slug`),
    INDEX `merchant_stores_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `marketplace_products` (
    `id` VARCHAR(191) NOT NULL,
    `store_id` VARCHAR(191) NOT NULL,
    `kind` ENUM('BOOK_PHYSICAL', 'BOOK_DIGITAL', 'STATIONERY') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `image_url` VARCHAR(191) NULL,
    `digital_file_key` VARCHAR(191) NULL,
    `digital_file_name` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `rejection_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `marketplace_products_storeId_slug_key`(`store_id`, `slug`),
    INDEX `marketplace_products_store_id_status_idx`(`store_id`, `status`),
    INDEX `marketplace_products_status_kind_idx`(`status`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `marketplace_cart_items` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `store_id` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `marketplace_cart_items_userId_productId_key`(`user_id`, `product_id`),
    INDEX `marketplace_cart_items_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `marketplace_orders` (
    `id` VARCHAR(191) NOT NULL,
    `buyer_id` VARCHAR(191) NOT NULL,
    `buyer_type` ENUM('TEACHER', 'SCHOOL') NOT NULL,
    `school_id` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `shipping_name` VARCHAR(191) NOT NULL,
    `shipping_phone` VARCHAR(191) NOT NULL,
    `shipping_address` TEXT NOT NULL,
    `shipping_city` VARCHAR(191) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `gateway_id` VARCHAR(191) NOT NULL,
    `gateway_ref` VARCHAR(191) NOT NULL,
    `paid_at` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `marketplace_orders_gateway_ref_key`(`gateway_ref`),
    INDEX `marketplace_orders_buyer_id_status_idx`(`buyer_id`, `status`),
    INDEX `marketplace_orders_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `marketplace_sub_orders` (
    `id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NOT NULL,
    `store_id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'READY', 'SHIPPED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `goods_amount` DECIMAL(12, 2) NOT NULL,
    `shipping_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `courier` VARCHAR(191) NULL,
    `tracking_number` VARCHAR(191) NULL,
    `shipped_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `marketplace_sub_orders_store_id_status_idx`(`store_id`, `status`),
    INDEX `marketplace_sub_orders_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `marketplace_order_items` (
    `id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NOT NULL,
    `sub_order_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `kind` ENUM('BOOK_PHYSICAL', 'BOOK_DIGITAL', 'STATIONERY') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `digital_file_key` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `marketplace_order_items_order_id_idx`(`order_id`),
    INDEX `marketplace_order_items_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `merchant_stores` ADD CONSTRAINT `merchant_stores_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `marketplace_products` ADD CONSTRAINT `marketplace_products_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `merchant_stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `marketplace_cart_items` ADD CONSTRAINT `marketplace_cart_items_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `marketplace_cart_items` ADD CONSTRAINT `marketplace_cart_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `marketplace_products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `marketplace_cart_items` ADD CONSTRAINT `marketplace_cart_items_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `merchant_stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `marketplace_orders` ADD CONSTRAINT `marketplace_orders_buyer_id_fkey` FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `marketplace_orders` ADD CONSTRAINT `marketplace_orders_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `marketplace_orders` ADD CONSTRAINT `marketplace_orders_gateway_id_fkey` FOREIGN KEY (`gateway_id`) REFERENCES `payment_gateways`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `marketplace_sub_orders` ADD CONSTRAINT `marketplace_sub_orders_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `marketplace_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `marketplace_sub_orders` ADD CONSTRAINT `marketplace_sub_orders_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `merchant_stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `marketplace_order_items` ADD CONSTRAINT `marketplace_order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `marketplace_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `marketplace_order_items` ADD CONSTRAINT `marketplace_order_items_sub_order_id_fkey` FOREIGN KEY (`sub_order_id`) REFERENCES `marketplace_sub_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `marketplace_order_items` ADD CONSTRAINT `marketplace_order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `marketplace_products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
