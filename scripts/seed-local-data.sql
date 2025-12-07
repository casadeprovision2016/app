-- Additional seed data for local development
-- This supplements the data from migrations

-- Insert a test user (optional, for testing authentication)
INSERT OR IGNORE INTO users (id, email, tier) VALUES
  ('test-user-1', 'test@example.com', 'free'),
  ('test-user-2', 'premium@example.com', 'premium');

-- Insert some test images metadata (without actual R2 files)
INSERT OR IGNORE INTO images (id, user_id, verse_reference, verse_text, prompt, style_preset, r2_key, format, tags) VALUES
  ('test-img-1', 'test-user-1', 'John 3:16', 'For God so loved the world...', 'Inspirational scene with love theme', 'modern', 'images/2025/01/test-img-1.webp', 'webp', '["test", "daily-verse"]'),
  ('test-img-2', 'test-user-1', 'Psalm 23:1', 'The LORD is my shepherd...', 'Peaceful pastoral scene', 'classic', 'images/2025/01/test-img-2.webp', 'webp', '["test"]');

-- Update verse usage for testing
UPDATE verses SET last_used = datetime('now', '-2 days'), use_count = 1 WHERE reference = 'John 3:16';
UPDATE verses SET last_used = datetime('now', '-5 days'), use_count = 2 WHERE reference = 'Psalm 23:1';
