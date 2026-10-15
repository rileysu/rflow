#!/usr/bin/env bash
# Usage: context.sh
#
# Prints the base branch and the main checkout path as key=value lines. Runs from
# any directory of the repo.

set -euo pipefail
source "$(dirname "$0")/lib.sh"

echo "base=$(base_branch)"
echo "main_checkout=$(main_checkout)"
