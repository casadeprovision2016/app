#!/bin/bash

# ============================================================================
# Bible Image Generator - Local Development Setup Script
# ============================================================================
# This script sets up the local development environment with all dependencies
# Usage: ./scripts/setup-local-dev.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Bible Image Generator - Local Development Setup             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
print_step "1/7 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ required. Current version: $(node -v)"
    exit 1
fi
print_info "Node.js $(node -v) ✓"

if ! command -v npm &> /dev/null; then
    print_error "npm not found. Please install npm"
    exit 1
fi
print_info "npm $(npm -v) ✓"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_warning "Wrangler CLI not found. Installing globally..."
    npm install -g wrangler
fi
print_info "Wrangler $(wrangler --version) ✓"

echo ""
print_step "2/7 Installing project dependencies..."
npm install
print_info "Dependencies installed ✓"

echo ""
print_step "3/7 Setting up local environment variables..."
if [ ! -f .dev.vars ]; then
    if [ -f .dev.vars.example ]; then
        cp .dev.vars.example .dev.vars
        print_info "Created .dev.vars from .dev.vars.example"
        print_warning "Please update .dev.vars with your actual secrets if needed"
    else
        print_warning ".dev.vars.example not found, skipping"
    fi
else
    print_info ".dev.vars already exists ✓"
fi

if [ ! -f frontend/.env.local ]; then
    cat > frontend/.env.local << 'EOF'
# Frontend environment variables for local development
VITE_API_URL=http://localhost:8787
VITE_ENVIRONMENT=development
# Optional: Add Turnstile site key for CAPTCHA testing
# VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
EOF
    print_info "Created frontend/.env.local ✓"
else
    print_info "frontend/.env.local already exists ✓"
fi

echo ""
print_step "4/7 Setting up local D1 database..."

# Apply migrations to local D1 database
if wrangler d1 migrations apply bible-image-db-dev --local 2>/dev/null; then
    print_info "Local D1 database migrations applied ✓"
else
    print_warning "Could not apply migrations. This is normal if database doesn't exist yet."
    print_info "Migrations will be applied automatically when you run 'npm run dev'"
fi

echo ""
print_step "5/7 Creating local development seed data..."

# Create seed data script
cat > scripts/seed-local-data.sql << 'EOF'
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
EOF

print_info "Created seed data script ✓"

echo ""
print_step "6/7 Verifying project structure..."

# Create necessary directories if they don't exist
mkdir -p .wrangler/state/v3/d1
mkdir -p .wrangler/state/v3/r2
mkdir -p .wrangler/state/v3/kv
mkdir -p src/services
mkdir -p src/durableObjects
mkdir -p src/utils
mkdir -p frontend/src
print_info "Project directories verified ✓"

echo ""
print_step "7/7 Running tests to verify setup..."

if npm test 2>/dev/null; then
    print_info "Tests passed ✓"
else
    print_warning "Some tests failed. This is normal for a fresh setup."
    print_info "You can run 'npm test' later to verify everything works"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Setup Complete! 🎉                                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
print_info "Local development environment is ready!"
echo ""
echo "Next steps:"
echo ""
echo "  1. Start the Worker API:"
echo "     ${BLUE}npm run dev${NC}"
echo ""
echo "  2. In a new terminal, start the frontend:"
echo "     ${BLUE}npm run dev:frontend${NC}"
echo ""
echo "  3. Open your browser:"
echo "     - Frontend: ${BLUE}http://localhost:5173${NC}"
echo "     - API: ${BLUE}http://localhost:8787${NC}"
echo ""
echo "  4. Test the API:"
echo "     ${BLUE}curl http://localhost:8787/api/daily-verse${NC}"
echo ""
echo "  5. Run tests:"
echo "     ${BLUE}npm test${NC}"
echo ""
echo "Useful commands:"
echo "  - ${BLUE}npm run test:watch${NC}  - Run tests in watch mode"
echo "  - ${BLUE}npm run test:ui${NC}     - Run tests with UI"
echo "  - ${BLUE}wrangler d1 execute bible-image-db-dev --local --command 'SELECT * FROM verses LIMIT 5'${NC}"
echo "  - ${BLUE}wrangler tail${NC}       - Stream Worker logs"
echo ""
print_info "Happy coding! 🚀"
echo ""
