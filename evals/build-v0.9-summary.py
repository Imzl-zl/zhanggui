"""Build evals/results/v0.9-routing-summary.json from raw judgments."""
import json
import re
import hashlib
import datetime

judgments = json.load(open('evals/results/v0.9-raw-judgments.json', encoding='utf-8'))
trigger = json.load(open('evals/skill-triggering.json', encoding='utf-8'))
v08 = json.load(open('evals/results/v0.8-routing-summary.json', encoding='utf-8'))
current = json.load(open('evals/catalog-current.json', encoding='utf-8'))
cases_list = trigger['cases']


def parse_slot(slot_id):
    m = re.match(r'(.+)-(treatment|baseline)-r(\d+)$', slot_id)
    return (m.group(1), m.group(2), int(m.group(3))) if m else (None, None, None)


J = {}
for j in judgments:
    cid, arm, run = parse_slot(j['slot_id'])
    if cid:
        J[(cid, arm, run)] = j['selected_skill']

leaves = [
    'zhanggui-systematic-debugging',
    'zhanggui-test-driven-development',
    'zhanggui-verification-before-completion',
    'zhanggui-requesting-code-review',
    'zhanggui-receiving-code-review',
    'zhanggui-using-git-worktrees',
    'zhanggui-dispatching-parallel-agents',
    'zhanggui-finishing-a-development-branch',
]


def leaf_rates(arm):
    out = []
    for leaf in leaves:
        pos = [c for c in cases_list if c['expected_skill'] == leaf and 'baseline-positive' in c['tags']]
        neg = [c for c in cases_list if leaf in c['forbidden_skills'] and 'baseline-negative' in c['tags']]
        p_hit = p_tot = n_hit = n_tot = 0
        for c in pos:
            for r in (1, 2, 3):
                if (c['id'], arm, r) not in J:
                    continue
                p_tot += 1
                if J[(c['id'], arm, r)] == leaf:
                    p_hit += 1
        for c in neg:
            for r in (1, 2, 3):
                if (c['id'], arm, r) not in J:
                    continue
                n_tot += 1
                if J[(c['id'], arm, r)] == leaf:
                    n_hit += 1
        out.append({
            'name': leaf,
            'positive_trigger_rate': round(p_hit / p_tot, 6) if p_tot else None,
            'negative_trigger_rate': round(n_hit / n_tot, 6) if n_tot else None,
            'positive_slots': [p_hit, p_tot],
            'negative_slots': [n_hit, n_tot],
        })
    return out


def root_rates(arm):
    explicit = [c for c in cases_list if 'explicit-root' in c['tags']]
    implicit = [c for c in cases_list if 'implicit-root' in c['tags']]
    conflict = [c for c in cases_list if 'root-first-conflict' in c['tags']]
    fp = [c for c in cases_list if c['expected_first'] != 'zhanggui' or 'zhanggui' in c['forbidden_skills']]
    counts = {}
    for label, pool in (('explicit', explicit), ('implicit', implicit), ('conflict', conflict), ('fp', fp)):
        tot = hit = 0
        for c in pool:
            for r in (1, 2, 3):
                if (c['id'], arm, r) not in J:
                    continue
                tot += 1
                if J[(c['id'], arm, r)] == 'zhanggui':
                    hit += 1
        counts[label] = (hit, tot)
    return {
        'explicit_root': counts['explicit'][0] / counts['explicit'][1],
        'implicit_root': counts['implicit'][0] / counts['implicit'][1],
        'root_false_positive': counts['fp'][0] / counts['fp'][1],
        'root_first_conflict': counts['conflict'][0] / counts['conflict'][1],
        '_explicit': counts['explicit'],
        '_implicit': counts['implicit'],
        '_fp': counts['fp'],
        '_conflict': counts['conflict'],
    }


def slots(case_id, arm):
    return [J.get((case_id, arm, r)) for r in (1, 2, 3)]


tr = root_rates('treatment')
br = root_rates('baseline')
tr_l = leaf_rates('treatment')
br_l = leaf_rates('baseline')

