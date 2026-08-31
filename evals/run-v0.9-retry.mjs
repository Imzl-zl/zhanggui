// GENERATED - v0.9 retry (4 unscored cases, judge model identical to v0.8)
const CASES = [{"id":"root-implicit-security-01","prompt":"\u7aef\u5230\u7aef\u5b8c\u6210\u8fd9\u9879\u591a\u6a21\u5757\u5b89\u5168\u6539\u9020\uff1a\u9694\u79bb\u5de5\u4f5c\u533a\u3001\u8bbe\u8ba1\u3001\u5b9e\u73b0\u3001\u72ec\u7acb\u5ba1\u67e5\u548c\u9a8c\u8bc1\u90fd\u7eb3\u5165\u540c\u4e00\u6d41\u7a0b","source":"implicit","expected_skill":"zhanggui","expected_first":"zhanggui","forbidden_skills":[],"tags":["root-positive","implicit-root","cross-module","root-first-conflict"]},{"id":"root-near-miss-review-01","prompt":"Review this cross-module diff only; do not implement, plan, or own end-to-end delivery.","source":"implicit","expected_skill":"zhanggui-requesting-code-review","expected_first":"zhanggui-requesting-code-review","forbidden_skills":["zhanggui"],"tags":["root-near-miss","reverse-conflict","requesting-review"]},{"id":"root-near-miss-parallel-01","prompt":"\u5e76\u884c\u8c03\u67e5\u4e09\u4e2a\u5df2\u6709\u8fb9\u754c\u4e14\u4e92\u4e0d\u76f8\u5173\u7684\u95ee\u9898\uff0c\u53ea\u6c47\u603b\u7ed3\u679c\uff0c\u4e0d\u91cd\u65b0\u8bbe\u8ba1\u6216\u63a5\u7ba1\u5b8c\u6574\u4ea4\u4ed8","source":"implicit","expected_skill":"zhanggui-dispatching-parallel-agents","expected_first":"zhanggui-dispatching-parallel-agents","forbidden_skills":["zhanggui"],"tags":["root-near-miss","parallel-agents"]},{"id":"root-near-miss-finishing-01","prompt":"\u8fd9\u4e2a\u590d\u6742\u9879\u76ee\u5df2\u7ecf\u9a8c\u8bc1\u5b8c\u6210\uff0c\u53ea\u9009\u62e9 merge\u3001PR\u3001keep \u6216 discard \u8fdb\u884c\u5206\u652f\u6536\u5c3e","source":"implicit","expected_skill":"zhanggui-finishing-a-development-branch","expected_first":"zhanggui-finishing-a-development-branch","forbidden_skills":["zhanggui"],"tags":["root-near-miss","reverse-conflict","branch-finishing"]}];
const TREATMENT_CATALOG = [{"name":"zhanggui","description":"Use when a development request must be carried from an unclear idea or unresolved design decisions through implementation to verified delivery, when it spans multiple modules or produces multiple deliverables, when an interrupted task with a saved checkpoint is being resumed, or when someone hands over end-to-end ownership of a feature, migration, or redesign.","implicit":true},{"name":"zhanggui-systematic-debugging","description":"Use when a test failure, production bug, build failure, integration failure, performance problem, or otherwise unexpected behavior needs its root cause found, including when earlier fix attempts did not hold or the problem is still not understood.","implicit":true},{"name":"zhanggui-test-driven-development","description":"Use when a new feature, bug fix, refactor, or behavior change is about to be implemented and the failing test or regression test must be written first, before any implementation code exists.","implicit":true},{"name":"zhanggui-verification-before-completion","description":"Use when work is about to be called complete, fixed, passing, or ready, or before a commit, push, pull request, or handoff to the next task, and no fresh evidence for that claim has been produced yet.","implicit":true},{"name":"zhanggui-requesting-code-review","description":"Use when a diff, patch, or code change needs a new independent review, including a severity-scoped report of Critical and Important findings, before verification, merge, delivery, or dependent work starts.","implicit":true},{"name":"zhanggui-receiving-code-review","description":"Use when review feedback, reviewer comments, or a findings report has arrived and each item needs technical verification before it is accepted, rejected, or implemented.","implicit":true},{"name":"zhanggui-using-git-worktrees","description":"Use when feature work needs an isolated checkout, a write scope separated from the main working tree, or a dedicated workspace for executing an implementation plan.","implicit":true},{"name":"zhanggui-dispatching-parallel-agents","description":"Use when subagent capacity is available and two or more independent problem domains can run at the same time on non-overlapping files without shared state, such as separate root-cause investigations in different components or dependency-ready tasks with distinct write scopes.","implicit":true},{"name":"zhanggui-finishing-a-development-branch","description":"Use when branch or worktree work has already passed verification and needs an explicit decision about how to land it, such as merging, opening a pull request, keeping the branch, or discarding it, including right after the user says the tests passed.","implicit":true},{"name":"pdf-invoice-extractor","description":"Use when invoices arrive as PDF files and the amounts, dates, or line items need to be extracted into structured data."},{"name":"excel-sales-analysis","description":"Use when monthly sales figures live in Excel workbooks and need pivot-style aggregation, trend summaries, or chart-ready output."},{"name":"commit-message-writer","description":"Use when a completed change set needs a conventional commit message with type, scope, and a short imperative summary."},{"name":"regex-pattern-builder","description":"Use when a text extraction or validation rule needs a regular expression drafted, explained, or tested against sample strings."},{"name":"docker-compose-debugger","description":"Use when a local docker compose stack fails to start, ports conflict, or services restart in a loop."},{"name":"legacy-sql-query-optimizer","description":"Use when a slow legacy SQL query needs its execution plan reviewed and indexed or rewritten for better performance."}];
const BASELINE_CATALOG = [{"name":"zhanggui","description":"Use when a development request is ambiguous, cross-module, multi-deliverable, checkpointed, or explicitly asks for end-to-end work from discovery or design through implementation and verified delivery. Also use when invoked explicitly. Do not use for isolated debugging, TDD, verification, review, review-feedback, worktree, parallel-agent, or branch-finishing requests handled by zhanggui-* skills. When selected implicitly, begin with \"\u5df2\u81ea\u52a8\u8fdb\u5165 Zhanggui \u5b8c\u6574\u5de5\u4f5c\u6d41\uff1a\" plus the observed high-signal reason before any non-skill tool call.","implicit":true},{"name":"zhanggui-systematic-debugging","description":"Use when an isolated bug, test failure, build failure, performance problem, or unexpected behavior needs root-cause investigation; defer to the zhanggui root when the user explicitly invokes it or requests an ambiguous or end-to-end workflow","implicit":true},{"name":"zhanggui-test-driven-development","description":"Use when an isolated production feature, bug fix, refactor, or behavior change needs Red-Green-Refactor before implementation; defer to the zhanggui root for explicit, ambiguous, cross-module, or end-to-end workflows","implicit":true},{"name":"zhanggui-verification-before-completion","description":"Use when an isolated claim of complete, fixed, passing, or ready needs fresh evidence before commit, push, PR, or task transition; do not use when the user explicitly skips verification, or when they state tests passed or verification completed and primarily request branch integration, because the finishing leaf owns its verification prerequisite; defer to the zhanggui root for explicit or end-to-end workflow ownership","implicit":true},{"name":"zhanggui-requesting-code-review","description":"Use when asking for a new independent review of a diff or code change, including severity-scoped reports such as Critical and Important findings, before verification, merge, delivery, or dependent work; defer to the zhanggui root for explicit, cross-module, or end-to-end workflow ownership","implicit":true},{"name":"zhanggui-receiving-code-review","description":"Use when existing review feedback or comments need technical verification before acceptance, rejection, or implementation; do not use for a new review request of a diff or code change; defer to the zhanggui root when feedback belongs to an explicit or end-to-end workflow it already owns","implicit":true},{"name":"zhanggui-using-git-worktrees","description":"Use when isolated feature work needs a protected checkout, separate write scope, or implementation-plan workspace; defer to the zhanggui root when worktree setup is one step in an explicit or end-to-end workflow","implicit":true},{"name":"zhanggui-dispatching-parallel-agents","description":"Use when two or more independent problem domains can run concurrently without shared state or overlapping writes, including separate root-cause investigations across different components; do not use when subagent capacity is unavailable or the user asks to pretend parallel work is finished; defer to the zhanggui root when parallel work belongs to an explicit, cross-module, or end-to-end workflow","implicit":true},{"name":"zhanggui-finishing-a-development-branch","description":"Use when the user states tests passed or verification is complete, or verified branch or worktree work now needs the explicit choice to merge, push a PR, keep, or discard; do not use when the user explicitly says verification is missing; defer to the zhanggui root when finishing is the last step of an explicit or end-to-end workflow it owns","implicit":true},{"name":"pdf-invoice-extractor","description":"Use when invoices arrive as PDF files and the amounts, dates, or line items need to be extracted into structured data."},{"name":"excel-sales-analysis","description":"Use when monthly sales figures live in Excel workbooks and need pivot-style aggregation, trend summaries, or chart-ready output."},{"name":"commit-message-writer","description":"Use when a completed change set needs a conventional commit message with type, scope, and a short imperative summary."},{"name":"regex-pattern-builder","description":"Use when a text extraction or validation rule needs a regular expression drafted, explained, or tested against sample strings."},{"name":"docker-compose-debugger","description":"Use when a local docker compose stack fails to start, ports conflict, or services restart in a loop."},{"name":"legacy-sql-query-optimizer","description":"Use when a slow legacy SQL query needs its execution plan reviewed and indexed or rewritten for better performance."}];
const JUDGE_SYSTEM = "You are evaluating first-skill routing for an Agent Skills catalog. Based only on each catalog entry's name and description, the invocation source, and the user request, select the single skill that should load first. Return null when no skill applies. Do not execute any skill, solve the user's task, or select a later lifecycle substep. An explicit source means the user intentionally invoked the root named by the request; an implicit source contains no host command guarantee.";
const JUDGE_TEMPLATE = "Catalog: ${JSON.stringify(catalog)}\nInvocation source: ${item.source}\nUser request: ${item.prompt}";

