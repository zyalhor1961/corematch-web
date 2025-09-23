-- Function to sum total pages processed for an organization
-- This is a simplified version that works with current schema
CREATE OR REPLACE FUNCTION public.sum_pages_for_org(org_id_param UUID)
RETURNS INTEGER AS $$
BEGIN
  -- Return total DEB pages from usage_counters
  RETURN COALESCE(
    (SELECT SUM(deb_pages_count) 
     FROM usage_counters 
     WHERE org_id = org_id_param),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.sum_pages_for_org(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sum_pages_for_org(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.sum_pages_for_org(UUID) TO service_role;