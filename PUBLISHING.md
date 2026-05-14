# NPM Publication Guide

## Prerequisites

1. **npm Account**: Have an active account at https://npmjs.com
2. **npm Token**: Generate a token with "Publish" permission
3. **.npmrc Configuration**: Set up authentication locally

## Steps to Publish

### 1. Create npm Token

1. Go to https://npmjs.com/settings/tokens
2. Click "Create New Token"
3. Select "Publish" permission level
4. Copy the generated token

### 2. Configure .npmrc

Add your token to `~/.npmrc`:

```bash
# Option A: Using echo
echo "//registry.npmjs.org/:_authToken=YOUR_NPM_TOKEN" >> ~/.npmrc
chmod 600 ~/.npmrc

# Option B: Manual edit
nano ~/.npmrc
# Add: //registry.npmjs.org/:_authToken=YOUR_NPM_TOKEN
```

### 3. Publish the Package

```bash
cd /home/davidwarshawsky/projects/claude-code-router

# Verify the package contents (dry run)
npm pack --json --dry-run

# Publish to npm
npm publish

# Publish with tag for pre-release (optional)
npm publish --tag alpha
npm publish --tag beta
```

### 4. Verify Publication

```bash
# Check if published
npm view @davidwarshawsky/claude-code-router

# Install from npm
npm install -g @davidwarshawsky/claude-code-router
```

## Troubleshooting

### "403 Forbidden" Error
- Ensure you have a valid npm token
- Verify the `.npmrc` file has correct permissions (600)
- Check that the package name is scoped correctly

### "404 Not Found" Error
- Ensure you're publishing from the correct directory
- Verify the build was successful (`pnpm build`)
- Check that `dist/` folder exists and has content

### Authentication Issues
- Clear npm cache: `npm cache clean --force`
- Re-run `npm login` or update `.npmrc`

## Current Package Info

- **Package Name**: @davidwarshawsky/claude-code-router
- **Version**: 2.0.0
- **Repository**: https://github.com/davidwarshawsky/claude-code-router
- **License**: MIT
- **Entry Point**: dist/cli.js

## After Publishing

1. Update GitHub releases with npm installation info
2. Update documentation with installation command
3. Consider setting up CI/CD pipeline for automated publishing
