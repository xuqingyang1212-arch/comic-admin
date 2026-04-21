-- 下载中心 权限命名空间迁移
--
-- 背景：下载中心是 资源管理 下的二级菜单，但早期 003 迁移里用的是顶层
-- downloadCenter.* 前缀。将它降级到 resource.downloadCenter.*，与菜单层级保持一致。
--
-- 对"已跑过 003 的旧库"：本脚本把三条旧 key rename 成新的 namespaced key。
-- 对"从 0 跑 001 + 003"的新库：003 已经直接写入新 key，此脚本为 NO-OP。
--
-- 安全可重复执行：UPDATE 在 WHERE 过滤下幂等，INSERT IGNORE 天然去重。

USE comic_admin;

-- ─── 1. Rename grants ────────────────────────────────────────────────────────
-- 已经有 resource.downloadCenter.* 的情况下，IGNORE 会跳过冲突避免唯一索引报错。
UPDATE IGNORE role_permissions SET permission_key = 'resource.downloadCenter.list'
  WHERE permission_key = 'downloadCenter.list';
UPDATE IGNORE role_permissions SET permission_key = 'resource.downloadCenter.download'
  WHERE permission_key = 'downloadCenter.download';
UPDATE IGNORE role_permissions SET permission_key = 'resource.downloadCenter.retry'
  WHERE permission_key = 'downloadCenter.retry';

-- ─── 2. Clean up any leftover legacy rows (UPDATE IGNORE 跳过的冲突行) ────────
DELETE FROM role_permissions
  WHERE permission_key IN (
    'downloadCenter.list',
    'downloadCenter.download',
    'downloadCenter.retry'
  );
