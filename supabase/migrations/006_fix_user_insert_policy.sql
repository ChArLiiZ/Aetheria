-- Tighten users insert policy to prevent profile spoofing

DROP POLICY IF EXISTS "Allow authenticated users to insert profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = user_id);
