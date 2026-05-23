-- Create user_preferences table for user-specific UI preferences
-- This fixes the issue where localStorage preferences (showPopular, showFavourites) 
-- were shared across all users on the same device

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  
  -- UI preferences
  show_popular BOOLEAN DEFAULT true,
  show_favourites BOOLEAN DEFAULT false,
  
  -- Additional preferences (JSONB for extensibility)
  additional_settings JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one preferences row per user
  CONSTRAINT unique_user_preferences UNIQUE (user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_org_id ON user_preferences(org_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

-- Enable Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own preferences
CREATE POLICY "Users can read own preferences"
  ON user_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own preferences
CREATE POLICY "Users can insert own preferences"
  ON user_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own preferences
CREATE POLICY "Users can update own preferences"
  ON user_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Service role has full access
CREATE POLICY "Service role full access"
  ON user_preferences
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RPC function to get user preferences (with upsert)
CREATE OR REPLACE FUNCTION get_user_preferences(p_user_id UUID, p_org_id UUID)
RETURNS JSONB AS $$
DECLARE
  pref_record user_preferences%ROWTYPE;
  result JSONB;
BEGIN
  -- Try to get existing preferences
  SELECT * INTO pref_record
  FROM user_preferences
  WHERE user_id = p_user_id;
  
  -- If not found, create default preferences
  IF NOT FOUND THEN
    INSERT INTO user_preferences (user_id, org_id, show_popular, show_favourites)
    VALUES (p_user_id, p_org_id, true, false)
    RETURNING * INTO pref_record;
  END IF;
  
  -- Return as JSONB
  result = jsonb_build_object(
    'show_popular', pref_record.show_popular,
    'show_favourites', pref_record.show_favourites,
    'additional_settings', pref_record.additional_settings
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to update user preferences
CREATE OR REPLACE FUNCTION update_user_preferences(
  p_user_id UUID,
  p_org_id UUID,
  p_show_popular BOOLEAN DEFAULT NULL,
  p_show_favourites BOOLEAN DEFAULT NULL,
  p_additional_settings JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  pref_record user_preferences%ROWTYPE;
  result JSONB;
BEGIN
  -- Upsert preferences
  INSERT INTO user_preferences (user_id, org_id, show_popular, show_favourites, additional_settings)
  VALUES (
    p_user_id,
    p_org_id,
    COALESCE(p_show_popular, true),
    COALESCE(p_show_favourites, false),
    COALESCE(p_additional_settings, '{}'::jsonb)
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    show_popular = COALESCE(EXCLUDED.show_popular, user_preferences.show_popular),
    show_favourites = COALESCE(EXCLUDED.show_favourites, user_preferences.show_favourites),
    additional_settings = COALESCE(EXCLUDED.additional_settings, user_preferences.additional_settings),
    updated_at = NOW()
  RETURNING * INTO pref_record;
  
  -- Return as JSONB
  result = jsonb_build_object(
    'show_popular', pref_record.show_popular,
    'show_favourites', pref_record.show_favourites,
    'additional_settings', pref_record.additional_settings
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
