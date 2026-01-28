#!/usr/bin/env sh

# abort on errors
set -e

# 1. Build
npm run build

# 2. Navigate to dist
cd dist

# 3. Init git and commit
git init
git checkout -b main
git add -A
git commit -m 'deploy: production v3.1'

# 4. Push to gh-pages (You must configure your remote repo first!)
# git push -f git@github.com:USERNAME/pas-cockpit.git main:gh-pages

echo "Deployment build ready in /dist folder."
