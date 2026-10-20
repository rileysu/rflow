# Review loop

The quality gate shared by `rflow:implement-ticket`, `rflow:implement-spec` and `rflow:tweak-pr`. It runs on the committed branch, before `rflow:finish` ships it, with the `base` branch and the `ref` lines that `rflow status` printed.

1. Call the Skill tool with `mattpocock-skills:code-review`, using `<base>` as the fixed point and the `ref` lines as spec sources. Tell both of its review sub-agents to review the diff themselves, without calling skills or starting agents of their own.

2. Sort the findings. A finding is **blocking** when the Standards report marks it a hard violation of a documented standard, or the Spec report quotes a spec line the diff misses, gets wrong or meets only in part. Baseline smells are judgement calls, so fix the cheap and plainly right ones and leave the rest in the report.

3. Done when nothing blocks. When this is the third round, show the blocking findings to the user and ask how to proceed.

4. Fix every blocking finding, run the full test suite, commit the fixes, and start the next round from step 1.
