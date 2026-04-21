-- Rollback: 把下载中心权限 key 退回顶层前缀 downloadCenter.*

USE comic_admin;

UPDATE IGNORE role_permissions SET permission_key = 'downloadCenter.list'
  WHERE permission_key = 'resource.downloadCenter.list';
UPDATE IGNORE role_permissions SET permission_key = 'downloadCenter.download'
  WHERE permission_key = 'resource.downloadCenter.download';
UPDATE IGNORE role_permissions SET permission_key = 'downloadCenter.retry'
  WHERE permission_key = 'resource.downloadCenter.retry';

DELETE FROM role_permissions
  WHERE permission_key IN (
    'resource.downloadCenter.list',
    'resource.downloadCenter.download',
    'resource.downloadCenter.retry'
  );
