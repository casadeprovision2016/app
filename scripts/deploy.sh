#!/bin/bash

# ============================================================================
# Bible Image Generator - Deployment Script
# ============================================================================
# This script helps deploy the application to different environments
# Usage: ./scripts/deploy.sh [environment] [options]
# Environments: dev, staging, production
# Options:
#   --skip-tests: Skip running tests
#   --skip-backup: Skip creating database backup (not recommended for production)
#   --worker-only: Deploy only the Worker
#   --frontend-only: Deploy only the Frontend

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
    echo "Usage: ./scripts/deploy.sh [environment] [options]"
    echo ""
    echo "Environments:"
    echo "  dev         - Development environment"
    echo "  staging     - Staging environment"
    echo "  production  - Production environment"
    echo ""
    echo "Options:"
    echo "  --skip-tests      Skip running tests"
    echo "  --skip-backup     Skip creating database backup"
    echo "  --worker-only     Deploy only the Worker"
    echo "  --frontend-only   Deploy only the Frontend"
    echo "  --help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/deploy.sh production"
    echo "  ./scripts/deploy.sh staging --skip-tests"
    echo "  ./scripts/deploy.sh production --worker-only"
}

# Parse arguments
SKIP_TESTS=false
SKIP_BACKUP=false
WORKER_ONLY=false
FRONTEND_ONLY=false

if [ -z "$1" ] || [ "$1" = "--help" ]; then
    show_usage
    exit 0
fi

ENVIRONMENT=$1
shift

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --worker-only)
            WORKER_ONLY=true
            shift
            ;;
        --frontend-only)
            FRONTEND_ONLY=true
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    echo "Valid environments: dev, staging, production"
    exit 1
fi

echo ""
print_info "========================================="
print_info "Bible Image Generator Deployment"
print_info "Environment: $ENVIRONMENT"
print_info "========================================="
echo ""

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

# Production confirmation
if [ "$ENVIRONMENT" = "production" ]; then
    print_warning "⚠️  You are about to deploy to PRODUCTION!"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        print_info "Deployment cancelled."
        exit 0
    fi
    echo ""
fi

# Create backup for production
if [ "$ENVIRONMENT" = "production" ] && [ "$SKIP_BACKUP" = false ] && [ "$FRONTEND_ONLY" = false ]; then
    print_step "Creating database backup..."
    if ./scripts/migrate-database.sh backup production; then
        print_info "Backup created successfully ✓"
    else
        print_warning "Backup creation failed. Continue anyway? (yes/no)"
        read -p "> " continue_anyway
        if [ "$continue_anyway" != "yes" ]; then
            print_error "Deployment cancelled."
            exit 1
        fi
    fi
    echo ""
fi

# Run tests
if [ "$SKIP_TESTS" = false ] && [ "$FRONTEND_ONLY" = false ]; then
    print_step "Running tests..."
    if npm run test; then
        print_info "Tests passed ✓"
    else
        print_error "Tests failed. Aborting deployment."
        exit 1
    fi
    echo ""
    
    # Type check
    print_step "Running type check..."
    if npm run check; then
        print_info "Type check passed ✓"
    else
        print_error "Type check failed. Aborting deployment."
        exit 1
    fi
    echo ""
fi

# Deploy Worker
if [ "$FRONTEND_ONLY" = false ]; then
    print_step "Deploying Worker..."
    
    case $ENVIRONMENT in
        dev)
            wrangler deploy
            ;;
        staging)
            wrangler deploy --env staging
            ;;
        production)
            wrangler deploy --env production
            ;;
    esac
    
    print_info "Worker deployment complete ✓"
    echo ""
    
    # Get Worker URL
    print_info "Worker URL: https://bible-image-generator-${ENVIRONMENT}.your-account.workers.dev"
    echo ""
fi

# Deploy Frontend
if [ "$WORKER_ONLY" = false ]; then
    print_step "Building frontend..."
    if npm run build:frontend; then
        print_info "Frontend build complete ✓"
    else
        print_error "Frontend build failed. Aborting Pages deployment."
        exit 1
    fi
    echo ""
    
    print_step "Deploying frontend to Cloudflare Pages..."
    case $ENVIRONMENT in
        dev)
            wrangler pages deploy dist/frontend \
                --project-name=bible-image-generator-frontend \
                --branch=dev
            ;;
        staging)
            wrangler pages deploy dist/frontend \
                --project-name=bible-image-generator-frontend \
                --branch=staging
            ;;
        production)
            wrangler pages deploy dist/frontend \
                --project-name=bible-image-generator-frontend \
                --branch=main
            ;;
    esac
    
    print_info "Pages deployment complete ✓"
    echo ""
fi

# Post-deployment verification
echo ""
print_info "========================================="
print_info "Deployment Complete! 🎉"
print_info "========================================="
echo ""

if [ "$FRONTEND_ONLY" = false ]; then
    print_info "Worker Verification:"
    echo "  Test daily verse:"
    echo "    curl https://bible-image-generator-${ENVIRONMENT}.your-account.workers.dev/api/daily-verse"
    echo ""
    echo "  Test image generation:"
    echo "    curl -X POST https://bible-image-generator-${ENVIRONMENT}.your-account.workers.dev/api/generate \\"
    echo "      -H 'Content-Type: application/json' \\"
    echo "      -d '{\"verseReference\": \"John 3:16\", \"stylePreset\": \"modern\"}'"
    echo ""
    echo "  Monitor logs:"
    if [ "$ENVIRONMENT" = "dev" ]; then
        echo "    wrangler tail"
    else
        echo "    wrangler tail --env $ENVIRONMENT"
    fi
    echo ""
fi

if [ "$WORKER_ONLY" = false ]; then
    print_info "Frontend Verification:"
    echo "  Visit: https://bible-image-generator-frontend.pages.dev"
    echo "  Test image generation flow"
    echo "  Verify WhatsApp share works"
    echo "  Test on mobile device"
    echo ""
fi

print_info "Post-Deployment Checklist:"
echo "  1. ✓ Verify Worker endpoints respond correctly"
echo "  2. ✓ Check frontend loads and functions properly"
echo "  3. ✓ Test image generation end-to-end"
echo "  4. ✓ Verify rate limiting works"
echo "  5. ✓ Check scheduled workers (at scheduled times)"
echo "  6. ✓ Monitor error rates in dashboard"
echo "  7. ✓ Verify database queries work"
echo "  8. ✓ Test on multiple devices/browsers"
echo ""

if [ "$ENVIRONMENT" = "production" ]; then
    print_warning "Production Monitoring:"
    echo "  - Monitor error rates for next 30 minutes"
    echo "  - Check user reports/feedback"
    echo "  - Verify metrics are being recorded"
    echo "  - Have rollback plan ready (see docs/ROLLBACK_PROCEDURES.md)"
    echo ""
fi

print_info "Documentation:"
echo "  - Deployment Guide: docs/DEPLOYMENT_GUIDE.md"
echo "  - Rollback Procedures: docs/ROLLBACK_PROCEDURES.md"
echo "  - Environment Setup: docs/ENVIRONMENT_SETUP.md"
echo ""

print_info "Deployment to $ENVIRONMENT complete!"
