# Shared helpers for the rflow scripts, loaded with `source`.

die() {
  echo "rflow: $*" >&2
  exit 1
}

# Absolute path of the main checkout, from the main checkout or any linked worktree.
main_checkout() {
  local common_dir
  common_dir=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || die "not inside a git repository"
  dirname "$common_dir"
}

# The branch the main checkout sits on. Every rflow branch starts from it and merges into it.
base_branch() {
  local branch
  branch=$(git -C "$(main_checkout)" branch --show-current)
  [ -n "$branch" ] || die "the main checkout has a detached HEAD; check out the default branch first"
  echo "$branch"
}

# ../.worktrees/<repo>-<name>, with "/" in the name converted to "-".
worktree_path() {
  local main_path
  main_path=$(main_checkout)
  echo "$(dirname "$main_path")/.worktrees/$(basename "$main_path")-${1//\//-}"
}
