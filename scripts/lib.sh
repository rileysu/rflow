# Shared helpers for the rflow worktree scripts. Source this file, do not run it.

set -euo pipefail

die() {
  echo "rflow: $*" >&2
  exit 1
}

# Absolute path of the main checkout, from the main checkout or any linked worktree.
main_checkout() {
  local common
  common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || die "not inside a git repository"
  dirname "$common"
}

in_linked_worktree() {
  [ "$(git rev-parse --path-format=absolute --git-dir)" != "$(git rev-parse --path-format=absolute --git-common-dir)" ]
}

# ../.worktrees/<repo>-<branch>, with "/" in the branch name converted to "-".
worktree_path() {
  local main
  main=$(main_checkout)
  echo "$(dirname "$main")/.worktrees/$(basename "$main")-${1//\//-}"
}

# The ref new branches start from: origin's default branch after a fetch, or the
# main checkout's branch when the repo has no origin.
base_ref() {
  if git remote get-url origin >/dev/null 2>&1; then
    git fetch --quiet origin
    git symbolic-ref --quiet refs/remotes/origin/HEAD >/dev/null || git remote set-head origin --auto >/dev/null
    git symbolic-ref --short refs/remotes/origin/HEAD
  else
    git -C "$(main_checkout)" rev-parse --abbrev-ref HEAD
  fi
}
