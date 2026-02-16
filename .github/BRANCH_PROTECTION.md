# Branch Protection Rules

This document outlines the branch protection rules that should be configured in GitHub to ensure code quality and safe deployments.

## Required Branch Protection Settings for `main`

### Via GitHub UI

Navigate to: **Settings → Branches → Add branch protection rule**

Configure the following:

| Setting | Value | Description |
|---------|-------|-------------|
| Branch name pattern | `main` | Protect the main branch |
| ✅ Require pull request reviews before merging | Enabled | Require at least 1 approval |
| ✅ Dismiss stale reviews when new commits are pushed | Enabled | Update review status on new commits |
| ✅ Require review from code owners | Enabled | Require approval from designated owners |
| ✅ Require status checks to pass before merging | Enabled | Block merge until CI passes |
| ✅ Require branches to be up to date before merging | Enabled | Ensure merge has latest main |
| ✅ Require conversation resolution before merging | Enabled | All comments must be resolved |
| ✅ Do not allow bypassing the above settings | Enabled | Prevent admin override |

### Status Checks Required

Add these required status checks:

1. **CI - Build Smart Contract** - Ensures contract compiles successfully
2. **CI - Run Unit Tests** - Ensures all tests pass
3. **CI - Lint & Type Check** - Ensures code quality standards
4. **CI - TEAL Security Audit** - Ensures contract passes security review

### Via GitHub CLI (gh)

```bash
# Install gh if not already installed
brew install gh  # macOS
# or
winget install gh  # Windows

# Authenticate
gh auth login

# Create branch protection rule
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  -F required_status_checks='{"strict": true, "contexts": ["CI - Build Smart Contract", "CI - Run Unit Tests", "CI - Lint & Type Check", "CI - TEAL Security Audit"]}' \
  -F required_pull_request_reviews='{"dismiss_stale_reviews": true, "require_code_owner_reviews": true, "required_approving_review_count": 1}' \
  -F enforce_admins='{"enabled": true}' \
  -F restrictions='null'
```

### Via Terraform (Infrastructure as Code)

```hcl
# main.tf
resource "github_branch_protection" "main" {
  repository_id  = github_repository.repo.id
  pattern       = "main"

  required_status_checks {
    strict   = true
    contexts = [
      "CI - Build Smart Contract",
      "CI - Run Unit Tests",
      "CI - Lint & Type Check",
      "CI - TEAL Security Audit"
    ]
  }

  required_pull_request_reviews {
    dismiss_stale_reviews           = true
    require_code_owner_reviews      = true
    required_approving_review_count = 1
  }

  enforce_admins = true
}
```

## Additional Protection Rules

### Require Signed Commits (Optional)

```bash
gh api repos/:owner/:repo/branches/main/protection/required_signatures \
  --method POST \
  -H "Accept: application/vnd.github.luke-c-preview+json"
```

### Require Linear History (Optional)

```bash
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  -F required_linear_history=true
```

## Workflow Summary

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Feature    │     │   Pull      │     │   Merge     │
│  Branch     │────▶│   Request   │────▶│   to Main   │
│  (dev)      │     │  (review)   │     │  (deploy)   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │    CI       │     │     CD      │
                    │  (build,    │     │  (deploy    │
                    │   test,     │     │  testnet)   │
                    │   lint)     │     │             │
                    └─────────────┘     └─────────────┘
```

## Best Practices

1. **Never push directly to main** - All changes must go through PR
2. **Keep PRs small and focused** - Easier to review and test
3. **Write descriptive PR titles** - Help reviewers understand the change
4. **Link issues to PRs** - Use keywords like "Closes #123"
5. **Update documentation** - Keep README and inline docs current
6. **Test locally before PR** - Run `npm run build` and `npm run test`

## Troubleshooting

### "Required status check failed"

- Check the failed workflow in the Actions tab
- Ensure all tests pass locally before pushing
- Check if a dependency was updated and may have breaking changes

### "Review required"

- Request review from a code owner or team member
- Address all comments and mark them as resolved

### "Branch out of date"

- Pull the latest changes from main to your branch
- Resolve any merge conflicts
- Push the updates
