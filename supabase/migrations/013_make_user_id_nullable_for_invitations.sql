-- Migration: Make user_id nullable for pending invitations
-- Date: 2025-10-27
-- Purpose: Fix onboarding invitation system
-- Issue: user_id was NOT NULL, preventing invitation creation before user accepts

-- Drop existing primary key constraint (if exists)
ALTER TABLE organization_members
DROP CONSTRAINT IF EXISTS organization_members_pkey;

-- Make user_id nullable (for pending invitations)
ALTER TABLE organization_members
ALTER COLUMN user_id DROP NOT NULL;

-- Add constraint: user_id OR invited_email must be present
ALTER TABLE organization_members
DROP CONSTRAINT IF EXISTS check_user_or_invite;

ALTER TABLE organization_members
ADD CONSTRAINT check_user_or_invite
CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL);

-- Create unique index for active memberships (user_id + org_id when user is set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_user_org
ON organization_members(org_id, user_id)
WHERE user_id IS NOT NULL;

-- Create index for pending invitations (invited_email)
CREATE INDEX IF NOT EXISTS idx_org_members_invited_email
ON organization_members(invited_email)
WHERE invited_email IS NOT NULL AND user_id IS NULL;

-- Add comments
COMMENT ON COLUMN organization_members.user_id IS 'User ID (NULL for pending invitations, filled when invitation is accepted)';
COMMENT ON COLUMN organization_members.invited_email IS 'Email for pending invitation (NULL after invitation is accepted)';
COMMENT ON CONSTRAINT check_user_or_invite ON organization_members IS 'Ensures either user_id or invited_email is present';

-- Verification query (run manually)
-- SELECT
--   CASE
--     WHEN user_id IS NOT NULL AND invited_email IS NULL THEN 'Active Member'
--     WHEN user_id IS NULL AND invited_email IS NOT NULL THEN 'Pending Invitation'
--     WHEN user_id IS NOT NULL AND invited_email IS NOT NULL THEN 'Accepted Invitation (to be cleaned)'
--     ELSE 'Invalid State'
--   END as status,
--   COUNT(*) as count
-- FROM organization_members
-- GROUP BY status;
