# GitHub Setup Guide

This guide covers the GitHub configuration required for CI/CD and branch protection.

## Prerequisites

- GitHub repository with admin access
- GitHub CLI (`gh`) installed and authenticated
- VPS server with SSH access configured

## 1. Production Environment Setup

GitHub Environments allow you to configure protection rules and secrets for deployments.

### Create Production Environment

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Environments**
3. Click **New environment**
4. Name it `production`
5. Click **Configure environment**

[Screenshot: Settings > Environments > New environment page]

### Configure Manual Approval

1. In the production environment settings, check **Required reviewers**
2. Add yourself or team members who can approve deployments
3. Optionally set **Wait timer** (e.g., 5 minutes before deployment can proceed)
4. Click **Save protection rules**

[Screenshot: Environment protection rules with required reviewers enabled]

**Note**: The deploy workflow references this environment (currently commented out). Uncomment line 23 in `.github/workflows/deploy.yml` to enable:

```yaml
environment: production  # Uncomment to require manual approval
```

## 2. Repository Secrets

The deployment workflow requires three secrets to connect to your VPS.

### Add Required Secrets

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add each of the following secrets:

[Screenshot: Settings > Secrets and variables > Actions page]

#### VPS_HOST
- **Name**: `VPS_HOST`
- **Value**: Your VPS IP address or hostname (e.g., `192.168.1.100` or `vps.example.com`)

#### VPS_USER
- **Name**: `VPS_USER`
- **Value**: SSH username for deployment (e.g., `yaron-mobile`)

#### VPS_SSH_KEY
- **Name**: `VPS_SSH_KEY`
- **Value**: Private SSH key for authentication
- Generate a deployment key if you don't have one:
  ```bash
  ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy
  ```
- Copy the **private key** content:
  ```bash
  cat ~/.ssh/github_deploy
  ```
- Add the **public key** to your VPS:
  ```bash
  ssh-copy-id -i ~/.ssh/github_deploy.pub user@vps-host
  ```

**Security Note**: Never commit these values to your repository. They should only exist in GitHub Secrets.

## 3. Branch Protection

Branch protection prevents direct pushes to main and enforces code review.

### Option A: Using the Setup Script (Recommended)

Run the provided script to configure branch protection:

```bash
# Show what will be applied
./scripts/setup-branch-protection.sh --dry-run

# Apply protection rules
./scripts/setup-branch-protection.sh
```

The script configures:
- Require CI workflow to pass before merging
- Dismiss stale pull request reviews
- Prevent force pushes to main
- Enforce rules for administrators
- Require 1 pull request review
- Require conversation resolution

### Option B: Manual Setup

1. Go to **Settings** → **Branches**
2. Click **Add branch protection rule**
3. Enter `main` as the branch name pattern
4. Configure the following settings:

[Screenshot: Branch protection rule configuration page]

**Required settings**:
- ☑ Require a pull request before merging
  - ☑ Require approvals: 1
  - ☑ Dismiss stale pull request approvals when new commits are pushed
- ☑ Require status checks to pass before merging
  - ☑ Require branches to be up to date before merging
  - Add status check: `CI`
- ☑ Require conversation resolution before merging
- ☑ Do not allow bypassing the above settings
- ☑ Restrict who can push to matching branches (optional)

5. Click **Create** or **Save changes**

## 4. Verify Setup

### Test CI Workflow

1. Create a new branch:
   ```bash
   git checkout -b test-ci
   ```

2. Make a small change and push:
   ```bash
   echo "# Test" >> README.md
   git add README.md
   git commit -m "test: verify CI workflow"
   git push origin test-ci
   ```

3. Create a pull request on GitHub
4. Verify that the CI workflow runs automatically
5. Check that you cannot merge until CI passes

### Test Deployment Workflow

1. Merge a PR to main (after CI passes)
2. Go to **Actions** tab
3. Verify that:
   - CI workflow completes successfully
   - Deploy workflow triggers automatically
   - check-ci job validates CI success
   - If environment protection is enabled, deployment waits for approval

[Screenshot: Actions tab showing successful CI and deploy workflows]

### Verify Branch Protection

Try to push directly to main:

```bash
git checkout main
git pull origin main
echo "test" >> test.txt
git add test.txt
git commit -m "test: direct push"
git push origin main
```

You should see an error preventing the push.

## 5. Troubleshooting

### Deployment Fails with SSH Error

- Verify `VPS_SSH_KEY` secret contains the correct private key
- Ensure the public key is added to `~/.ssh/authorized_keys` on the VPS
- Check that the VPS user has permission to access the deployment directory

### CI Workflow Not Required for Merge

- Verify the status check name is exactly `CI` (case-sensitive)
- Ensure "Require status checks to pass" is enabled in branch protection
- The CI workflow must run at least once before it appears in the status checks list

### Manual Approval Not Triggering

- Verify the `environment: production` line is uncommented in `deploy.yml`
- Ensure the production environment exists with required reviewers configured
- Check that you're deploying from the main branch

## Next Steps

1. Add the three required secrets to your repository
2. Run the branch protection script or configure manually
3. Create a production environment with manual approval (optional)
4. Test the full workflow with a pull request

For more information, see:
- [GitHub Environments Documentation](https://docs.github.com/actions/deployment/targeting-different-environments)
- [GitHub Secrets Documentation](https://docs.github.com/actions/security-guides/encrypted-secrets)
- [Branch Protection Documentation](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