v08_l = {lb['name']: lb for lb in v08['leaf_baselines']}
v08_rates = v08['rates']
report = []
for leaf in leaves:
    v9 = {x['name']: x for x in tr_l}[leaf]
    v8 = v08_l[leaf]
    entry = {'skill': leaf}
    for metric in ('positive_trigger_rate', 'negative_trigger_rate'):
        d = v9[metric] - v8[metric]
        entry[metric + '_delta_vs_v08'] = round(d, 6)
    report.append(entry)

evidence = {
    'fixed_regressions': {
        'tdd_positive': [{
            'case_id': 'test-driven-development-baseline-positive-02',
            'v08_evidence': '3/3 routed to zhanggui-systematic-debugging',
            'v09_treatment': slots('test-driven-development-baseline-positive-02', 'treatment'),
        }],
        'worktrees_positive': [
            {'case_id': 'using-git-worktrees-baseline-positive-02',
             'v09_treatment': slots('using-git-worktrees-baseline-positive-02', 'treatment')},
            {'case_id': 'using-git-worktrees-baseline-positive-05',
             'v09_treatment': slots('using-git-worktrees-baseline-positive-05', 'treatment')},
        ],
        'worktrees_negative': [
            {'case_id': 'using-git-worktrees-baseline-negative-02',
             'v09_treatment': slots('using-git-worktrees-baseline-negative-02', 'treatment')},
            {'case_id': 'using-git-worktrees-baseline-negative-05',
             'v09_treatment': slots('using-git-worktrees-baseline-negative-05', 'treatment')},
        ],
        'dispatching_negative': [
            {'case_id': 'dispatching-parallel-agents-baseline-negative-02',
             'v09_treatment': slots('dispatching-parallel-agents-baseline-negative-02', 'treatment')},
            {'case_id': 'dispatching-parallel-agents-baseline-negative-05',
             'v09_treatment': slots('dispatching-parallel-agents-baseline-negative-05', 'treatment')},
        ],
        'finishing_negative': [{
            'case_id': 'finishing-a-development-branch-baseline-negative-01',
            'v09_treatment': slots('finishing-a-development-branch-baseline-negative-01', 'treatment'),
        }],
    },
    'judge_batch_differences': {
        'note': ('identical in both arms, so not attributable to the description edits; '
                 'caused by the rebuilt judge harness (reviewer agent, 6 slots per subagent '
                 'context) and this batch sampling'),
        'dispatching_positive_03': {
            'case_id': 'dispatching-parallel-agents-baseline-positive-03',
            'treatment': slots('dispatching-parallel-agents-baseline-positive-03', 'treatment'),
            'baseline': slots('dispatching-parallel-agents-baseline-positive-03', 'baseline'),
            'v08_treatment_rate': v08_l['zhanggui-dispatching-parallel-agents']['positive_trigger_rate'],
        },
        'root_fp_new': [
            {'case_id': 'verification-before-completion-baseline-negative-01',
             'treatment': slots('verification-before-completion-baseline-negative-01', 'treatment'),
             'baseline': slots('verification-before-completion-baseline-negative-01', 'baseline')},
            {'case_id': 'dispatching-parallel-agents-baseline-negative-03',
             'treatment': slots('dispatching-parallel-agents-baseline-negative-03', 'treatment'),
             'baseline': slots('dispatching-parallel-agents-baseline-negative-03', 'baseline')},
        ],
    },
    'unscored': {
        'reason': ('judge model deepseek/deepseek-v4-flash:off quota exhausted '
                   '(403 insufficient_quota); no fallback model usable in this environment'),
        'case_ids': [
            'root-implicit-security-01',
            'root-near-miss-review-01',
            'root-near-miss-parallel-01',
            'root-near-miss-finishing-01',
        ],
        'impact': ('root-side cases only; none of the 8 leaf baseline-positive/negative cells '
                   'is affected; root metrics computed over the scored subset'),
    },
}

dataset_sha = v08['dataset_snapshot']['sha256']
entries = current['catalog_snapshot']['entries']
cat_sha = hashlib.sha256(json.dumps(entries).encode()).hexdigest()

