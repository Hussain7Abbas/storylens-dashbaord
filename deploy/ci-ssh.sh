#!/usr/bin/env bash
set -euo pipefail
# The dedicated restricted SSH key accepts only a verified release commit.
[[ ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy\ ([a-f0-9]{40})$ ]] || { echo 'Expected deploy <commit>'; exit 1; }
commit=${BASH_REMATCH[1]}
cd /srv/storylens-dashboard
# Serialize checkout changes as well as the release swap performed by deploy.sh.
exec 8>/var/lock/storylens-dashboard-ci.lock
flock 8
git fetch origin main --tags
git merge-base --is-ancestor "$commit" origin/main || { echo 'Release commit must belong to main'; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo 'Server checkout has local changes'; exit 1; }
git checkout --detach "$commit"
exec make deploy
