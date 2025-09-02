-- Create storage buckets for file uploads

-- Create bucket for profile avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Create bucket for startup logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
);

-- Create bucket for pitch decks (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pitch-decks',
  'pitch-decks',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
);

-- Create bucket for videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos',
  'videos',
  true,
  104857600, -- 100MB
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
);

-- Storage policies for avatars bucket
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for logos bucket
CREATE POLICY "Anyone can view logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

CREATE POLICY "Users can upload logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'logos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'logos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their logos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'logos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for pitch decks (restricted access)
CREATE POLICY "Users can view pitch decks they have access to"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'pitch-decks' 
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.matches
        WHERE matches.status = 'accepted'
        AND (
          EXISTS (
            SELECT 1 FROM public.startups
            WHERE startups.user_id = auth.uid()
            AND startups.id = matches.startup_id
          )
          OR EXISTS (
            SELECT 1 FROM public.investors
            WHERE investors.user_id = auth.uid()
            AND investors.id = matches.investor_id
          )
        )
      )
    )
  );

CREATE POLICY "Users can upload their own pitch decks"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pitch-decks' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own pitch decks"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'pitch-decks' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own pitch decks"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pitch-decks' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for videos
CREATE POLICY "Anyone can view videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'videos');

CREATE POLICY "Users can upload videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'videos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their videos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'videos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'videos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );