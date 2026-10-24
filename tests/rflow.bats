#!/usr/bin/env bats
# shellcheck disable=SC2030,SC2031,SC2164 # bats runs each test in a subshell under set -e
# Tests for scripts/rflow in throwaway repos, each with a bare remote and a fake gh.

setup() {
  export GIT_CONFIG_GLOBAL=$BATS_TEST_TMPDIR/gitconfig GIT_CONFIG_NOSYSTEM=1
  git config --global user.name rflow-test
  git config --global user.email test@example.com
  git config --global init.defaultBranch main
  WS=$BATS_TEST_TMPDIR/ws # parent of the main checkout; worktrees land in $WS/.worktrees
  new_repo "$WS"
  cd "$MAIN"
  # Fake gh. `pr view` answers $GH_PR_JSON and `issue view` $GH_ISSUE_JSON through --jq.
  # `pr checks` reports "no checks" for the first $GH_NO_CHECKS calls, then passes, or fails
  # when $GH_CHECKS is "fail". `issue comment` and `issue close` only log their calls.
  # `api` logs its call and answers $GH_API_JSON, one JSON array per page, through --jq.
  # `label list` answers $GH_LABELS_JSON through --jq, and `label create` logs its call.
  mkdir -p "$BATS_TEST_TMPDIR/bin"
  cat >"$BATS_TEST_TMPDIR/bin/gh" <<'EOF'
#!/usr/bin/env bash
case "$1 $2" in
  "pr view")
    q=.; while [ $# -gt 0 ]; do [ "$1" = --jq ] && q=$2; shift; done
    jq -r "$q" <<<"$GH_PR_JSON" ;;
  "issue view")
    q=.; while [ $# -gt 0 ]; do [ "$1" = --jq ] && q=$2; shift; done
    jq -r "$q" <<<"$GH_ISSUE_JSON" ;;
  "issue comment" | "issue close")
    echo "$*" >>"$BATS_TEST_TMPDIR/gh-calls" ;;
  "pr checks")
    echo "$*" >>"$BATS_TEST_TMPDIR/gh-calls"
    calls=$(wc -l <"$BATS_TEST_TMPDIR/gh-calls")
    if [ "$calls" -le "${GH_NO_CHECKS:-0}" ]; then
      echo "no checks reported on the 'feat/x' branch" >&2; exit 1
    fi
    if [ "${GH_CHECKS:-pass}" = fail ]; then echo "test	fail"; exit 1; fi
    echo "test	pass" ;;
  "api "*)
    echo "$*" >>"$BATS_TEST_TMPDIR/gh-calls"
    q=.; while [ $# -gt 0 ]; do [ "$1" = --jq ] && q=$2; shift; done
    jq -r "$q" <<<"$GH_API_JSON" ;;
  "label list")
    q=.; while [ $# -gt 0 ]; do [ "$1" = --jq ] && q=$2; shift; done
    jq -r "$q" <<<"${GH_LABELS_JSON:-[]}" ;;
  "label create") echo "$*" >>"$BATS_TEST_TMPDIR/gh-calls" ;;
  *) echo "gh stub: unhandled $*" >&2; exit 1 ;;
esac
EOF
  chmod +x "$BATS_TEST_TMPDIR/bin/gh"
  export GH_ISSUE_JSON='{"number":12,"state":"OPEN"}'
  PATH=$BATS_TEST_DIRNAME/../scripts:$BATS_TEST_TMPDIR/bin:$PATH
  TEMPLATE=$BATS_TEST_DIRNAME/../skills/setup/settings.json
}

# new_repo <parent>: a bare remote and a main checkout "proj" with a tracker file, pushed like a clone.
new_repo() {
  REMOTE=$1/remote.git MAIN=$1/proj
  git init -q --bare "$REMOTE"
  git init -q "$MAIN"
  mkdir -p "$MAIN/docs/agents"
  echo github >"$MAIN/docs/agents/issue-tracker.md"
  git -C "$MAIN" add -A
  git -C "$MAIN" commit -qm init
  git -C "$MAIN" remote add origin "$REMOTE"
  git -C "$MAIN" push -q -u origin main
  git -C "$MAIN" remote set-head origin --auto >/dev/null
}

commit() { echo "$2" >"$1/$2" && git -C "$1" add "$2" && git -C "$1" commit -qm "$2" "${@:3}"; }
remote_commit() { # another clone pushes a commit to main
  [ -d "$WS/other" ] || git clone -q "$REMOTE" "$WS/other"
  commit "$WS/other" "$1" && git -C "$WS/other" push -q
}
has() { [[ $output == *"$1"* ]] || {
  echo "output lacks '$1':"$'\n'"$output" >&2
  return 1
}; }
change() { # one commit in the current repo that appends a line to each named file
  local f
  for f; do echo x >>"$f"; done
  git add -A && git commit -qm "change $*"
}
branch_exists() { git -C "$MAIN" show-ref --verify --quiet "refs/heads/$1"; }
no_branch() { ! branch_exists "$1"; }

# A fork's commit, published on the remote only as refs/pull/7/head, as GitHub does.
fork_pr() {
  git clone -q "$REMOTE" "$WS/fork"
  commit "$WS/fork" fork.txt
  git -C "$WS/fork" push -q origin HEAD:refs/pull/7/head
  FORK_SHA=$(git -C "$WS/fork" rev-parse HEAD)
  export GH_PR_JSON='{"number":7}'
}

# A same-repo pull request #8 from feat/x, pushed to origin by another clone. gh reports
# state $1 (OPEN by default) and cross-repository flag $2 (false by default).
head_pr() {
  git clone -q "$REMOTE" "$WS/other"
  git -C "$WS/other" checkout -q -b feat/x
  commit "$WS/other" pr.txt
  git -C "$WS/other" push -q origin feat/x
  HEAD_SHA=$(git -C "$WS/other" rev-parse HEAD)
  export GH_PR_JSON="{\"number\":8,\"headRefName\":\"feat/x\",\"baseRefName\":\"${3:-main}\",\"state\":\"${1:-OPEN}\",\"isCrossRepository\":${2:-false}}"
}

@test "bad usage is refused" {
  # shellcheck disable=SC2086 # word splitting of $args is the point
  for args in "" "tag" "sync x" "open" "open feat" "open --no-tracker feat" "open pr" "open pr 1 2" "open head" "open head 1 2" "reopen" "reopen a b" \
    "status x" "checks x" "docs x" "settings" "settings a b" "labels x" "close" "close a b" "close pr" \
    "resolve" "resolve 1" "resolve 1 a b" "resolve --not-planned 1" "resolve --not-planned 1 a b" \
    "hotspots x" "hotspots 0" "hotspots 5 -1" "hotspots 1 2 3" "frontier" "frontier 1 2"; do
    run rflow $args
    [ "$status" -eq 1 ]
    has "usage:"
    has "hotspots [commits] [count]"
    has "open head <number|url>"
    has "open [--no-tracker] <feat|fix|docs|chore|prototype> <title...>"
    has "reopen <branch>"
    has "resolve [--not-planned] <issue> <file>"
    has "frontier <parent>"
    has "| labels |"
  done
}

@test "sync pulls before checking for the tracker, so a merged setup counts" {
  git rm -q docs/agents/issue-tracker.md
  git commit -qm rm
  git push -q
  run rflow sync
  [ "$status" -eq 1 ]
  has "run /rflow:setup first"
  git clone -q "$REMOTE" "$WS/other"
  mkdir -p "$WS/other/docs/agents"
  commit "$WS/other/docs/agents" issue-tracker.md
  git -C "$WS/other" push -q
  run rflow sync
  [ "$status" -eq 0 ]
}

@test "sync refuses a main checkout off the default branch" {
  git checkout -q -b feat/other
  run rflow sync
  [ "$status" -eq 1 ]
  has "check out main first"
}

@test "sync outside a repo fails" {
  mkdir "$BATS_TEST_TMPDIR/norepo"
  cd "$BATS_TEST_TMPDIR/norepo"
  run rflow sync
  [ "$status" -eq 1 ]
  has "not inside a git repository"
}

@test "open names the branch from a slug of the title's first five words" {
  run rflow open feat 'Add Dark-Mode toggle!! to the settings page'
  [ "$status" -eq 0 ]
  [ "$output" = "$WS/.worktrees/proj-feat-add-dark-mode-toggle-to" ]
  branch_exists feat/add-dark-mode-toggle-to
}

@test "open keeps digits, so an audit titled by scope or date names docs/audit-<scope> or docs/audit-<date>" {
  run rflow open docs 'audit scripts rflow'
  [ "$status" -eq 0 ]
  branch_exists docs/audit-scripts-rflow
  run rflow open docs 'audit 2026 10 17'
  [ "$status" -eq 0 ]
  [ "$output" = "$WS/.worktrees/proj-docs-audit-2026-10-17" ]
  branch_exists docs/audit-2026-10-17
}

@test "open names a prototype branch prototype/<slug>" {
  run rflow open prototype 'Map layout'
  [ "$status" -eq 0 ]
  [ "$output" = "$WS/.worktrees/proj-prototype-map-layout" ]
  branch_exists prototype/map-layout
}

@test "open refuses an unknown type or a title with no letters before pulling" {
  remote_commit r.txt
  before=$(git rev-parse main)
  run rflow open wip x
  [ "$status" -eq 1 ]
  has "type 'wip' is not one of feat|fix|docs|chore|prototype"
  run rflow open feat '!!!'
  [ "$status" -eq 1 ]
  has "no letters or digits"
  [ "$(git rev-parse main)" = "$before" ]
}

@test "open starts the branch from the fast-forwarded base" {
  remote_commit r.txt
  wt=$(rflow open feat x)
  [ "$(git -C "$wt" rev-parse HEAD)" = "$(git -C "$WS/other" rev-parse HEAD)" ]
}

@test "open requires the tracker unless told otherwise" {
  git rm -q docs/agents/issue-tracker.md
  git commit -qm rm
  run rflow open docs x
  [ "$status" -eq 1 ]
  has "run /rflow:setup first"
  run rflow open --no-tracker chore rflow setup
  [ "$status" -eq 0 ]
  branch_exists chore/rflow-setup
}

@test "open refuses to run from a worktree" {
  wt=$(rflow open feat x)
  cd "$wt"
  run rflow open feat y
  [ "$status" -eq 1 ]
  has "from the main checkout at $MAIN"
  no_branch feat/y
}

@test "open refuses a branch that exists on origin, naming reopen" {
  git push -q origin main:feat/x
  run rflow open feat x
  [ "$status" -eq 1 ]
  has "branch feat/x already exists on origin; resume it with rflow reopen feat/x"
  no_branch feat/x
}

@test "open refuses a branch that exists locally, naming reopen" {
  git branch feat/x
  run rflow open feat x
  [ "$status" -eq 1 ]
  has "branch feat/x already exists; resume it with rflow reopen feat/x"
  [ ! -e "$WS/.worktrees/proj-feat-x" ]
}

@test "open refuses an unregistered directory in its way and leaves it alone" {
  mkdir -p "$WS/.worktrees/proj-feat-z"
  echo keep >"$WS/.worktrees/proj-feat-z/notes.txt"
  run rflow open feat z
  [ "$status" -eq 1 ]
  has "already exists"
  [ -f "$WS/.worktrees/proj-feat-z/notes.txt" ]
}

@test "open works without an origin remote" {
  git remote remove origin
  wt=$(rflow open feat x)
  [ -d "$wt" ]
}

@test "open works with spaces in the paths" {
  new_repo "$BATS_TEST_TMPDIR/with space/ws"
  cd "$MAIN"
  wt=$(rflow open feat x)
  [ "$wt" = "$BATS_TEST_TMPDIR/with space/ws/.worktrees/proj-feat-x" ]
  cd "$wt"
  run rflow status
  has "main_checkout=$MAIN"
}

@test "open pr checks out a fork's head detached, without the tracker" {
  fork_pr
  git rm -q docs/agents/issue-tracker.md
  git commit -qm rm
  run rflow open pr https://github.com/o/r/pull/7
  [ "$status" -eq 0 ]
  wt=$WS/.worktrees/proj-pr-7
  [ "$output" = "$wt" ]
  [ "$(git -C "$wt" rev-parse HEAD)" = "$FORK_SHA" ]
  [ -z "$(git -C "$wt" branch --show-current)" ]
}

@test "open pr reuses a path whose worktree was deleted" {
  fork_pr
  git worktree add -q --detach "$WS/.worktrees/proj-pr-7" HEAD
  rm -rf "$WS/.worktrees/proj-pr-7"
  run rflow open pr 7
  [ "$status" -eq 0 ]
}

@test "open head checks out a same-repo pull request's branch tracking origin" {
  head_pr
  run rflow open head https://github.com/o/r/pull/8
  [ "$status" -eq 0 ]
  wt=$WS/.worktrees/proj-feat-x
  [ "$output" = "$wt" ]
  [ "$(git -C "$wt" branch --show-current)" = feat/x ]
  [ "$(git -C "$wt" rev-parse HEAD)" = "$HEAD_SHA" ]
  [ "$(git -C "$wt" rev-parse --abbrev-ref '@{upstream}')" = origin/feat/x ]
}

@test "open head reuses the rflow worktree that holds the branch, caught up to origin" {
  head_pr
  git fetch -q origin feat/x
  wt=$WS/.worktrees/proj-feat-x
  git worktree add -q -b feat/x "$wt" FETCH_HEAD
  commit "$WS/other" pr2.txt && git -C "$WS/other" push -q origin feat/x # someone pushes to the pull request
  before=$(git worktree list --porcelain | grep -v '^HEAD ')
  run rflow open head 8
  [ "$status" -eq 0 ]
  [ "$output" = "$wt" ]
  [ "$(git -C "$wt" rev-parse HEAD)" = "$(git -C "$WS/other" rev-parse HEAD)" ]
  [ "$(git worktree list --porcelain | grep -v '^HEAD ')" = "$before" ]
}

@test "open head refuses an rflow worktree whose branch has diverged from origin" {
  head_pr
  git fetch -q origin feat/x
  wt=$WS/.worktrees/proj-feat-x
  git worktree add -q -b feat/x "$wt" FETCH_HEAD
  commit "$wt" unpushed.txt
  commit "$WS/other" pr2.txt && git -C "$WS/other" push -q origin feat/x
  run rflow open head 8
  [ "$status" -eq 1 ]
  has "feat/x has diverged from origin/feat/x"
}

@test "open head refuses a branch checked out outside rflow's worktrees" {
  head_pr
  git worktree add -q -b feat/x "$WS/elsewhere" HEAD
  run rflow open head 8
  [ "$status" -eq 1 ]
  has "feat/x is checked out at $WS/elsewhere, outside rflow's worktrees"
}

@test "open head adds the worktree on a local branch that has none, fast-forwarded to origin and tracking it" {
  head_pr
  git fetch -q origin feat/x
  git branch -q --no-track feat/x FETCH_HEAD
  commit "$WS/other" pr2.txt && git -C "$WS/other" push -q origin feat/x # the local branch falls behind
  run rflow open head 8
  [ "$status" -eq 0 ]
  wt=$WS/.worktrees/proj-feat-x
  [ "$output" = "$wt" ]
  [ "$(git -C "$wt" branch --show-current)" = feat/x ]
  [ "$(git -C "$wt" rev-parse HEAD)" = "$(git -C "$WS/other" rev-parse HEAD)" ]
  [ "$(git -C "$wt" rev-parse --abbrev-ref '@{upstream}')" = origin/feat/x ]
}