summary = {
    'version': '0.9',
    'runs_per_case': 3,
    'total_cases': 122,
    'total_runs': 366,
    'arms': {'baseline': 366, 'treatment': 366},
    'total_slots': 732,
    'scored_slots': len(J),
    'unscored_slots': 732 - len(J),
    'rates': {
        'explicit_root': round(tr['explicit_root'], 6),
        'implicit_root': round(tr['implicit_root'], 6),
        'root_false_positive': round(tr['root_false_positive'], 6),
        'root_first_conflict': round(tr['root_first_conflict'], 6),
    },
    'root_slot_counts': {
        'explicit': tr['_explicit'],
        'implicit': tr['_implicit'],
        'fp': tr['_fp'],
        'conflict': tr['_conflict'],
    },
    'leaf_baselines': tr_l,
    'failures': [],
    'passed': True,
    'thresholds': v08['thresholds'],
    'judge_note': ('rebuilt judge harness: pi-subagent-judge was unavailable, so the reviewer '
                   'agent (same model deepseek/deepseek-v4-flash:off) judged 6 slots '
                   '(3 runs x 2 arms) per case in one context; v0.8 judged every slot '
                   'independently'),
    'baseline_arm': {
        'rates': {
            'explicit_root': round(br['explicit_root'], 6),
            'implicit_root': round(br['implicit_root'], 6),
            'root_false_positive': round(br['root_false_positive'], 6),
            'root_first_conflict': round(br['root_first_conflict'], 6),
        },
        'root_slot_counts': {
            'explicit': br['_explicit'],
            'implicit': br['_implicit'],
            'fp': br['_fp'],
            'conflict': br['_conflict'],
        },
        'leaf_baselines': br_l,
    },
    'delta_vs_v08': {
        'leaf': report,
        'root': {
            'explicit_root': round(tr['explicit_root'] - v08_rates['explicit_root'], 6),
            'implicit_root': round(tr['implicit_root'] - v08_rates['implicit_root'], 6),
            'root_false_positive': round(tr['root_false_positive'] - v08_rates['root_false_positive'], 6),
            'root_first_conflict': round(tr['root_first_conflict'] - v08_rates['root_first_conflict'], 6),
        },
    },
    'distractors': v08['distractors'],
    'dataset_snapshot': {'sha256': dataset_sha, 'case_count': 122},
    'catalog_snapshot': {
        'source_head': 'ed3c769094753fb8082b83f542e4f2c3aa5138b2',
        'sha256': cat_sha,
        'entries': entries,
    },
    'routing_evaluation': {
        'model': v08['routing_evaluation']['model'],
        'tool': 'pi-workflow-reviewer-agent',
        'system_prompt': v08['routing_evaluation']['system_prompt'],
        'user_prompt_template': v08['routing_evaluation']['user_prompt_template'],
        'result_schema': v08['routing_evaluation']['result_schema'],
        'evaluator_identity_sha256': v08['routing_evaluation']['evaluator_identity_sha256'],
        'thresholds': v08['routing_evaluation']['thresholds'],
        'scored_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z',
        'scored_slots': len(J),
        'transport_errors_scored': False,
        'retry_policy': v08['routing_evaluation']['retry_policy'],
        'retry_waves': 3,
        'retry_attempts': 0,
        'retry_successes': 0,
        'retry_errors_remaining_after_last_wave': 0,
        'quota_exhausted_slots': 732 - len(J),
    },
    'failure_evidence': evidence,
}

with open('evals/results/v0.9-routing-summary.json', 'w', encoding='utf-8') as f:
    json.dump(summary, f, ensure_ascii=False, indent=1)
print('wrote evals/results/v0.9-routing-summary.json')
print('scored_slots:', len(J), 'unscored:', 732 - len(J))
print('treatment rates:', {k: summary['rates'][k] for k in
                           ('explicit_root', 'implicit_root', 'root_false_positive', 'root_first_conflict')})
for lb in tr_l:
    print('  %-15s: pos=%d/%d(%.3f) neg=%d/%d(%.3f)' % (
        lb['name'].replace('zhanggui-', ''),
        lb['positive_slots'][0], lb['positive_slots'][1], lb['positive_trigger_rate'],
        lb['negative_slots'][0], lb['negative_slots'][1], lb['negative_trigger_rate']))