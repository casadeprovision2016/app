# D1 Database Development Guide

## Quick Start

### Initial Setup

1. Apply migrations to create the database schema:
```bash
npx wrangler d1 migrations apply bible-image-db --local
```

2. Verify the setup:
```bash
npx wrangler d1 execute bible-image-db --local --command "SELECT COUNT(*) FROM verses;"
```

You should see 30 verses in the database.

## Common Database Operations

### Querying Data

```bash
# Get all verses
npx wrangler d1 execute bible-image-db --local --command "SELECT * FROM verses LIMIT 10;"

# Get a specific verse
npx wrangler d1 execute bible-image-db --local --command "SELECT * FROM verses WHERE reference = 'John 3:16';"

# Check images table structure
npx wrangler d1 execute bible-image-db --local --command "PRAGMA table_info(images);"

# List all tables
npx wrangler d1 execute bible-image-db --local --command "SELECT name FROM sqlite_master WHERE type='table';"

# List all indexes
npx wrangler d1 execute bible-image-db --local --command "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';"
```

### Testing Queries

You can test complex queries before implementing them in code:

```bash
# Find verses by theme (JSON search)
npx wrangler d1 execute bible-image-db --local --command "SELECT reference, text FROM verses WHERE theme LIKE '%hope%';"

# Get least recently used verse for daily rotation
npx wrangler d1 execute bible-image-db --local --command "SELECT * FROM verses ORDER BY last_used ASC NULLS FIRST LIMIT 1;"

# Get usage metrics for a specific date
npx wrangler d1 execute bible-image-db --local --command "SELECT * FROM usage_metrics WHERE date = '2025-01-15';"
```

### Inserting Test Data

```bash
# Insert a test image record
npx wrangler d1 execute bible-image-db --local --command "INSERT INTO images (id, verse_reference, verse_text, prompt, style_preset, r2_key) VALUES ('test-123', 'John 3:16', 'For God so loved...', 'test prompt', 'modern', 'images/2025/01/test-123.webp');"

# Insert a test user
npx wrangler d1 execute bible-image-db --local --command "INSERT INTO users (id, email, tier) VALUES ('user-123', 'test@example.com', 'free');"
```

### Cleaning Up Test Data

```bash
# Delete test records
npx wrangler d1 execute bible-image-db --local --command "DELETE FROM images WHERE id LIKE 'test-%';"

# Reset verse usage counts
npx wrangler d1 execute bible-image-db --local --command "UPDATE verses SET last_used = NULL, use_count = 0;"
```

## Database Schema Reference

### Images Table
- Stores metadata for all generated images
- Primary key: `id` (TEXT) - UUID or unique identifier
- Foreign key: `user_id` references users table (optional)
- JSON field: `tags` - Array of tags as JSON string

### Verses Table
- Stores biblical verses for daily rotation
- Primary key: `id` (INTEGER AUTOINCREMENT)
- Unique constraint: `reference`
- JSON field: `theme` - Array of themes as JSON string
- Tracking fields: `last_used`, `use_count` for rotation logic

### Users Table
- Stores user information (optional, for future auth)
- Primary key: `id` (TEXT)
- Unique constraint: `email`
- Tier field: 'free' | 'premium' | 'admin'

### Moderation Queue Table
- Stores flagged content for manual review
- Foreign key: `image_id` references images table
- Status tracking: `flagged_at`, `reviewed_at`, `decision`

### Usage Metrics Table
- Stores daily aggregated statistics
- Unique constraint: `date` (one record per day)
- Metrics: generations, success rate, storage usage, unique users

## Working with JSON Fields

The database uses TEXT fields to store JSON data for `tags` and `theme` fields.

### Querying JSON Fields

```bash
# Search for verses with specific theme
npx wrangler d1 execute bible-image-db --local --command "SELECT * FROM verses WHERE theme LIKE '%love%';"

# Search for images with specific tag
npx wrangler d1 execute bible-image-db --local --command "SELECT * FROM images WHERE tags LIKE '%daily-verse%';"
```

### Inserting JSON Data

When inserting, use proper JSON string format:

```sql
INSERT INTO verses (reference, text, book, chapter, verse, theme) 
VALUES ('John 3:16', 'For God so loved...', 'John', 3, 16, '["love", "salvation"]');

INSERT INTO images (id, verse_reference, verse_text, prompt, style_preset, r2_key, tags) 
VALUES ('img-123', 'John 3:16', 'For God so loved...', 'prompt', 'modern', 'key', '["daily-verse", "featured"]');
```

## Performance Optimization

### Index Usage

The following indexes are created for optimal query performance:

**Images Table:**
- `idx_images_user_id` - Fast user-specific queries
- `idx_images_verse_ref` - Fast verse reference lookups
- `idx_images_tags` - Fast tag-based searches
- `idx_images_generated_at` - Fast date-range queries and cleanup

**Verses Table:**
- `idx_verses_last_used` - Fast daily verse rotation queries
- `idx_verses_book` - Fast book-based searches

**Moderation Queue:**
- `idx_moderation_image_id` - Fast image-specific moderation lookups
- `idx_moderation_flagged_at` - Fast time-based queries

**Usage Metrics:**
- `idx_metrics_date` (UNIQUE) - Fast date lookups and prevents duplicates

### Query Tips

1. Always use indexed columns in WHERE clauses when possible
2. Use LIMIT for large result sets
3. Use prepared statements in application code to prevent SQL injection
4. Consider using EXPLAIN QUERY PLAN to analyze query performance

## Troubleshooting

### Reset Local Database

If you need to start fresh:

```bash
# Remove local database
rm -rf .wrangler/state/v3/d1

# Reapply migrations
npx wrangler d1 migrations apply bible-image-db --local
```

### Check Migration Status

```bash
# List applied migrations
npx wrangler d1 migrations list bible-image-db --local

# View migration history
npx wrangler d1 execute bible-image-db --local --command "SELECT * FROM d1_migrations;"
```

### Backup Local Database

```bash
# Export to SQL file
npx wrangler d1 export bible-image-db --local --output backup-local.sql
```

## Remote Database Operations

When working with the remote (production) database, add the `--remote` flag:

```bash
# Apply migrations to remote
npx wrangler d1 migrations apply bible-image-db --remote

# Query remote database
npx wrangler d1 execute bible-image-db --remote --command "SELECT COUNT(*) FROM verses;"

# Export remote database
npx wrangler d1 export bible-image-db --remote --output backup-remote.sql
```

**⚠️ Warning:** Always be careful when running commands against the remote database. Test queries locally first!