@test "open head keeps a local branch's unpushed commits" {
  head_pr
  git fetch -q origin feat/x
  git branch -q --no-track feat/x FETCH_HEAD
  git checkout -q feat/x && commit "$MAIN" unpushed.txt && git checkout -q main
  local_sha=$(git rev-parse feat/x)
  run rflow open head 8
  [ "$status" -eq 0 ]
  [ "$(git -C "$output" rev-parse HEAD)" = "$local_sha" ]
  [ "$(git -C "$output" rev-parse --abbrev-ref '@{upstream}')" = origin/feat/x ]
}

@test "open head refuses a local branch that has diverged from origin" {
  head_pr
  git fetch -q origin feat/x
  git branch -q --no-track feat/x FETCH_HEAD
  git checkout -q feat/x && commit "$MAIN" unpushed.txt && git checkout -q main
  commit "$WS/other" pr2.txt && git -C "$WS/other" push -q origin feat/x
  run rflow open head 8
  [ "$status" -eq 1 ]
  has "feat/x has diverged from origin/feat/x"
  [ ! -e "$WS/.worktrees/proj-feat-x" ]
}

@test "open head fast-forwards the default branch" {
  head_pr
  git -C "$WS/other" checkout -q main
  commit "$WS/other" r.txt && git -C "$WS/other" push -q
  run rflow open head 8
  [ "$status" -eq 0 ]
  [ "$(git rev-parse main)" = "$(git -C "$WS/other" rev-parse HEAD)" ]
}

@test "open head refuses a pull request that targets a branch other than the default" {
  head_pr OPEN false release
  run rflow open head 8
  [ "$status" -eq 1 ]
  has "#8 targets release, not main"
  no_branch feat/x
  [ ! -e "$WS/.worktrees/proj-feat-x" ]
}

@test "open head refuses a fork's pull request" {
  head_pr OPEN true
  run rflow open head 8
  [ "$status" -eq 1 ]
  has "#8 comes from a fork"
  no_branch feat/x
  [ ! -e "$WS/.worktrees/proj-feat-x" ]
}

@test "open head refuses a closed or a merged pull request" {
  head_pr CLOSED
  run rflow open head 8
  [ "$status" -eq 1 ]
  has "#8 is closed"
  export GH_PR_JSON=${GH_PR_JSON/CLOSED/MERGED}
  run rflow open head 8
  [ "$status" -eq 1 ]
  has "#8 is merged"
  no_branch feat/x
  [ ! -e "$WS/.worktrees/proj-feat-x" ]
}

@test "open head refuses a tracker doc that does not name GitHub" {
  head_pr
  echo "Issues live in Linear." >docs/agents/issue-tracker.md
  git commit -qam linear
  run rflow open head 8
  [ "$status" -eq 1 ]
  has "does not name GitHub"
  git rm -q docs/agents/issue-tracker.md
  git commit -qm rm
  run rflow open head 8
  [ "$status" -eq 1 ]
  has "does not name GitHub"
  no_branch feat/x
}

@test "open head refuses to run from a worktree or with the main checkout off the default branch" {
  head_pr
  cd "$(rflow open feat y)"
  run rflow open head 8
  [ "$status" -eq 1 ]
  has "from the main checkout at $MAIN"
  cd "$MAIN"
  git checkout -q -b feat/other
  run rflow open head 8
  [ "$status" -eq 1 ]
  has "check out main first"
  no_branch feat/x
}

@test "reopen prints the rflow worktree that already holds the branch" {
  wt=$(rflow open feat x)
  commit "$wt" unpushed.txt
  run rflow reopen feat/x
  [ "$status" -eq 0 ]
  [ "$output" = "$wt" ]
  [ -f "$wt/unpushed.txt" ]
}

@test "reopen refuses a branch checked out outside rflow's worktrees" {
  git worktree add -q -b feat/x "$WS/elsewhere" HEAD
  run rflow reopen feat/x
  [ "$status" -eq 1 ]
  has "feat/x is checked out at $WS/elsewhere, outside rflow's worktrees"
  run rflow reopen main
  [ "$status" -eq 1 ]
  has "main is checked out at $MAIN, outside rflow's worktrees"
}

@test "reopen adds a worktree on a local branch as it is, keeping its unpushed commits" {
  wt=$(rflow open feat x)
  commit "$wt" unpushed.txt
  local_sha=$(git -C "$wt" rev-parse HEAD)
  rm -rf "$wt" # as when a crashed session's worktree is lost
  run rflow reopen feat/x
  [ "$status" -eq 0 ]
  [ "$output" = "$wt" ]
  [ "$(git -C "$wt" branch --show-current)" = feat/x ]
  [ "$(git -C "$wt" rev-parse HEAD)" = "$local_sha" ]
}

@test "reopen adds a worktree tracking origin for a branch only on origin, fetching it first" {
  git clone -q "$REMOTE" "$WS/other"
  git -C "$WS/other" checkout -q -b prototype/x
  commit "$WS/other" proto.txt
  git -C "$WS/other" push -q origin prototype/x
  run rflow reopen prototype/x
  [ "$status" -eq 0 ]
  wt=$WS/.worktrees/proj-prototype-x
  [ "$output" = "$wt" ]
  [ "$(git -C "$wt" branch --show-current)" = prototype/x ]
  [ "$(git -C "$wt" rev-parse HEAD)" = "$(git -C "$WS/other" rev-parse HEAD)" ]
  [ "$(git -C "$wt" rev-parse --abbrev-ref '@{upstream}')" = origin/prototype/x ]
}

