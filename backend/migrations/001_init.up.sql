-- Comic Admin Database Initialization
-- This file is for reference; GORM AutoMigrate handles schema creation.
-- Run manually to create the database:

CREATE DATABASE IF NOT EXISTS comic_admin
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE comic_admin;

-- Seed: default admin user and role
INSERT INTO users (name, email, status, created_at, updated_at)
VALUES ('超级管理员', 'admin@comic-admin.com', '启用', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = name;

INSERT INTO roles (name, remark, created_at, updated_at)
VALUES ('超级管理员', '拥有所有权限', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = name;

-- Assign all permissions to admin role
INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.key_name FROM roles r
CROSS JOIN (
  SELECT 'resource.book.list' AS key_name UNION ALL
  SELECT 'resource.book.script' UNION ALL
  SELECT 'resource.book.detail' UNION ALL
  SELECT 'resource.script.list' UNION ALL
  SELECT 'resource.script.detail' UNION ALL
  SELECT 'resource.script.publish' UNION ALL
  SELECT 'resource.script.remake' UNION ALL
  SELECT 'resource.comic.list' UNION ALL
  SELECT 'resource.comic.detail' UNION ALL
  SELECT 'resource.comic.download' UNION ALL
  SELECT 'resource.comic.revise' UNION ALL
  SELECT 'resource.downloadCenter.list' UNION ALL
  SELECT 'resource.downloadCenter.download' UNION ALL
  SELECT 'resource.downloadCenter.retry' UNION ALL
  SELECT 'scriptCreate.list' UNION ALL
  SELECT 'scriptCreate.detail' UNION ALL
  SELECT 'scriptCreate.edit' UNION ALL
  SELECT 'scriptCreate.delete' UNION ALL
  SELECT 'scriptCreate.log' UNION ALL
  SELECT 'comicMake.hall.list' UNION ALL
  SELECT 'comicMake.hall.detail' UNION ALL
  SELECT 'comicMake.hall.take' UNION ALL
  SELECT 'comicMake.hall.cancel' UNION ALL
  SELECT 'comicMake.hall.log' UNION ALL
  SELECT 'comicMake.my.list' UNION ALL
  SELECT 'comicMake.my.detail' UNION ALL
  SELECT 'comicMake.my.upload1' UNION ALL
  SELECT 'comicMake.my.upload2' UNION ALL
  SELECT 'comicMake.my.upload3' UNION ALL
  SELECT 'comicMake.my.log' UNION ALL
  SELECT 'review.script.hall_list' UNION ALL
  SELECT 'review.script.hall_detail' UNION ALL
  SELECT 'review.script.hall_take' UNION ALL
  SELECT 'review.script.hall_log' UNION ALL
  SELECT 'review.script.my_list' UNION ALL
  SELECT 'review.script.my_detail' UNION ALL
  SELECT 'review.script.my_review' UNION ALL
  SELECT 'review.script.my_log' UNION ALL
  SELECT 'review.comic.my_list' UNION ALL
  SELECT 'review.comic.my_detail' UNION ALL
  SELECT 'review.comic.my_review' UNION ALL
  SELECT 'review.comic.my_log' UNION ALL
  SELECT 'review.comic.join_list' UNION ALL
  SELECT 'review.comic.join_detail' UNION ALL
  SELECT 'review.comic.join_log' UNION ALL
  SELECT 'system.user.list' UNION ALL
  SELECT 'system.user.edit' UNION ALL
  SELECT 'system.role.list' UNION ALL
  SELECT 'system.role.add' UNION ALL
  SELECT 'system.role.edit' UNION ALL
  SELECT 'system.role.invite' UNION ALL
  SELECT 'system.registerReview.list' UNION ALL
  SELECT 'system.registerReview.approve' UNION ALL
  SELECT 'system.registerReview.reject'
) p
WHERE r.name = '超级管理员'
ON DUPLICATE KEY UPDATE permission_key = permission_key;

-- Assign admin role to admin user
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.email = 'admin@comic-admin.com' AND r.name = '超级管理员'
ON DUPLICATE KEY UPDATE user_id = user_id;
