#!/bin/bash

# ============================================================================
# Validate Local Development Setup
# ============================================================================
# Quick validation script to check if local development is properly configured

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Validating Local Development Setup                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check Node.js
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓${NC} $NODE_VERSION"
else
    echo -e "${RED}✗ Not found${NC}"
    exit 1
fi

# Check npm
echo -n "Checking npm... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✓${NC} $NPM_VERSION"
else
    echo -e "${RED}✗ Not found${NC}"
    exit 1
fi

# Check Wrangler
echo -n "Checking Wrangler... "
if command -v wrangler &> /dev/null; then
    WRANGLER_VERSION=$(wrangler --version 2>&1 | head -1)
    echo -e "${GREEN}✓${NC} $WRANGLER_VERSION"
else
    echo -e "${YELLOW}⚠ Not found (will be installed with npm install)${NC}"
fi

# Check node_modules
echo -n "Checking dependencies... "
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} Installed"
else
    echo -e "${YELLOW}⚠ Not installed (run: npm install)${NC}"
fi

# Check .dev.vars
echo -n "Checking .dev.vars... "
if [ -f ".dev.vars" ]; then
    echo -e "${GREEN}✓${NC} Exists"
else
    echo -e "${YELLOW}⚠ Not found (copy from .dev.vars.example)${NC}"
fi

# Check frontend/.env.local
echo -n "Checking frontend/.env.local... "
if [ -f "frontend/.env.local" ]; then
    echo -e "${GREEN}✓${NC} Exists"
else
    echo -e "${YELLOW}⚠ Not found (will be created on first run)${NC}"
fi

# Check wrangler.toml
echo -n "Checking wrangler.toml... "
if [ -f "wrangler.toml" ]; then
    echo -e "${GREEN}✓${NC} Exists"
else
    echo -e "${RED}✗ Not found${NC}"
    exit 1
fi

# Check TypeScript compilation
echo -n "Checking TypeScript... "
if npx tsc --noEmit 2>/dev/null; then
    echo -e "${GREEN}✓${NC} No errors"
else
    echo -e "${YELLOW}⚠ Has errors (check with: npm run check)${NC}"
fi

# Check migrations
echo -n "Checking migrations... "
if [ -d "migrations" ] && [ "$(ls -A migrations/*.sql 2>/dev/null)" ]; then
    MIGRATION_COUNT=$(ls migrations/*.sql 2>/dev/null | wc -l)
    echo -e "${GREEN}✓${NC} $MIGRATION_COUNT migration(s) found"
else
    echo -e "${RED}✗ No migrations found${NC}"
    exit 1
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Validation Complete                                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Run: ${GREEN}npm run dev${NC} (start Worker)"
echo "  2. Run: ${GREEN}npm run dev:frontend${NC} (start frontend in new terminal)"
echo "  3. Open: ${GREEN}http://localhost:5173${NC}"
echo ""