@test "reopen refuses a branch found nowhere, naming open" {
  run rflow reopen feat/x
  [ "$status" -eq 1 ]
  has "branch feat/x exists neither locally nor on origin; start it with rflow open"
  git remote remove origin
  run rflow reopen feat/x
  [ "$status" -eq 1 ]
  has "start it with rflow open"
  [ ! -e "$WS/.worktrees/proj-feat-x" ]
}

@test "reopen refuses an unregistered directory in its way and leaves it alone" {
  git branch feat/x
  mkdir -p "$WS/.worktrees/proj-feat-x"
  echo keep >"$WS/.worktrees/proj-feat-x/notes.txt"
  run rflow reopen feat/x
  [ "$status" -eq 1 ]
  has "already exists"
  [ -f "$WS/.worktrees/proj-feat-x/notes.txt" ]
}

@test "reopen refuses to run from a worktree" {
  wt=$(rflow open feat x)
  cd "$wt"
  run rflow reopen feat/x
  [ "$status" -eq 1 ]
  has "from the main checkout at $MAIN"
}

@test "status describes the worktree and its ticket and spec refs" {
  wt=$(rflow open feat x)
  commit "$wt" a.txt --trailer "Ticket: #42"
  commit "$wt" b.txt
  commit "$wt" c.txt --trailer "Ticket: #43" --trailer "Spec: #40"
  commit "$wt" d.txt --trailer "Ticket: #42"
  cd "$wt"
  run rflow status
  [ "$status" -eq 0 ]
  [ "$output" = "base=main
main_checkout=$MAIN
branch=feat/x
commits=4
ref=#40
ref=#42
ref=#43" ]
}

@test "status counts no commits on a branch with none beyond the base" {
  cd "$(rflow open feat x)"
  run rflow status
  [ "$status" -eq 0 ]
  has "commits=0"
}

@test "status fails outside an rflow worktree" {
  run rflow status
  [ "$status" -eq 1 ]
  has "not an rflow worktree"
  fork_pr
  cd "$(rflow open pr 7)"
  run rflow status
  [ "$status" -eq 1 ]
  has "detached HEAD"
}

@test "status fails when the main checkout is detached" {
  wt=$(rflow open feat x)
  git checkout -q --detach
  cd "$wt"
  run rflow status
  [ "$status" -eq 1 ]
  has "detached HEAD"
}

@test "settings merges the template into the worktree's settings, keeping their other keys" {
  mkdir .claude
  echo '{"model": "opus", "disableBundledSkills": false, "enabledPlugins": {"other@x": true}}' >.claude/settings.json
  git add .claude
  git commit -qm settings
  wt=$(rflow open chore x)
  cd "$wt"
  run rflow settings "$TEMPLATE"
  [ "$status" -eq 0 ]
  [ "$output" = "$(cat "$wt/.claude/settings.json")" ]
  jq -e '.model == "opus" and .disableBundledSkills and .enabledPlugins == {"other@x": true, "rflow@rflow": true}' \
    "$wt/.claude/settings.json"
}

@test "settings unions arrays, keeping the file's entries in order and adding only the template's new ones" {
  wt=$(rflow open chore x)
  mkdir "$wt/.claude"
  echo '{"permissions": {"allow": ["Bash(npm test)", "WebSearch"], "deny": ["Read(.env)"]}}' >"$wt/.claude/settings.json"
  cd "$wt"
  run rflow settings "$TEMPLATE"
  [ "$status" -eq 0 ]
  [ "$(jq -c .permissions "$wt/.claude/settings.json")" = \
    '{"allow":["Bash(npm test)","WebSearch","WebFetch","Edit(//tmp/rflow/**)","Read(//tmp/rflow/**)","Bash(gh issue view *)"],"deny":["Read(.env)"]}' ]
}

@test "the settings template allows research subagents' tools and nothing that writes to GitHub or names the script" {
  [ "$(jq -c .permissions.allow "$TEMPLATE")" = \
    '["WebSearch","WebFetch","Edit(//tmp/rflow/**)","Read(//tmp/rflow/**)","Bash(gh issue view *)"]' ]
}

@test "settings writes the template at the worktree root over a missing or empty file" {
  wt=$(rflow open chore x)
  mkdir "$wt/sub"
  cd "$wt/sub"
  run rflow settings "$TEMPLATE"
  [ "$status" -eq 0 ]
  [ "$(jq -S . "$wt/.claude/settings.json")" = "$(jq -S . "$TEMPLATE")" ]
  : >"$wt/.claude/settings.json"
  run rflow settings "$TEMPLATE"
  [ "$status" -eq 0 ]
  [ "$(jq -S . "$wt/.claude/settings.json")" = "$(jq -S . "$TEMPLATE")" ]
  [ ! -e "$wt/sub/.claude" ]
}

@test "settings leaves a file it cannot merge as it was" {
  wt=$(rflow open chore x)
  mkdir "$wt/.claude"
  echo '{"model": "opus",}' >"$wt/.claude/settings.json"
  cp "$wt/.claude/settings.json" "$BATS_TEST_TMPDIR/before"
  cd "$wt"
  run rflow settings "$TEMPLATE"
  [ "$status" -eq 1 ]
  has "left as it was"
  cmp "$wt/.claude/settings.json" "$BATS_TEST_TMPDIR/before"
  [ ! -e "$wt/.claude/settings.json.tmp" ]
}

@test "settings fails without jq before writing anything" {
  wt=$(rflow open chore x)
  cd "$wt"
  run env PATH="$BATS_TEST_TMPDIR/nothing" "$BASH" "$BATS_TEST_DIRNAME/../scripts/rflow" settings "$TEMPLATE"
  [ "$status" -eq 1 ]
  has "needs jq"
  [ ! -e "$wt/.claude" ]
}

@test "settings refuses to write outside an rflow worktree" {
  run rflow settings "$TEMPLATE"
  [ "$status" -eq 1 ]
  has "not an rflow worktree"
  [ ! -e "$MAIN/.claude" ]
}

@test "docs refuses to write outside an rflow worktree" {
  run rflow docs
  [ "$status" -eq 1 ]
  has "not an rflow worktree"
  [ ! -e "$MAIN/docs/research" ]
  [ ! -e "$MAIN/docs/adr" ]
  [ ! -e "$MAIN/docs/misc" ]
}

@test "docs creates research, adr and misc each with a one-line README" {
  wt=$(rflow open chore x)
  cd "$wt"
  run rflow docs
  [ "$status" -eq 0 ]
  [ "$output" = "created docs/research/README.md
created docs/adr/README.md
created docs/misc/README.md" ]
  [ "$(sed -n '1p' "$wt/docs/research/README.md")" = "# Research notes" ]
  [ "$(sed -n '3p' "$wt/docs/adr/README.md")" = "Architecture decision records, one per file, named NNNN-slug.md. The domain-modeling flow creates them here." ]
  [ "$(sed -n '3p' "$wt/docs/misc/README.md")" = "Documents that fit nowhere else in docs/." ]
  [ "$(wc -l <"$wt/docs/research/README.md")" -eq 3 ] # a header line, a blank line, a body line
}

@test "docs keeps files that already exist and only fills the gaps" {
  wt=$(rflow open chore x)
  mkdir -p "$wt/docs/research"
  printf 'mine\n' >"$wt/docs/research/README.md"
  git -C "$wt" add docs && git -C "$wt" commit -qm readme
  cd "$wt"
  run rflow docs
  [ "$status" -eq 0 ]
  [ "$output" = "created docs/adr/README.md
created docs/misc/README.md" ]
  cmp "$wt/docs/research/README.md" <(printf 'mine\n')
}

@test "labels creates only the labels rflow applies that the repo lacks" {
  export GH_LABELS_JSON='[{"name":"bug","color":"ff0000"},{"name":"wayfinder:map"},{"name":"question"}]'
  run rflow labels
  [ "$status" -eq 0 ]
  [ "$output" = "created wayfinder:research
created wayfinder:prototype
created wayfinder:grilling
created wayfinder:task
created enhancement
created ready-for-agent" ]
  [ "$(cat "$BATS_TEST_TMPDIR/gh-calls")" = "label create wayfinder:research
label create wayfinder:prototype
label create wayfinder:grilling
label create wayfinder:task
label create enhancement
label create ready-for-agent" ]
}

@test "labels refuses a tracker doc that does not name GitHub" {
  echo "Issues live in Linear." >docs/agents/issue-tracker.md
  run rflow labels
  [ "$status" -eq 1 ]
  has "does not name GitHub"
  rm docs/agents/issue-tracker.md
  run rflow labels
  [ "$status" -eq 1 ]
  has "does not name GitHub"
  [ ! -e "$BATS_TEST_TMPDIR/gh-calls" ]
}

@test "labels reads the tracker doc that setup wrote in its worktree" {
  git rm -q docs/agents/issue-tracker.md
  git commit -qm rm
  wt=$(rflow open --no-tracker chore rflow setup)
  mkdir -p "$wt/docs/agents"
  echo "GitHub issues" >"$wt/docs/agents/issue-tracker.md"
  cd "$wt"
  run rflow labels
  [ "$status" -eq 0 ]
  has "created ready-for-agent"
}

@test "checks asks again while CI has not registered its runs" {
  export RFLOW_CHECKS_WAIT=0 GH_NO_CHECKS=2
  run rflow checks
  [ "$status" -eq 0 ]
  has "pass"
  [ "$(wc -l <"$BATS_TEST_TMPDIR/gh-calls")" -eq 3 ]
}

@test "checks fails when a check fails" {
  export RFLOW_CHECKS_WAIT=0 GH_CHECKS=fail
  run rflow checks
  [ "$status" -eq 1 ]
  has "fail"
  grep -q -- --watch "$BATS_TEST_TMPDIR/gh-calls"
}

@test "checks passes a branch that never reports checks" {
  export RFLOW_CHECKS_WAIT=0 GH_NO_CHECKS=99
  run rflow checks
  [ "$status" -eq 0 ]
  has "nothing to wait for"
}

@test "resolve posts the file as a comment, then closes the issue as completed" {
  echo "Decided: yes." >"$BATS_TEST_TMPDIR/note.md"
  run rflow resolve 12 "$BATS_TEST_TMPDIR/note.md"
  [ "$status" -eq 0 ]
  [ "$(cat "$BATS_TEST_TMPDIR/gh-calls")" = "issue comment 12 --body-file $BATS_TEST_TMPDIR/note.md
issue close 12 --reason completed" ]
}

@test "resolve --not-planned closes the issue as not planned" {
  echo "Past the destination." >"$BATS_TEST_TMPDIR/note.md"
  run rflow resolve --not-planned 12 "$BATS_TEST_TMPDIR/note.md"
  [ "$status" -eq 0 ]
  [ "$(tail -n 1 "$BATS_TEST_TMPDIR/gh-calls")" = "issue close 12 --reason not planned" ]
}

@test "resolve refuses a missing or empty file before calling gh" {
  run rflow resolve 12 "$BATS_TEST_TMPDIR/none.md"
  [ "$status" -eq 1 ]
  has "none.md is missing or empty"
  : >"$BATS_TEST_TMPDIR/empty.md"
  run rflow resolve --not-planned 12 "$BATS_TEST_TMPDIR/empty.md"
  [ "$status" -eq 1 ]
  has "empty.md is missing or empty"
  [ ! -e "$BATS_TEST_TMPDIR/gh-calls" ]
}

@test "resolve refuses an issue that is already closed" {
  echo "Decided: yes." >"$BATS_TEST_TMPDIR/note.md"
  export GH_ISSUE_JSON='{"number":12,"state":"CLOSED"}'
  run rflow resolve 12 "$BATS_TEST_TMPDIR/note.md"
  [ "$status" -eq 1 ]
  has "issue #12 is already closed"
  [ ! -e "$BATS_TEST_TMPDIR/gh-calls" ]
}

@test "resolve refuses a tracker doc that does not name GitHub, or no tracker doc" {
  echo "Decided: yes." >"$BATS_TEST_TMPDIR/note.md"
  echo "Issues live in Linear." >docs/agents/issue-tracker.md
  run rflow resolve 12 "$BATS_TEST_TMPDIR/note.md"
  [ "$status" -eq 1 ]
  has "does not name GitHub"
  rm docs/agents/issue-tracker.md
  run rflow resolve 12 "$BATS_TEST_TMPDIR/note.md"
  [ "$status" -eq 1 ]
  has "does not name GitHub"
  [ ! -e "$BATS_TEST_TMPDIR/gh-calls" ]
}

@test "resolve reads the main checkout's tracker doc from a worktree" {
  echo "Decided: yes." >"$BATS_TEST_TMPDIR/note.md"
  cd "$(rflow open docs notes)"
  rm docs/agents/issue-tracker.md
  run rflow resolve 12 "$BATS_TEST_TMPDIR/note.md"
  [ "$status" -eq 0 ]
  [ "$(wc -l <"$BATS_TEST_TMPDIR/gh-calls")" -eq 2 ]
}

# child <number> <state> <open blockers> <assignees> [label...]: one sub-issue as GitHub's REST API lists it.
child() {
  jq -nc --argjson n "$1" --arg s "$2" --argjson b "$3" --argjson a "$4" '$ARGS.positional as $l |
    {number: $n, state: $s, issue_dependencies_summary: {blocked_by: $b},
     assignees: [range($a) | {login: "u\(.)"}], labels: [$l[] | {name: .}]}' --args "${@:5}"
}

@test "frontier prints the open count, then each open child's number and type in sub-issue order across pages" {
  GH_API_JSON="[$(child 31 open 0 0 wayfinder:grilling),$(child 25 open 0 0 bug wayfinder:research)]
[$(child 28 open 0 0 wayfinder:task)]"
  export GH_API_JSON
  run rflow frontier 22
  [ "$status" -eq 0 ]
  [ "$output" = "open=3
31 grilling
25 research
28 task" ]
  grep -q -- "--paginate" "$BATS_TEST_TMPDIR/gh-calls"
  grep -q "repos/{owner}/{repo}/issues/22/sub_issues" "$BATS_TEST_TMPDIR/gh-calls"
}

@test "frontier leaves out closed, blocked and assigned children, still counting the open ones" {
  GH_API_JSON="[$(child 23 closed 0 0 wayfinder:task),$(child 24 open 1 0 wayfinder:research),$(child 25 open 0 1 wayfinder:grilling),$(child 26 open 0 0 wayfinder:prototype)]"
  export GH_API_JSON
  run rflow frontier 22
  [ "$status" -eq 0 ]
  [ "$output" = "open=3
26 prototype" ]
}

@test "frontier prints - as the type of a child without a wayfinder label" {
  GH_API_JSON="[$(child 27 open 0 0 bug ready-for-agent),$(child 28 open 0 0)]"
  export GH_API_JSON
  run rflow frontier 22
  [ "$status" -eq 0 ]
  [ "$output" = "open=2
27 -
28 -" ]
}

@test "frontier prints open=0 and no lines for a parent with no open children" {
  for json in "[$(child 23 closed 0 0 wayfinder:task)]" "[]"; do
    export GH_API_JSON=$json
    run rflow frontier 22
    [ "$status" -eq 0 ]
    [ "$output" = "open=0" ]
  done
}

@test "frontier prints no count when gh fails, so a failed call never reads as a finished map" {
  export GH_API_JSON='not json'
  run rflow frontier 22
  [ "$status" -ne 0 ]
  [[ $output != *open=* ]]
}

@test "frontier takes only an issue number" {
  run rflow frontier '#22'
  [ "$status" -eq 1 ]
  has "frontier takes a parent issue number"
}

@test "close keeps a branch with commits on neither the base nor its upstream" {
  wt=$(rflow open feat x)
  commit "$wt" w.txt
  run rflow close feat/x
  [ "$status" -eq 1 ]
  has "kept its worktree and branch"
  [ -d "$wt" ]
  git -C "$wt" push -q -u origin feat/x
  commit "$wt" w2.txt
  run rflow close feat/x
  [ "$status" -eq 1 ]
  git push -q origin --delete feat/x # as when a squash merge deletes the upstream
  run rflow close feat/x
  [ "$status" -eq 1 ]
  [ -d "$wt" ]
  branch_exists feat/x
}

@test "close removes an unpushed branch with no commits, as finish does at commits=0" {
  wt=$(rflow open docs x)
  run rflow close docs/x
  [ "$status" -eq 0 ]
  [ ! -e "$wt" ]
  no_branch docs/x
}

@test "close removes a pushed branch" {
  wt=$(rflow open feat x)
  commit "$wt" w.txt
  git -C "$wt" push -q -u origin feat/x
  run rflow close feat/x
  [ "$status" -eq 0 ]
  [ ! -e "$wt" ]
  no_branch feat/x
}

@test "close removes a locally merged branch from inside its worktree, even when its upstream is behind" {
  wt=$(rflow open feat x)
  commit "$wt" 1.txt
  git -C "$wt" push -q -u origin feat/x
  commit "$wt" 2.txt
  git merge -q --no-ff feat/x -m merge
  cd "$wt"
  run rflow close feat/x
  [ "$status" -eq 0 ]
  [ ! -e "$wt" ]
  no_branch feat/x
}

@test "close refuses a worktree with uncommitted files" {
  wt=$(rflow open feat x)
  echo u >"$wt/untracked.txt"
  run rflow close feat/x
  [ "$status" -ne 0 ]
  [ -d "$wt" ]
  branch_exists feat/x
}

@test "close deletes a branch whose worktree directory is gone" {
  wt=$(rflow open feat x)
  rm -rf "$wt"
  run rflow close feat/x
  [ "$status" -eq 0 ]
  no_branch feat/x
}

@test "close finds the worktree by branch, not by a path that another branch shares" {
  wt=$(rflow open feat x)
  git branch feat-x
  run rflow close feat-x
  [ "$status" -eq 0 ]
  [ -d "$wt" ]
  branch_exists feat/x
}

@test "close pr removes the pull request's worktree and takes only a number" {
  git worktree add -q --detach "$WS/.worktrees/proj-pr-7" HEAD
  run rflow close pr https://github.com/o/r/pull/7
  [ "$status" -eq 1 ]
  has "takes a pull request number"
  run rflow close pr 7
  [ "$status" -eq 0 ]
  [ ! -e "$WS/.worktrees/proj-pr-7" ]
}

@test "hotspots prints the most changed files first, ties in path order" {
  change a b c
  change b c
  change c
  run rflow hotspots
  [ "$status" -eq 0 ]
  [ "$output" = $'c\nb\na\ndocs/agents/issue-tracker.md' ]
}

@test "hotspots looks at the last 100 commits and prints at most 20 files by default" {
  change aold # would sort first among ties if the window took 101 commits
  for i in $(seq 1 25); do change "f$i"; done
  for _ in $(seq 1 75); do change f1; done
  run rflow hotspots
  [ "$status" -eq 0 ]
  [ "${#lines[@]}" -eq 20 ]
  [ "${lines[0]}" = f1 ]
  [[ $output != *aold* ]]
}

@test "hotspots takes the commit window and the file count as arguments" {
  change a
  change b
  change c
  change c
  run rflow hotspots 3
  [ "$status" -eq 0 ]
  [ "$output" = $'c\nb' ]
  run rflow hotspots 3 1
  [ "$status" -eq 0 ]
  [ "$output" = c ]
}

@test "hotspots uses the whole history when it is shorter than the window" {
  change a
  run rflow hotspots 5
  [ "$status" -eq 0 ]
  [ "$output" = $'a\ndocs/agents/issue-tracker.md' ]
}

@test "hotspots leaves out files deleted or renamed since they changed" {
  change gone moved b
  change gone moved
  git rm -q gone
  git mv moved renamed
  git commit -qm "delete gone, rename moved"
  run rflow hotspots
  [ "$status" -eq 0 ]
  [ "$output" = $'b\ndocs/agents/issue-tracker.md\nrenamed' ]
}

@test "hotspots prints paths from the repo root when run in a subdirectory" {
  change a
  cd docs/agents
  run rflow hotspots
  [ "$status" -eq 0 ]
  [ "$output" = $'a\ndocs/agents/issue-tracker.md' ]
}

@test "hotspots outside a repo fails" {
  mkdir "$BATS_TEST_TMPDIR/norepo"
  cd "$BATS_TEST_TMPDIR/norepo"
  run rflow hotspots
  [ "$status" -eq 1 ]
  has "rflow: not inside a git repository"
}

@test "hotspots in a repo with no commits fails" {
  git init -q "$BATS_TEST_TMPDIR/empty"
  cd "$BATS_TEST_TMPDIR/empty"
  run rflow hotspots
  [ "$status" -eq 1 ]
  has "rflow: no commits yet"
}
