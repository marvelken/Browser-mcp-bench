import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const RESULTS_DIR = join(ROOT, 'results');
const SUMMARY_PATH = join(RESULTS_DIR, 'summary.json');

if (!existsSync(SUMMARY_PATH)) {
  console.error('Run summarize.mjs first');
  process.exit(1);
}

const summary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf8'));

// Required facts per bug
const REQUIRED_FACTS = {
  bug1: {
    a: 'the stats requests run one after another (sequential)',
    b: 'the cause is sequential awaiting, and they could run in parallel',
    keywords_a: ['sequential', 'one after another', 'one by one', 'serial', 'waterfall', 'chain', 'sequentially', 'in order', 'in sequence', 'one at a time'],
    keywords_b: ['parallel', 'Promise.all', 'concurrent', 'simultaneously', 'await.*loop', 'await.*for', 'for.*await'],
  },
  bug2: {
    a: 'names the card or title element with the long name',
    b: 'flex item cannot shrink, min-width: 0 or overflow or nowrap',
    keywords_a: ['card', 'title', 'long name', 'Infrastructure', 'project name', 'no spaces', 'nowrap', 'white-space'],
    keywords_b: ['min-width', 'flex', 'shrink', 'overflow', 'nowrap', 'white-space', 'intrinsic', 'content.*width'],
  },
  bug3: {
    a: 'names the one request whose response has a different shape',
    b: 'links that shape to the undefined read in the component',
    keywords_a: ['project.*5', 'data.*pipeline', '/api/projects/5', 'different.*shape', 'different.*format', 'nested', 'wrapped', 'data.*wrapper', '{.*data.*{'],
    keywords_b: ['undefined', 'growth', 'revenue', 'toFixed', 'toLocaleString', 'TypeError', 'cannot read', 'StatDisplay', 'stats\\.'],
  },
  bug4: {
    a: 'all rows re-render on every keystroke',
    b: 'context value is new object each render, memo does not block context',
    keywords_a: ['re-render', 'rerender', 'every keystroke', 'every change', 'every input', 'every character', 'all.*rows', '1500.*rows', '300.*rows', 'unnecessary.*render'],
    keywords_b: ['context', 'provider', 'memo.*context', 'context.*memo', 'new.*object', 'value.*object', 'draftNote', 'notes.*state', 'same.*context', 'unrelated.*state'],
  },
};

function gradeRun(runId, parsed) {
  // Extract bug from runId
  let bug;
  const bugMatch = runId.match(/bug(\d)/);
  if (bugMatch) {
    bug = `bug${bugMatch[1]}`;
  } else if (runId.startsWith('trackB-')) {
    bug = 'bug4'; // Track B runs are always bug 4
  } else {
    return null;
  }
  const facts = REQUIRED_FACTS[bug];
  if (!facts) return null;

  const answer = (parsed.final_block?.root_cause || '') + ' ' + (parsed.final_block?.evidence || '');
  const answerLower = answer.toLowerCase();

  // Check fact A
  const hasA = facts.keywords_a.some(kw => {
    const re = new RegExp(kw, 'i');
    return re.test(answer);
  });

  // Check fact B
  const hasB = facts.keywords_b.some(kw => {
    const re = new RegExp(kw, 'i');
    return re.test(answer);
  });

  let score;
  let reasoning;
  let matchedSentence;

  if (hasA && hasB) {
    score = 2;
    reasoning = `Both facts present. A: matched keywords in answer. B: matched keywords in answer.`;
    // Find the sentence that earned it
    const sentences = answer.split(/[.!]\s/);
    matchedSentence = sentences.find(s => facts.keywords_b.some(kw => new RegExp(kw, 'i').test(s))) || sentences[0];
  } else if (hasA || hasB) {
    score = 1;
    const which = hasA ? 'A only' : 'B only';
    reasoning = `${which}. ${hasA ? 'Named the right area but' : 'Found the mechanism but'} ${hasA ? 'mechanism missing or wrong' : 'did not name the specific element'}.`;
    matchedSentence = answer.substring(0, 150);
  } else {
    score = 0;
    reasoning = 'Neither fact found in answer. Wrong diagnosis or no answer.';
    matchedSentence = answer.substring(0, 150) || '(no answer)';
  }

  // Flag for human review
  const needsReview = score === 1 ||
    (score === 2 && parsed.final_block?.confidence !== 'high') ||
    (score === 0 && answer.length > 50); // might have a valid answer we missed

  return {
    run_id: runId,
    bug,
    score,
    matched_sentence: matchedSentence.trim().substring(0, 200),
    reasoning,
    needs_human_review: needsReview,
    confidence: parsed.final_block?.confidence || '',
    could_not_see: parsed.final_block?.could_not_see || '',
  };
}

// Grade all runs
const grades = {};
for (const [runId, parsed] of Object.entries(summary)) {
  if (parsed.error) {
    grades[runId] = { error: parsed.error, score: null, needs_human_review: true };
    continue;
  }
  const grade = gradeRun(runId, parsed);
  if (grade) {
    grades[runId] = grade;
  }
}

writeFileSync(join(RESULTS_DIR, 'grades.json'), JSON.stringify(grades, null, 2));
console.log(`Graded ${Object.keys(grades).length} runs to results/grades.json`);

// Print summary
const scoreCounts = { 0: 0, 1: 0, 2: 0 };
let needsReview = 0;
for (const g of Object.values(grades)) {
  if (g.score !== null && g.score !== undefined) {
    scoreCounts[g.score]++;
  }
  if (g.needs_human_review) needsReview++;
}

console.log(`Scores: 2=${scoreCounts[2]}, 1=${scoreCounts[1]}, 0=${scoreCounts[0]}`);
console.log(`Needs human review: ${needsReview}`);
console.log('\nWARNING: I planted the bugs, so I am a biased grader. All scores should be reviewed.');

// Print per-bug per-browser breakdown
const breakdown = {};
for (const [runId, g] of Object.entries(grades)) {
  if (g.score === null || g.score === undefined) continue;
  const parts = runId.split('-');
  const track = parts[0];
  let browser, bug;

  if (track === 'trackA') {
    browser = parts[1];
    bug = parts[2];
  } else if (track === 'trackB') {
    browser = parts[1];
    const layer = parts[2];
    bug = 'bug4';
    browser = `${browser}-${layer}`;
  }

  const key = `${bug}|${browser}`;
  if (!breakdown[key]) breakdown[key] = [];
  breakdown[key].push(g.score);
}

console.log('\nBreakdown:');
for (const [key, scores] of Object.entries(breakdown).sort()) {
  const [bug, browser] = key.split('|');
  const mean = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
  console.log(`  ${bug} ${browser}: scores=[${scores.join(',')}] mean=${mean}`);
}
