-- Function to sum total pages processed for an organization
CREATE OR REPLACE FUNCTION public.sum_pages_for_org(org_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  total_pages INTEGER;
BEGIN
  -- Sum all pages from document_pages for documents belonging to this organization
  SELECT COALESCE(SUM(dp.page_count), 0)
  INTO total_pages
  FROM documents d
  INNER JOIN document_pages dp ON d.id = dp.document_id
  WHERE d.org_id = org_id_param;
  
  -- If no documents found, check usage_counters for DEB pages
  IF total_pages = 0 THEN
    SELECT COALESCE(SUM(deb_pages_count), 0)
    INTO total_pages
    FROM usage_counters
    WHERE org_id = org_id_param;
  END IF;
  
  RETURN total_pages;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.sum_pages_for_org(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.sum_pages_for_org(UUID) IS 'Returns the total number of pages processed for all documents in an organization';