#!/usr/bin/env bash
# Usage:
#   open-worktree.sh [--no-tracker] <type>/<topic>   new branch from the base ref
#   open-worktree.sh --pr <number|url>               existing pull request head
#
# Creates the worktree at ../.worktrees/<repo>-<branch> and prints its absolute
# path on stdout. Refuses to run inside a linked worktree, and without
# docs/agents/issue-tracker.md unless --no-tracker is given.

source "$(dirname "$0")/lib.sh"

usage() { die "usage: open-worktree.sh [--no-tracker] <type>/<topic> | --pr <number|url>"; }

require_tracker=true
pr=""
branch=""
while [ $# -gt 0 ]; do
  case "$1" in
    --no-tracker) require_tracker=false ;;
    --pr) shift; pr="${1:-}"; [ -n "$pr" ] || usage ;;
    -*) usage ;;
    *) [ -z "$branch" ] || usage; branch="$1" ;;
  esac
  shift
done
[ -n "$pr$branch" ] || usage
[ -z "$pr" ] || [ -z "$branch" ] || usage

in_linked_worktree && die "already inside a worktree; start rflow flows from the main checkout"
main=$(main_checkout)
if $require_tracker && [ ! -f "$main/docs/agents/issue-tracker.md" ]; then
  die "docs/agents/issue-tracker.md is missing; run /rflow:setup first"
fi

if [ -n "$pr" ]; then
  branch=$(gh pr view "$pr" --json headRefName --jq .headRefName)
else
  [[ "$branch" =~ ^(feat|fix|docs|refactor|chore)/[a-z0-9]+(-[a-z0-9]+)*$ ]] \
    || die "branch '$branch' must match <feat|fix|docs|refactor|chore>/<kebab-case-topic>"
fi

path=$(worktree_path "$branch")
[ ! -e "$path" ] || die "$path already exists"
base=$(base_ref)

if [ -n "$pr" ]; then
  git worktree add --quiet --detach "$path" "$base" >&2
  (cd "$path" && gh pr checkout "$pr" >&2)
else
  git show-ref --verify --quiet "refs/heads/$branch" && die "branch $branch already exists"
  git worktree add --quiet --no-track -b "$branch" "$path" "$base" >&2
fi

echo "$path"
