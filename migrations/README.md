# D1 Database Migrations

This directory contains SQL migration files for the Bible Image Generator D1 database.

## Migration Files

- `0001_create_initial_schema.sql` - Creates all database tables and indexes
- `0002_seed_verses.sql` - Seeds the verses table with 30 popular biblical verses

## Running Migrations

### Local Development

To apply migrations to your local D1 database:

```bash
# Apply all pending migrations
wrangler d1 migrations apply bible-image-db --local

# List applied migrations
wrangler d1 migrations list bible-image-db --local
```

### Remote (Production/Staging)

To apply migrations to remote D1 database:

```bash
# Apply all pending migrations to remote database
wrangler d1 migrations apply bible-image-db --remote

# List applied migrations on remote
wrangler d1 migrations list bible-image-db --remote
```

## Creating New Migrations

When creating new migrations, follow the naming convention:

```
XXXX_description_of_change.sql
```

Where `XXXX` is the next sequential number (e.g., 0003, 0004, etc.).

## Database Schema

### Tables

1. **images** - Stores metadata for generated images
   - Primary key: `id` (TEXT)
   - Indexes: user_id, verse_reference, tags, generated_at

2. **verses** - Stores biblical verses for daily rotation
   - Primary key: `id` (INTEGER AUTOINCREMENT)
   - Indexes: last_used, book
   - Unique constraint: reference

3. **users** - Stores user information (optional, for future auth)
   - Primary key: `id` (TEXT)
   - Indexes: email
   - Unique constraint: email

4. **moderation_queue** - Stores flagged content for review
   - Primary key: `id` (INTEGER AUTOINCREMENT)
   - Indexes: image_id, flagged_at
   - Foreign key: image_id → images(id)

5. **usage_metrics** - Stores daily aggregated usage statistics
   - Primary key: `id` (INTEGER AUTOINCREMENT)
   - Unique index: date

## Querying the Database

You can query the database using wrangler:

```bash
# Local database
wrangler d1 execute bible-image-db --local --command "SELECT * FROM verses LIMIT 5"

# Remote database
wrangler d1 execute bible-image-db --remote --command "SELECT * FROM verses LIMIT 5"
```

## Backup and Restore

The application includes automated backup functionality via Scheduled Workers, but you can also manually backup:

```bash
# Export database to SQL file
wrangler d1 export bible-image-db --remote --output backup.sql

# Import from SQL file (use with caution)
wrangler d1 execute bible-image-db --remote --file backup.sql
```
