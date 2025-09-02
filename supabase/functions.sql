-- Additional database functions for CoreMatch

-- Function to get potential matches for a user
CREATE OR REPLACE FUNCTION public.get_potential_matches(user_id_input UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  type TEXT,
  match_score DECIMAL,
  tags TEXT[],
  logo_url TEXT
) AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM public.profiles WHERE id = user_id_input;
  
  IF user_role = 'startup' THEN
    -- Return investors that haven't been swiped
    RETURN QUERY
    SELECT 
      i.id,
      i.firm_name as name,
      i.investment_thesis as description,
      'investor'::TEXT as type,
      50.00 as match_score, -- You can implement a more sophisticated scoring algorithm
      i.sectors as tags,
      p.avatar_url as logo_url
    FROM public.investors i
    JOIN public.profiles p ON i.user_id = p.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.swipes s
      WHERE s.user_id = user_id_input
      AND s.target_id = i.id
      AND s.target_type = 'investor'
    )
    ORDER BY RANDOM()
    LIMIT 20;
    
  ELSIF user_role = 'investor' THEN
    -- Return startups that haven't been swiped
    RETURN QUERY
    SELECT 
      s.id,
      s.name,
      s.description,
      'startup'::TEXT as type,
      50.00 as match_score,
      s.tags,
      s.logo_url
    FROM public.startups s
    WHERE s.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.swipes sw
      WHERE sw.user_id = user_id_input
      AND sw.target_id = s.id
      AND sw.target_type = 'startup'
    )
    ORDER BY RANDOM()
    LIMIT 20;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle swipe action
CREATE OR REPLACE FUNCTION public.handle_swipe(
  user_id_input UUID,
  target_id_input UUID,
  target_type_input TEXT,
  action_input TEXT
)
RETURNS JSON AS $$
DECLARE
  match_created BOOLEAN := false;
  match_id_output UUID;
  other_user_id UUID;
  user_role TEXT;
