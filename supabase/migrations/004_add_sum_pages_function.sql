-- supabase/migrations/004_add_sum_pages_function.sql

-- Function to sum the number of pages for all documents in an organization.
-- This is used by the organization overview dashboard for quota calculation.

CREATE OR REPLACE FUNCTION sum_pages_for_org(org_id_param uuid)
RETURNS integer AS $$
DECLARE
  total_pages integer;
BEGIN
  SELECT SUM(pages) INTO total_pages
  FROM documents
  WHERE org_id = org_id_param;

  RETURN COALESCE(total_pages, 0);
END;
$$ LANGUAGE plpgsql;