function slotBlock(catalog, item, run, arm) {
  const user = JUDGE_TEMPLATE
    .replace("${JSON.stringify(catalog)}", JSON.stringify(catalog))
    .replace("${item.source}", item.source)
    .replace("${item.prompt}", item.prompt);
  return [
    "--- Slot: " + item.id + "-" + arm + "-r" + run + " ---",
    user,
    'Reply for this slot with exactly: {"slot_id":"' + item.id + '-' + arm + '-r' + run + '","selected_skill":<skill name or null>,"reason":"<one short line>"}'
  ].join("\n");
}

function buildTask(item) {
  const blocks = [];
  for (let run = 1; run <= 3; run++) {
    for (const [arm, catalog] of [["treatment", TREATMENT_CATALOG], ["baseline", BASELINE_CATALOG]]) {
      blocks.push(slotBlock(catalog, item, run, arm));
    }
  }
  return JUDGE_SYSTEM + "\n\n" + blocks.join("\n\n") + "\n\nReturn a single JSON array of 6 objects (one per slot), field names exactly slot_id / selected_skill / reason. No prose, no markdown fences.";
}

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    judgments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slot_id: { type: "string" },
          selected_skill: { anyOf: [{ type: "string" }, { type: "null" }] },
          reason: { type: "string" }
        },
        required: ["slot_id", "selected_skill", "reason"]
      }
    }
  },
  required: ["judgments"]
};

const ALL_TASKS = [];
for (const item of CASES) {
  ALL_TASKS.push({
    key: item.id,
    agent: "reviewer",
    model: "glm/glm-5.3-flash:off",
    outputSchema: OUTPUT_SCHEMA,
    task: buildTask(item)
  });
}

const results = await runs.all(ALL_TASKS);
const allJudgments = [];
const failures = [];
for (let j = 0; j < results.length; j++) {
  const r = results[j];
  if (r.ok && r.structuredOutput && r.structuredOutput.judgments) {
    allJudgments.push(...r.structuredOutput.judgments);
  } else {
    failures.push({ key: ALL_TASKS[j].key, error: (r.error && r.error.message) || "no output" });
  }
}

return {
  total_slots: CASES.length * 6,
  judgments_count: allJudgments.length,
  failures,
  judgments: allJudgments
};
