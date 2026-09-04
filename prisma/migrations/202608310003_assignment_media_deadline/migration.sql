-- Additive migration: retain due_date for legacy integrations while due_at
-- becomes the authoritative timestamp. Existing dates become 23:59:59 WIB
-- (16:59:59 UTC), matching the documented end-of-day behavior.
ALTER TABLE `assignments`
  ADD COLUMN `due_at` DATETIME(3) NULL,
  ADD COLUMN `submission_closed_at` DATETIME(3) NULL;

UPDATE `assignments`
SET `due_at` = TIMESTAMP(`due_date`, '16:59:59')
WHERE `due_date` IS NOT NULL AND `due_at` IS NULL;

ALTER TABLE `assignment_questions`
  ADD COLUMN `image_url` VARCHAR(1000) NULL;

CREATE INDEX `assignments_status_due_at_idx`
  ON `assignments` (`status`, `due_at`);
