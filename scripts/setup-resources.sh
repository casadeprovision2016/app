#!/bin/bash

# ============================================================================
# Bible Image Generator - Resource Setup Script
# ============================================================================
# This script creates all required Cloudflare resources for a given environment
# Usage: ./scripts/setup-resources.sh [environment]
# Environments: dev, staging, production

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

# Check if environment is provided
if [ -z "$1" ]; then
    print_error "Environment not specified"
    echo "Usage: ./scripts/setup-resources.sh [dev|staging|production]"
    exit 1
fi

ENVIRONMENT=$1

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    echo "Valid environments: dev, staging, production"
    exit 1
fi

print_info "Setting up resources for $ENVIRONMENT environment..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI not found. Install it with: npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    print_error "Not logged in to Cloudflare. Run: wrangler login"
    exit 1
fi

# Set resource names based on environment
DB_NAME="bible-image-db-${ENVIRONMENT}"
BUCKET_NAME="bible-images-${ENVIRONMENT}"
KV_NAME="KV_CACHE"

echo ""
print_step "1/5 Creating D1 Database: $DB_NAME"
echo "Run the following command and copy the database_id to wrangler.toml:"
echo ""
echo "  wrangler d1 create $DB_NAME"
echo ""
read -p "Press Enter after you've created the database and updated wrangler.toml..."

echo ""
print_step "2/5 Creating R2 Bucket: $BUCKET_NAME"
if wrangler r2 bucket create "$BUCKET_NAME"; then
    print_info "R2 bucket created successfully ✓"
else
    print_warning "R2 bucket might already exist or creation failed"
fi

echo ""
print_step "3/5 Creating KV Namespace: $KV_NAME"
if [ "$ENVIRONMENT" = "dev" ]; then
    echo "Run the following command and copy the id to wrangler.toml:"
    echo ""
    echo "  wrangler kv:namespace create $KV_NAME"
    echo ""
else
    echo "Run the following command and copy the id to wrangler.toml:"
    echo ""
    echo "  wrangler kv:namespace create $KV_NAME --env $ENVIRONMENT"
    echo ""
fi
read -p "Press Enter after you've created the KV namespace and updated wrangler.toml..."

echo ""
print_step "4/5 Running Database Migrations"
if [ "$ENVIRONMENT" = "dev" ]; then
    if wrangler d1 migrations apply "$DB_NAME" --local; then
        print_info "Local migrations applied successfully ✓"
    else
        print_error "Failed to apply local migrations"
    fi
    
    print_info "Applying migrations to remote database..."
    if wrangler d1 migrations apply "$DB_NAME"; then
        print_info "Remote migrations applied successfully ✓"
    else
        print_error "Failed to apply remote migrations"
    fi
else
    if wrangler d1 migrations apply "$DB_NAME" --env "$ENVIRONMENT"; then
        print_info "Migrations applied successfully ✓"
    else
        print_error "Failed to apply migrations"
    fi
fi

echo ""
print_step "5/5 Setting up Secrets"
print_info "You need to set the following secrets:"
echo ""
echo "  1. JWT_SECRET (for authentication)"
echo "  2. ADMIN_API_KEY (for admin endpoints)"
echo "  3. TURNSTILE_SECRET_KEY (optional, for CAPTCHA)"
echo ""
echo "Generate secure secrets using:"
echo "  openssl rand -base64 32"
echo ""
echo "Set secrets using:"
if [ "$ENVIRONMENT" = "dev" ]; then
    echo "  wrangler secret put JWT_SECRET"
    echo "  wrangler secret put ADMIN_API_KEY"
    echo "  wrangler secret put TURNSTILE_SECRET_KEY"
else
    echo "  wrangler secret put JWT_SECRET --env $ENVIRONMENT"
    echo "  wrangler secret put ADMIN_API_KEY --env $ENVIRONMENT"
    echo "  wrangler secret put TURNSTILE_SECRET_KEY --env $ENVIRONMENT"
fi
echo ""
read -p "Press Enter after you've set all required secrets..."

echo ""
print_info "Resource setup complete! ✓"
echo ""
echo "Next steps:"
echo "  1. Verify all resource IDs are updated in wrangler.toml"
echo "  2. Update ALLOWED_ORIGINS in wrangler.toml with your domain"
echo "  3. Deploy the application: ./scripts/deploy.sh $ENVIRONMENT"
echo "  4. Test the deployment"
echo ""
print_info "Setup for $ENVIRONMENT environment complete!"
