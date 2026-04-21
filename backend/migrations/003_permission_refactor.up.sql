-- Permission tree refactor
--
-- 1) Removes unused/empty-shell keys.
-- 2) Renames comic review keys to reflect the "待我审核" tab semantics.
-- 3) Adds new keys (download center module, script detail, comic review
--    "我参与的", role invite, register review approve/reject).
-- 4) Migrates existing role grants so roles keep the equivalent set of
--    permissions after the refactor.
--
-- Safe to re-run: INSERT IGNORE skips duplicates, DELETEs are idempotent.

USE comic_admin;

-- ─── 1. Rename 漫剧审核 keys (review.comic.* → review.comic.my_*) ────────────
UPDATE role_permissions SET permission_key = 'review.comic.my_list'
  WHERE permission_key = 'review.comic.list';
UPDATE role_permissions SET permission_key = 'review.comic.my_detail'
  WHERE permission_key = 'review.comic.detail';
UPDATE role_permissions SET permission_key = 'review.comic.my_review'
  WHERE permission_key = 'review.comic.review';
UPDATE role_permissions SET permission_key = 'review.comic.my_log'
  WHERE permission_key = 'review.comic.log';

-- ─── 2. Backfill 我参与的 granular keys for any role that had 漫剧审核 access ─
INSERT IGNORE INTO role_permissions (role_id, permission_key)
  SELECT DISTINCT role_id, 'review.comic.join_list'
    FROM role_permissions WHERE permission_key = 'review.comic.my_list';

INSERT IGNORE INTO role_permissions (role_id, permission_key)
  SELECT DISTINCT role_id, 'review.comic.join_detail'
    FROM role_permissions WHERE permission_key = 'review.comic.my_detail';

INSERT IGNORE INTO role_permissions (role_id, permission_key)
  SELECT DISTINCT role_id, 'review.comic.join_log'
    FROM role_permissions WHERE permission_key = 'review.comic.my_log';

-- ─── 3. Download center (sub-module under 资源管理) ──────────────────────────
-- Any role that previously held resource.comic.download also gets the full
-- download-center triple so existing workflows stay intact.
INSERT IGNORE INTO role_permissions (role_id, permission_key)
  SELECT DISTINCT role_id, 'resource.downloadCenter.list'
    FROM role_permissions WHERE permission_key = 'resource.comic.download';

INSERT IGNORE INTO role_permissions (role_id, permission_key)
  SELECT DISTINCT role_id, 'resource.downloadCenter.download'
    FROM role_permissions WHERE permission_key = 'resource.comic.download';

INSERT IGNORE INTO role_permissions (role_id, permission_key)
  SELECT DISTINCT role_id, 'resource.downloadCenter.retry'
    FROM role_permissions WHERE permission_key = 'resource.comic.download';

-- ─── 4. scriptCreate.detail ──────────────────────────────────────────────────
-- Anyone who can see the script creation list also gets the read-only detail.
INSERT IGNORE INTO role_permissions (role_id, permission_key)
  SELECT DISTINCT role_id, 'scriptCreate.detail'
    FROM role_permissions WHERE permission_key = 'scriptCreate.list';

-- ─── 5. system.role.invite ───────────────────────────────────────────────────
-- Was previously implicitly gated by system.role.list.
INSERT IGNORE INTO role_permissions (role_id, permission_key)
  SELECT DISTINCT role_id, 'system.role.invite'
    FROM role_permissions WHERE permission_key = 'system.role.list';

-- ─── 6. Split system.registerReview.review → approve / reject ────────────────
INSERT IGNORE INTO role_permissions (role_id, permission_key)
  SELECT DISTINCT role_id, 'system.registerReview.approve'
    FROM role_permissions WHERE permission_key = 'system.registerReview.review';

INSERT IGNORE INTO role_permissions (role_id, permission_key)
  SELECT DISTINCT role_id, 'system.registerReview.reject'
    FROM role_permissions WHERE permission_key = 'system.registerReview.review';

-- ─── 7. Drop removed keys ────────────────────────────────────────────────────
DELETE FROM role_permissions
  WHERE permission_key IN (
    'resource.book.detail_script',
    'system.user.add',
    'system.registerReview.review',
    -- Stale typo from a very old seed; safe to clean up regardless.
    'scriptCreate.delLog'
  );
