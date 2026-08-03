-- Backfill space_members for existing org spaces created before the
-- auto-derivation logic existed. New org spaces get member rows at creation
-- time; older ones have empty space_members, so org admins (and members) were
-- losing edit/read role resolution after the permission enforcement update.
-- Idempotent: ON CONFLICT DO NOTHING keeps already-manual rows untouched.
INSERT INTO space_members (space_id, user_id, role)
SELECT s.id, om.user_id,
       CASE
         WHEN om.user_id = s.owner_id THEN 'owner'
         WHEN om.role = 'admin' THEN 'editor'
         ELSE 'viewer'
       END
FROM spaces s
JOIN org_members om ON om.org_id = s.org_id
WHERE s.org_id IS NOT NULL
ON CONFLICT (space_id, user_id) DO NOTHING;
