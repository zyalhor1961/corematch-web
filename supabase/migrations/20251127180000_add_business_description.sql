-- Add business_description column to organizations table
-- This column stores a description of what the organization does,
-- used for context in CRM/sourcing searches

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS business_description TEXT;

COMMENT ON COLUMN organizations.business_description IS 'Description of the organization business, used for CRM sourcing context';
