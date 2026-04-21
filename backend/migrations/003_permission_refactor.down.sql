-- Rollback: revert permission tree to the pre-003 shape.
--
-- Notes:
--  * We restore the legacy permission keys but do NOT try to recover the exact
--    same set of grants that existed before 003 ran (that information is lost
--    once we collapsed approve/reject back into a single review key).
--  * The legacy keys resource.book.detail_script / system.user.add / scriptCreate.delLog
--    were never enforced anywhere — they are not restored.

USE comic_admin;

-- Rename 漫剧审核 keys back (my_* → original)
UPDATE role_permissions SET permission_key = 'review.comic.list'
  WHERE permission_key = 'review.comic.my_list';
UPDATE role_permissions SET permission_key = 'review.comic.detail'
  WHERE permission_key = 'review.comic.my_detail';
UPDATE role_permissions SET permission_key = 'review.comic.review'
  WHERE permission_key = 'review.comic.my_review';
UPDATE role_permissions SET permission_key = 'review.comic.log'
  WHERE permission_key = 'review.comic.my_log';

-- Collapse approve/reject back into a single review key
INSERT IGNORE INTO role_permissions (role_id, permission_key)
  SELECT DISTINCT role_id, 'system.registerReview.review'
    FROM role_permissions
    WHERE permission_key IN (
      'system.registerReview.approve',
      'system.registerReview.reject'
    );

-- Drop new keys introduced by 003
DELETE FROM role_permissions
  WHERE permission_key IN (
    'review.comic.join_list',
    'review.comic.join_detail',
    'review.comic.join_log',
    'resource.downloadCenter.list',
    'resource.downloadCenter.download',
    'resource.downloadCenter.retry',
    'scriptCreate.detail',
    'system.role.invite',
    'system.registerReview.approve',
    'system.registerReview.reject'
  );
