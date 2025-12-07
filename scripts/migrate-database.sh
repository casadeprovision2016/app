#!/bin/bash

# ============================================================================
# Bible Image Generator - Database Migration Script
# ============================================================================
# This script manages D1 database migrations across environments
# Usage: ./scripts/migrate-database.sh [command] [environment]
# Commands: apply, list, create, rollback, backup, restore
# Environments: local, dev, staging, production

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: ./scripts/migrate-database.sh [command] [environment]"
    echo ""
    echo "Commands:"
    echo "  apply      - Apply pending migrations"
    echo "  list       - List applied migrations"
    echo "  create     - Create a new migration file"
    echo "  backup     - Backup database to R2"
    echo "  restore    - Restore database from backup"
    echo "  verify     - Verify database schema"
    echo ""
    echo "Environments:"
    echo "  local      - Local development database"
    echo "  dev        - Development environment"
    echo "  staging    - Staging environment"
    echo "  production - Production environment"
    echo ""
    echo "Examples:"
    echo "  ./scripts/migrate-database.sh apply local"
    echo "  ./scripts/migrate-database.sh list production"
    echo "  ./scripts/migrate-database.sh create add_favorites_table"
    echo "  ./scripts/migrate-database.sh backup production"
}

# Check if command is provided
if [ -z "$1" ]; then
    print_error "Command not specified"
    show_usage
    exit 1
fi

COMMAND=$1

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI not found. Install it with: npm install -g wrangler"
    exit 1
fi

# Function to get database name based on environment
get_db_name() {
    local env=$1
    case $env in
        local)
            echo "bible-image-db"
            ;;
        dev)
            echo "bible-image-db-dev"
            ;;
        staging)
            echo "bible-image-db-staging"
            ;;
        production)
            echo "bible-image-db-production"
            ;;
        *)
            print_error "Invalid environment: $env"
            exit 1
            ;;
    esac
}

# Function to get wrangler flags based on environment
get_wrangler_flags() {
    local env=$1
    case $env in
        local)
            echo "--local"
            ;;
        dev)
            echo ""
            ;;
        staging)
            echo "--env staging"
            ;;
        production)
            echo "--env production"
            ;;
        *)
            print_error "Invalid environment: $env"
            exit 1
            ;;
    esac
}

# Command: apply
if [ "$COMMAND" = "apply" ]; then
    if [ -z "$2" ]; then
        print_error "Environment not specified"
        show_usage
        exit 1
    fi
    
    ENVIRONMENT=$2
    DB_NAME=$(get_db_name "$ENVIRONMENT")
    FLAGS=$(get_wrangler_flags "$ENVIRONMENT")
    
    print_info "Applying migrations to $ENVIRONMENT environment..."
    print_info "Database: $DB_NAME"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        print_warning "You are about to apply migrations to PRODUCTION!"
        read -p "Are you sure you want to continue? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            print_info "Migration cancelled."
            exit 0
        fi
        
        # Create backup before production migration
        print_info "Creating backup before migration..."
        BACKUP_FILE="backup-before-migration-$(date +%Y%m%d-%H%M%S).sql"
        wrangler d1 export "$DB_NAME" $FLAGS --output "$BACKUP_FILE"
        print_info "Backup saved to: $BACKUP_FILE"
    fi
    
    # Apply migrations
    if [ "$ENVIRONMENT" = "local" ]; then
        wrangler d1 migrations apply "$DB_NAME" --local
    else
        wrangler d1 migrations apply "$DB_NAME" $FLAGS
    fi
    
    print_info "Migrations applied successfully ✓"
    
    # Verify
    print_info "Verifying database..."
    if [ "$ENVIRONMENT" = "local" ]; then
        wrangler d1 execute "$DB_NAME" --local \
            --command "SELECT name FROM sqlite_master WHERE type='table';"
    else
        wrangler d1 execute "$DB_NAME" $FLAGS \
            --command "SELECT name FROM sqlite_master WHERE type='table';"
    fi

