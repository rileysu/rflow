#!/usr/bin/env bash
# Usage: close-worktree.sh <branch>
#
# Run from the main checkout. Removes the branch's worktree at
# ../.worktrees/<repo>-<branch>, then deletes the local branch. Deletion goes
# ahead only when the branch is merged into the main checkout's HEAD or has an
# upstream holding all of its commits; otherwise nothing is removed.

source "$(dirname "$0")/lib.sh"

branch="${1:-}"
[ -n "$branch" ] || die "usage: close-worktree.sh <branch>"
in_linked_worktree && die "run from the main checkout; leave the worktree first"
git show-ref --verify --quiet "refs/heads/$branch" || die "branch $branch does not exist"

if git merge-base --is-ancestor "$branch" HEAD; then
  delete_flag=-d
elif upstream=$(git rev-parse --abbrev-ref --quiet "$branch@{upstream}" 2>/dev/null) \
  && [ "$(git rev-list --count "$upstream..$branch")" -eq 0 ]; then
  delete_flag=-D
else
  die "$branch has commits that are on neither HEAD nor its upstream; kept the worktree and branch"
fi

path=$(worktree_path "$branch")
if [ -e "$path" ]; then
  git worktree remove "$path"
fi
git branch --quiet "$delete_flag" "$branch"
echo "removed $path and branch $branch"
