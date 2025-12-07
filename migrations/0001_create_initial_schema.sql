-- Migration: Create initial database schema for Bible Image Generator
-- Created: 2025-01-15
-- Description: Creates tables for images, verses, users, moderation_queue, and usage_metrics

-- Images table: stores metadata for generated images
CREATE TABLE images (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  verse_reference TEXT NOT NULL,
  verse_text TEXT NOT NULL,
  prompt TEXT NOT NULL,
  style_preset TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  file_size INTEGER,
  format TEXT DEFAULT 'webp',
  width INTEGER,
  height INTEGER,
  tags TEXT, -- JSON array
  moderation_status TEXT DEFAULT 'approved',
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for images table
CREATE INDEX idx_images_user_id ON images(user_id);
CREATE INDEX idx_images_verse_ref ON images(verse_reference);
CREATE INDEX idx_images_tags ON images(tags);
CREATE INDEX idx_images_generated_at ON images(generated_at);

-- Verses table: stores biblical verses for daily rotation
CREATE TABLE verses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT UNIQUE NOT NULL,
  text TEXT NOT NULL,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  translation TEXT DEFAULT 'NIV',
  theme TEXT, -- JSON array
  last_used DATETIME,
  use_count INTEGER DEFAULT 0
);

-- Indexes for verses table
CREATE INDEX idx_verses_last_used ON verses(last_used);
CREATE INDEX idx_verses_book ON verses(book);

-- Users table: stores user information (optional, for future auth)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  tier TEXT DEFAULT 'free'
);

-- Index for users table
CREATE INDEX idx_users_email ON users(email);

-- Moderation queue: stores flagged content for review
CREATE TABLE moderation_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id TEXT NOT NULL,
  flagged_reason TEXT,
  flagged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  reviewer_id TEXT,
  decision TEXT,
  FOREIGN KEY (image_id) REFERENCES images(id)
);

-- Indexes for moderation_queue table
CREATE INDEX idx_moderation_image_id ON moderation_queue(image_id);
CREATE INDEX idx_moderation_flagged_at ON moderation_queue(flagged_at);

-- Usage metrics: stores daily aggregated usage statistics
CREATE TABLE usage_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  total_generations INTEGER DEFAULT 0,
  successful_generations INTEGER DEFAULT 0,
  failed_generations INTEGER DEFAULT 0,
  total_storage_bytes INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0
);

-- Unique index for usage_metrics to prevent duplicate date entries
CREATE UNIQUE INDEX idx_metrics_date ON usage_metrics(date);
