#!/bin/bash
set -euo pipefail

# Branch Protection Setup Script
# 
# This script configures branch protection rules for the main branch using GitHub CLI.
#
# Usage:
#   ./scripts/setup-branch-protection.sh              # Apply protection rules
#   ./scripts/setup-branch-protection.sh --dry-run    # Show what would be applied
#   ./scripts/setup-branch-protection.sh --show-payload  # Display JSON payload
#   ./scripts/setup-branch-protection.sh --help       # Show this help
#
# Requirements:
#   - GitHub CLI (gh) installed and authenticated
#   - Repository must be a git repository
#   - User must have admin access to the repository
#
# Protection Rules Applied:
#   - Require CI workflow to pass before merging
#   - Dismiss stale pull request reviews when new commits are pushed
#   - Prevent force pushes to main branch
#   - Enforce rules for administrators
#   - Require at least 1 pull request review
#   - Require conversation resolution before merging

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse command line arguments
DRY_RUN=false
SHOW_PAYLOAD=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --show-payload)
      SHOW_PAYLOAD=true
      shift
      ;;
    --help)
      grep '^#' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Check prerequisites
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    echo "Install from: https://cli.github.com/"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with GitHub CLI${NC}"
    echo "Run: gh auth login"
    exit 1
fi

if ! git rev-parse --git-dir &> /dev/null; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# Get repository information dynamically
REPO_OWNER=$(gh repo view --json owner -q '.owner.login' 2>/dev/null || echo "")
REPO_NAME=$(gh repo view --json name -q '.name' 2>/dev/null || echo "")

if [[ -z "$REPO_OWNER" || -z "$REPO_NAME" ]]; then
    echo -e "${RED}Error: Could not determine repository information${NC}"
    echo "Make sure you're in a GitHub repository and have network access"
    exit 1
fi

REPO_FULL="${REPO_OWNER}/${REPO_NAME}"

# Build protection rules payload
PAYLOAD=$(cat <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["CI"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
)

# Show payload if requested
if [[ "$SHOW_PAYLOAD" == true ]]; then
    echo "Branch protection payload for ${REPO_FULL}:"
    echo "$PAYLOAD" | jq .
    exit 0
fi

# Display what will be applied
echo -e "${GREEN}Branch Protection Configuration${NC}"
echo "Repository: ${REPO_FULL}"
echo "Branch: main"
echo ""
echo "Protection Rules:"
echo "  ✓ Require CI workflow to pass"
echo "  ✓ Dismiss stale pull request reviews"
echo "  ✓ Prevent force pushes"
echo "  ✓ Enforce rules for administrators"
echo "  ✓ Require 1 pull request review"
echo "  ✓ Require conversation resolution"
echo ""

# Dry run mode
if [[ "$DRY_RUN" == true ]]; then
    echo -e "${YELLOW}DRY RUN MODE - No changes will be made${NC}"
    echo "Payload that would be sent:"
    echo "$PAYLOAD" | jq .
    exit 0
fi

# Confirm before applying
read -p "Apply these protection rules to ${REPO_FULL}:main? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Apply branch protection
echo "Applying branch protection rules..."
if gh api \
    --method PUT \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/${REPO_FULL}/branches/main/protection" \
    --input - <<< "$PAYLOAD" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Branch protection rules applied successfully${NC}"
else
    echo -e "${RED}✗ Failed to apply branch protection rules${NC}"
    echo "Make sure you have admin access to the repository"
    exit 1
fi
