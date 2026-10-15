#!/usr/bin/env bash
# Usage:
#   open-worktree.sh branch [--no-tracker] <type>/<topic>   new branch from the base branch
#   open-worktree.sh pr <number|url>                         detached checkout of a pull request
#
# Runs from any directory of the repo. Fast-forwards the base branch when it tracks a
# remote, creates the worktree under ../.worktrees/, and prints its absolute path
# on stdout. Requires docs/agents/issue-tracker.md unless --no-tracker is given.

set -euo pipefail
source "$(dirname "$0")/lib.sh"

usage() { die "usage: open-worktree.sh branch [--no-tracker] <type>/<topic> | pr <number|url>"; }

require_tracker=true
case "${1:-}" in
  branch)
    mode=branch
    shift
    if [ "${1:-}" = --no-tracker ]; then require_tracker=false; shift; fi
    ;;
  pr) mode=pr; shift ;;
  *) usage ;;
esac
[ $# -eq 1 ] || usage
target=$1

main_path=$(main_checkout)
cd "$main_path"
if $require_tracker && [ ! -f "$main_path/docs/agents/issue-tracker.md" ]; then
  die "docs/agents/issue-tracker.md is missing; run /rflow:setup first"
fi

base=$(base_branch)
if git rev-parse --quiet --verify "$base@{upstream}" >/dev/null; then
  git pull --quiet --ff-only >&2
fi

case "$mode" in
  branch)
    [[ "$target" =~ ^(feat|fix|docs|refactor|chore)/[a-z0-9]+(-[a-z0-9]+)*$ ]] \
      || die "branch '$target' must match <feat|fix|docs|refactor|chore>/<kebab-case-topic>"
    git show-ref --verify --quiet "refs/heads/$target" && die "branch $target already exists"
    path=$(worktree_path "$target")
    [ ! -e "$path" ] || die "$path already exists"
    git worktree add --quiet -b "$target" "$path" "$base" >&2
    ;;
  pr)
    number=$(gh pr view "$target" --json number --jq .number)
    path=$(worktree_path "pr-$number")
    [ ! -e "$path" ] || die "$path already exists"
    gh pr checkout "$number" --detach --worktree "$path" >&2
    ;;
esac

echo "$path"
