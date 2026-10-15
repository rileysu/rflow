#!/usr/bin/env bash
# Usage:
#   close-worktree.sh branch <branch>   remove the branch's worktree and delete the branch
#   close-worktree.sh pr <number>       remove a pull request's detached worktree
#
# Runs from any directory of the repo. A branch is deleted only when it is merged
# into the base branch or its upstream holds all of its commits. Otherwise the
# script exits with nothing removed.

set -euo pipefail
source "$(dirname "$0")/lib.sh"

usage() { die "usage: close-worktree.sh branch <branch> | pr <number>"; }

[ $# -eq 2 ] || usage
cd "$(main_checkout)"

case "$1" in
  pr)
    path=$(worktree_path "pr-$2")
    git worktree remove "$path"
    echo "removed $path"
    ;;
  branch)
    branch=$2
    git show-ref --verify --quiet "refs/heads/$branch" || die "branch $branch does not exist"
    if git merge-base --is-ancestor "$branch" "$(base_branch)"; then
      delete_flag=-d
    elif upstream=$(git rev-parse --abbrev-ref --quiet "$branch@{upstream}" 2>/dev/null) \
      && [ "$(git rev-list --count "$upstream..$branch")" -eq 0 ]; then
      delete_flag=-D
    else
      die "$branch has commits that are on neither the base branch nor its upstream; kept the worktree and branch"
    fi
    path=$(worktree_path "$branch")
    if [ -e "$path" ]; then
      git worktree remove "$path"
    fi
    git branch --quiet "$delete_flag" "$branch"
    echo "removed $path and branch $branch"
    ;;
  *) usage ;;
esac