# Command: list
elif [ "$COMMAND" = "list" ]; then
    if [ -z "$2" ]; then
        print_error "Environment not specified"
        show_usage
        exit 1
    fi
    
    ENVIRONMENT=$2
    DB_NAME=$(get_db_name "$ENVIRONMENT")
    FLAGS=$(get_wrangler_flags "$ENVIRONMENT")
    
    print_info "Listing migrations for $ENVIRONMENT environment..."
    print_info "Database: $DB_NAME"
    
    if [ "$ENVIRONMENT" = "local" ]; then
        wrangler d1 migrations list "$DB_NAME" --local
    else
        wrangler d1 migrations list "$DB_NAME" $FLAGS
    fi

# Command: create
elif [ "$COMMAND" = "create" ]; then
    if [ -z "$2" ]; then
        print_error "Migration name not specified"
        echo "Usage: ./scripts/migrate-database.sh create <migration_name>"
        exit 1
    fi
    
    MIGRATION_NAME=$2
    
    # Get next migration number
    LAST_MIGRATION=$(ls migrations/*.sql 2>/dev/null | tail -n 1 | grep -oP '\d{4}' || echo "0002")
    NEXT_NUMBER=$(printf "%04d" $((10#$LAST_MIGRATION + 1)))
    
    MIGRATION_FILE="migrations/${NEXT_NUMBER}_${MIGRATION_NAME}.sql"
    
    print_info "Creating new migration: $MIGRATION_FILE"
    
    # Create migration file with template
    cat > "$MIGRATION_FILE" << EOF
-- Migration: ${MIGRATION_NAME}
-- Created: $(date +%Y-%m-%d)
-- Description: [Add description here]

-- Add your SQL statements here

EOF
    
    print_info "Migration file created: $MIGRATION_FILE"
    print_info "Edit the file to add your SQL statements, then run:"
    echo "  ./scripts/migrate-database.sh apply local"

# Command: backup
elif [ "$COMMAND" = "backup" ]; then
    if [ -z "$2" ]; then
        print_error "Environment not specified"
        show_usage
        exit 1
    fi
    
    ENVIRONMENT=$2
    DB_NAME=$(get_db_name "$ENVIRONMENT")
    FLAGS=$(get_wrangler_flags "$ENVIRONMENT")
    
    BACKUP_FILE="backups/d1-backup-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).sql"
    
    print_info "Creating backup of $ENVIRONMENT database..."
    print_info "Database: $DB_NAME"
    
    # Create backups directory if it doesn't exist
    mkdir -p backups
    
    # Export database
    if [ "$ENVIRONMENT" = "local" ]; then
        wrangler d1 export "$DB_NAME" --local --output "$BACKUP_FILE"
    else
        wrangler d1 export "$DB_NAME" $FLAGS --output "$BACKUP_FILE"
    fi
    
    print_info "Backup created: $BACKUP_FILE"
    
    # Get file size
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    print_info "Backup size: $FILE_SIZE"
    
    # For non-local environments, also upload to R2
    if [ "$ENVIRONMENT" != "local" ]; then
        print_info "Uploading backup to R2..."
        BUCKET_NAME="bible-images-${ENVIRONMENT}"
        R2_KEY="backups/$(basename $BACKUP_FILE)"
        
        wrangler r2 object put "${BUCKET_NAME}/${R2_KEY}" --file "$BACKUP_FILE"
        print_info "Backup uploaded to R2: ${BUCKET_NAME}/${R2_KEY}"
    fi

# Command: restore
elif [ "$COMMAND" = "restore" ]; then
    if [ -z "$2" ]; then
        print_error "Environment not specified"
        show_usage
        exit 1
    fi
    
    if [ -z "$3" ]; then
        print_error "Backup file not specified"
        echo "Usage: ./scripts/migrate-database.sh restore <environment> <backup_file>"
        exit 1
    fi
    
    ENVIRONMENT=$2
    BACKUP_FILE=$3
    DB_NAME=$(get_db_name "$ENVIRONMENT")
    FLAGS=$(get_wrangler_flags "$ENVIRONMENT")
    
    if [ ! -f "$BACKUP_FILE" ]; then
        print_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    print_warning "You are about to restore $ENVIRONMENT database from backup!"
    print_warning "This will OVERWRITE the current database!"
    print_info "Backup file: $BACKUP_FILE"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        print_info "Restore cancelled."
        exit 0
    fi
    
    # Create a backup of current state before restore
    print_info "Creating backup of current state..."
    SAFETY_BACKUP="backups/before-restore-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).sql"
    mkdir -p backups
    
    if [ "$ENVIRONMENT" = "local" ]; then
        wrangler d1 export "$DB_NAME" --local --output "$SAFETY_BACKUP"
    else
        wrangler d1 export "$DB_NAME" $FLAGS --output "$SAFETY_BACKUP"
    fi
    
    print_info "Safety backup created: $SAFETY_BACKUP"
    
    # Restore from backup
    print_info "Restoring database from backup..."
    
    if [ "$ENVIRONMENT" = "local" ]; then
        wrangler d1 execute "$DB_NAME" --local --file "$BACKUP_FILE"
    else
        wrangler d1 execute "$DB_NAME" $FLAGS --file "$BACKUP_FILE"
    fi
    
    print_info "Database restored successfully ✓"
    
    # Verify
    print_info "Verifying restoration..."
    if [ "$ENVIRONMENT" = "local" ]; then
        wrangler d1 execute "$DB_NAME" --local \
            --command "SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table';"
    else
        wrangler d1 execute "$DB_NAME" $FLAGS \
            --command "SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table';"
    fi

# Command: verify
elif [ "$COMMAND" = "verify" ]; then
    if [ -z "$2" ]; then
        print_error "Environment not specified"
        show_usage
        exit 1
    fi
    
    ENVIRONMENT=$2
    DB_NAME=$(get_db_name "$ENVIRONMENT")
    FLAGS=$(get_wrangler_flags "$ENVIRONMENT")
    
    print_info "Verifying $ENVIRONMENT database schema..."
    print_info "Database: $DB_NAME"
    
    echo ""
    print_step "1. Checking tables..."
    if [ "$ENVIRONMENT" = "local" ]; then
        wrangler d1 execute "$DB_NAME" --local \
            --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
    else
        wrangler d1 execute "$DB_NAME" $FLAGS \
            --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
    fi
    
    echo ""
    print_step "2. Checking indexes..."
    if [ "$ENVIRONMENT" = "local" ]; then
        wrangler d1 execute "$DB_NAME" --local \
            --command "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name, name;"
    else
        wrangler d1 execute "$DB_NAME" $FLAGS \
            --command "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name, name;"
    fi
    
    echo ""
    print_step "3. Checking verse count..."
    if [ "$ENVIRONMENT" = "local" ]; then
        wrangler d1 execute "$DB_NAME" --local \
            --command "SELECT COUNT(*) as verse_count FROM verses;"
    else
        wrangler d1 execute "$DB_NAME" $FLAGS \
            --command "SELECT COUNT(*) as verse_count FROM verses;"
    fi
    
    echo ""
    print_step "4. Checking image count..."
    if [ "$ENVIRONMENT" = "local" ]; then
        wrangler d1 execute "$DB_NAME" --local \
            --command "SELECT COUNT(*) as image_count FROM images;"
    else
        wrangler d1 execute "$DB_NAME" $FLAGS \
            --command "SELECT COUNT(*) as image_count FROM images;"
    fi
    
    echo ""
    print_info "Verification complete ✓"

else
    print_error "Unknown command: $COMMAND"
    show_usage
    exit 1
fi
