-- Add credits_balance column to organizations for the credit system
-- Each search costs 1 credit

-- Add the column with a default of 50 credits (free trial)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS credits_balance INTEGER DEFAULT 50 NOT NULL;

-- Add a comment
COMMENT ON COLUMN organizations.credits_balance IS 'Number of credits available for searches. Each search costs 1 credit.';
