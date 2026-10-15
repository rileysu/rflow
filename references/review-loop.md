# Review loop

The quality gate shared by `rflow:implement-ticket` and `rflow:implement-spec`. It runs on the committed branch, before `rflow:finish` ships it, with the `base` branch and the `ref` lines that `rflow status` printed.

1. Call the Skill tool with `mattpocock-skills:code-review`, using `<base>` as the fixed point and the `ref` lines as spec sources. Tell both of its review sub-agents to review the diff themselves, without calling skills or starting agents of their own.

2. Sort the findings. A finding is **blocking** when it cites a rule from one of the repo's documented standards, or quotes a spec line the diff misses, gets wrong or meets only in part. Baseline smells are judgement calls, so fix the cheap and plainly right ones and leave the rest in the report.

3. Fix every blocking finding, run the full test suite, and commit the fixes.

4. Run the next round from step 1. Done when a round reports nothing blocking. When the third round still reports blocking findings, show them to the user and ask how to proceed.