BEGIN
  -- Insert swipe record
  INSERT INTO public.swipes (user_id, target_id, target_type, action)
  VALUES (user_id_input, target_id_input, target_type_input, action_input)
  ON CONFLICT (user_id, target_id, target_type) 
  DO UPDATE SET action = action_input, created_at = NOW();
  
  -- Check if this creates a match (both parties liked each other)
  IF action_input = 'like' THEN
    -- Get user role
    SELECT role INTO user_role FROM public.profiles WHERE id = user_id_input;
    
    IF user_role = 'startup' AND target_type_input = 'investor' THEN
      -- Check if investor already liked this startup
      SELECT user_id INTO other_user_id 
      FROM public.investors 
      WHERE id = target_id_input;
      
      IF EXISTS (
        SELECT 1 FROM public.swipes
        WHERE user_id = other_user_id
        AND target_type = 'startup'
        AND action = 'like'
        AND target_id IN (
          SELECT id FROM public.startups WHERE user_id = user_id_input
        )
      ) THEN
        -- Create match
        INSERT INTO public.matches (
          startup_id,
          investor_id,
          status,
          startup_interested,
          investor_interested,
          startup_swiped_at,
          investor_swiped_at,
          matched_at,
          match_score
        )
        SELECT
          s.id,
          target_id_input,
          'accepted',
          true,
          true,
          NOW(),
          sw.created_at,
          NOW(),
          public.calculate_match_score(s.id, target_id_input)
        FROM public.startups s
        JOIN public.swipes sw ON sw.user_id = other_user_id 
          AND sw.target_id = s.id 
          AND sw.target_type = 'startup'
        WHERE s.user_id = user_id_input
        RETURNING id INTO match_id_output;
        
        match_created := true;
        
        -- Create notifications for both users
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES
          (user_id_input, 'match', 'New Match!', 'You have a new match!', jsonb_build_object('match_id', match_id_output)),
          (other_user_id, 'match', 'New Match!', 'You have a new match!', jsonb_build_object('match_id', match_id_output));
      END IF;
      
    ELSIF user_role = 'investor' AND target_type_input = 'startup' THEN
      -- Check if startup already liked this investor
      SELECT user_id INTO other_user_id 
      FROM public.startups 
      WHERE id = target_id_input;
      
      IF EXISTS (
        SELECT 1 FROM public.swipes
        WHERE user_id = other_user_id
        AND target_type = 'investor'
        AND action = 'like'
        AND target_id IN (
          SELECT id FROM public.investors WHERE user_id = user_id_input
        )
      ) THEN
        -- Create match
        INSERT INTO public.matches (
          startup_id,
          investor_id,
          status,
          startup_interested,
          investor_interested,
          startup_swiped_at,
          investor_swiped_at,
          matched_at,
          match_score
        )
        SELECT
          target_id_input,
          i.id,
          'accepted',
          true,
          true,
          sw.created_at,
          NOW(),
          NOW(),
          public.calculate_match_score(target_id_input, i.id)
        FROM public.investors i
        JOIN public.swipes sw ON sw.user_id = other_user_id 
          AND sw.target_id = i.id 
          AND sw.target_type = 'investor'
        WHERE i.user_id = user_id_input
        RETURNING id INTO match_id_output;
        
        match_created := true;
        
        -- Create notifications for both users
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES
          (user_id_input, 'match', 'New Match!', 'You have a new match!', jsonb_build_object('match_id', match_id_output)),
          (other_user_id, 'match', 'New Match!', 'You have a new match!', jsonb_build_object('match_id', match_id_output));
      END IF;
    END IF;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'match_created', match_created,
    'match_id', match_id_output
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's matches with details
CREATE OR REPLACE FUNCTION public.get_user_matches(user_id_input UUID)
RETURNS TABLE (
  match_id UUID,
  matched_with_id UUID,
  matched_with_name TEXT,
  matched_with_type TEXT,
  matched_with_avatar TEXT,
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  unread_count BIGINT,
  match_score DECIMAL,
  matched_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM public.profiles WHERE id = user_id_input;
  
  IF user_role = 'startup' THEN
    RETURN QUERY
    SELECT 
      m.id as match_id,
      i.id as matched_with_id,
      i.firm_name as matched_with_name,
      'investor'::TEXT as matched_with_type,
      p.avatar_url as matched_with_avatar,
      (SELECT content FROM public.messages msg
       WHERE msg.match_id = m.id 
       ORDER BY msg.created_at DESC 
       LIMIT 1) as last_message,
      (SELECT created_at FROM public.messages msg
       WHERE msg.match_id = m.id 
       ORDER BY msg.created_at DESC 
       LIMIT 1) as last_message_time,
      (SELECT COUNT(*) FROM public.messages msg
       WHERE msg.match_id = m.id 
       AND msg.sender_id != user_id_input 
       AND msg.is_read = false) as unread_count,
      m.match_score,
      m.matched_at
    FROM public.matches m
    JOIN public.investors i ON m.investor_id = i.id
    JOIN public.profiles p ON i.user_id = p.id
    WHERE m.startup_id IN (
      SELECT id FROM public.startups WHERE user_id = user_id_input
    )
    AND m.status = 'accepted'
    ORDER BY m.matched_at DESC;
    
  ELSIF user_role = 'investor' THEN
    RETURN QUERY
    SELECT 
      m.id as match_id,
      s.id as matched_with_id,
      s.name as matched_with_name,
      'startup'::TEXT as matched_with_type,
      s.logo_url as matched_with_avatar,
      (SELECT content FROM public.messages msg
       WHERE msg.match_id = m.id 
       ORDER BY msg.created_at DESC 
       LIMIT 1) as last_message,
      (SELECT created_at FROM public.messages msg
       WHERE msg.match_id = m.id 
       ORDER BY msg.created_at DESC 
       LIMIT 1) as last_message_time,
      (SELECT COUNT(*) FROM public.messages msg
       WHERE msg.match_id = m.id 
       AND msg.sender_id != user_id_input 
       AND msg.is_read = false) as unread_count,
      m.match_score,
      m.matched_at
    FROM public.matches m
    JOIN public.startups s ON m.startup_id = s.id
    WHERE m.investor_id IN (
      SELECT id FROM public.investors WHERE user_id = user_id_input
    )
    AND m.status = 'accepted'
    ORDER BY m.matched_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get analytics for a user
CREATE OR REPLACE FUNCTION public.get_user_analytics(user_id_input UUID)
RETURNS JSON AS $$
DECLARE
  total_swipes INTEGER;
  total_likes INTEGER;
  total_passes INTEGER;
  total_matches INTEGER;
  total_messages INTEGER;
  conversion_rate DECIMAL;
  user_role TEXT;
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM public.profiles WHERE id = user_id_input;
  
  -- Get swipe statistics
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE action = 'like'),
    COUNT(*) FILTER (WHERE action = 'pass')
  INTO total_swipes, total_likes, total_passes
  FROM public.swipes
  WHERE user_id = user_id_input;
  
  -- Get match count
  IF user_role = 'startup' THEN
    SELECT COUNT(*) INTO total_matches
    FROM public.matches m
    WHERE m.startup_id IN (
      SELECT id FROM public.startups WHERE user_id = user_id_input
    )
    AND m.status = 'accepted';
  ELSIF user_role = 'investor' THEN
    SELECT COUNT(*) INTO total_matches
    FROM public.matches m
    WHERE m.investor_id IN (
      SELECT id FROM public.investors WHERE user_id = user_id_input
    )
    AND m.status = 'accepted';
  END IF;
  
  -- Get message count
  SELECT COUNT(*) INTO total_messages
  FROM public.messages
  WHERE sender_id = user_id_input;
  
  -- Calculate conversion rate
  IF total_likes > 0 THEN
    conversion_rate := (total_matches::DECIMAL / total_likes) * 100;
  ELSE
    conversion_rate := 0;
  END IF;
  
  RETURN json_build_object(
    'total_swipes', total_swipes,
    'total_likes', total_likes,
    'total_passes', total_passes,
    'total_matches', total_matches,
    'total_messages', total_messages,
    'conversion_rate', ROUND(conversion_rate, 2),
    'like_rate', CASE WHEN total_swipes > 0 
      THEN ROUND((total_likes::DECIMAL / total_swipes) * 100, 2) 
      ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;