import { spawn, execSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, readFileSync, readdirSync, createWriteStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { RUNS_PER_CELL, MAX_TURNS, WALL_CLOCK_MINUTES, APP_URL } from './config.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const APP_DIR = join(ROOT, 'app');
const RAW_DIR = join(ROOT, 'results', 'raw');
const MCP_DIR = join(ROOT, 'harness', 'mcp-configs');
const SANDBOX_BASE = join(process.env.HOME, 'mcp-bench-sandbox');
const CLAUDE_BIN = join(process.env.HOME, '.claude', 'local', 'node_modules', '.bin', 'claude');

mkdirSync(RAW_DIR, { recursive: true });
mkdirSync(SANDBOX_BASE, { recursive: true });

// ---------- Symptoms ----------
const SYMPTOMS = {
  bug1: 'The project stats take several seconds to appear after the page loads.',
  bug2: 'The row of project cards is broken. Content spills past the right edge of the page.',
  bug3: 'One project card shows "Something went wrong".',
  bug4: 'Typing in the notes box above the activity table feels slow.',
};

// ---------- Prompt builder ----------
function buildPrompt(symptom) {
  return `You are debugging a web app running at ${APP_URL}.
You can only use the tools you have been given. You cannot read the project files.
Use a 1280x720 viewport.

Symptom: ${symptom}

Find the root cause. Do not fix anything.

End your answer with exactly this block:
ROOT_CAUSE: <one or two sentences. Name the specific component, element, request, or CSS rule.>
EVIDENCE: <what you saw that proves it, and which tool showed it>
CONFIDENCE: <low | medium | high>
COULD_NOT_SEE: <anything you needed that your tools could not show you, or "nothing">`;
}

// ---------- Run matrix ----------
function buildMatrix(seed) {
  const runs = [];

  // Track A: browser MCP alone, plain app
  const browsers = ['chrome', 'safari', 'firefox'];
  const bugs = ['bug1', 'bug2', 'bug3', 'bug4'];

  for (const browser of browsers) {
    for (const bug of bugs) {
      for (let i = 0; i < RUNS_PER_CELL; i++) {
        runs.push({
          id: `trackA-${browser}-${bug}-r${i}`,
          track: 'A',
          browser,
          bug,
          mcpConfig: `${browser}.json`,
          serverName: browser,
          devMode: 'dev',
          appendSystemPrompt: null,
          needsBash: false,
          needsDaemon: false,
        });
      }
    }
  }

  // Track B: React layer, bug 4 only
  // Chrome + layer A (dev:cdt, chrome-react.json)
  for (let i = 0; i < RUNS_PER_CELL; i++) {
    runs.push({
      id: `trackB-chrome-layerA-r${i}`,
      track: 'B',
      browser: 'chrome',
      bug: 'bug4',
      mcpConfig: 'chrome-react.json',
      serverName: 'chrome',
      devMode: 'dev:cdt',
      appendSystemPrompt: 'React developer tools may be exposed by the page as third-party developer tools.',
      needsBash: false,
      needsDaemon: false,
    });
  }

  // Chrome + layer B (dev:ard, chrome.json)
  for (let i = 0; i < RUNS_PER_CELL; i++) {
    runs.push({
      id: `trackB-chrome-layerB-r${i}`,
      track: 'B',
      browser: 'chrome',
      bug: 'bug4',
      mcpConfig: 'chrome.json',
      serverName: 'chrome',
      devMode: 'dev:ard',
      appendSystemPrompt: 'The agent-react-devtools CLI is installed and its daemon is running. Run "agent-react-devtools --help" to see its commands.',
      needsBash: true,
      needsDaemon: true,
    });
  }

  // Safari + layer B
  for (let i = 0; i < RUNS_PER_CELL; i++) {
    runs.push({
      id: `trackB-safari-layerB-r${i}`,
      track: 'B',
      browser: 'safari',
      bug: 'bug4',
      mcpConfig: 'safari.json',
      serverName: 'safari',
      devMode: 'dev:ard',
      appendSystemPrompt: 'The agent-react-devtools CLI is installed and its daemon is running. Run "agent-react-devtools --help" to see its commands.',
      needsBash: true,
      needsDaemon: true,
    });
  }

  // Firefox + layer B
  for (let i = 0; i < RUNS_PER_CELL; i++) {
    runs.push({
      id: `trackB-firefox-layerB-r${i}`,
      track: 'B',
      browser: 'firefox',
      bug: 'bug4',
      mcpConfig: 'firefox.json',
      serverName: 'firefox',
      devMode: 'dev:ard',
      appendSystemPrompt: 'The agent-react-devtools CLI is installed and its daemon is running. Run "agent-react-devtools --help" to see its commands.',
      needsBash: true,
      needsDaemon: true,
    });
  }

  // Shuffle with seeded PRNG
  const rng = mulberry32(seed);
  for (let i = runs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [runs[i], runs[j]] = [runs[j], runs[i]];
  }

  return runs;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---------- Utilities ----------
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForUrl(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await sleep(500);
  }
  throw new Error(`${url} did not respond within ${timeoutMs}ms`);
}

function isRunFinished(runId) {
  const path = join(RAW_DIR, `${runId}.jsonl`);
  if (!existsSync(path)) return false;
  const content = readFileSync(path, 'utf8').trim();
  // A finished run has a result event
  return content.includes('"type":"result"') || content.includes('"type": "result"');
}

// ---------- Dev server management ----------
let devServerProc = null;
let currentDevMode = null;

async function startDevServer(mode) {
  if (devServerProc && currentDevMode === mode) {
    // Already running the right mode
    try { await waitForUrl(APP_URL, 3000); return; } catch {}
  }
  await stopDevServer();

  console.log(`  Starting dev server: npm run ${mode}`);
  devServerProc = spawn('npm', ['run', mode], {
    cwd: APP_DIR,
    stdio: 'pipe',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  devServerProc.stderr.on('data', () => {});
  devServerProc.stdout.on('data', () => {});
  currentDevMode = mode;
  await waitForUrl(APP_URL, 30000);
  console.log(`  Dev server ready (${mode})`);
}

async function stopDevServer() {
  if (devServerProc) {
    devServerProc.kill('SIGTERM');
    await sleep(1000);
    try { devServerProc.kill('SIGKILL'); } catch {}
    devServerProc = null;
    currentDevMode = null;
    await sleep(500);
  }
}

// ---------- Daemon management ----------
let daemonProc = null;

async function startDaemon() {
  if (daemonProc) return;
  console.log('  Starting agent-react-devtools daemon');
  daemonProc = spawn('npx', ['agent-react-devtools', 'start'], {
    cwd: APP_DIR,
    stdio: 'pipe',
  });
  daemonProc.stderr.on('data', () => {});
  daemonProc.stdout.on('data', () => {});
  await sleep(3000); // Give daemon time to start
}

async function stopDaemon() {
  if (daemonProc) {
    daemonProc.kill('SIGTERM');
    await sleep(1000);
    try { daemonProc.kill('SIGKILL'); } catch {}
    daemonProc = null;
  }
}

// ---------- Run one session ----------
async function runOne(run) {
  const outPath = join(RAW_DIR, `${run.id}.jsonl`);

  if (isRunFinished(run.id)) {
    console.log(`  Skipping ${run.id} (already finished)`);
    return { skipped: true };
  }

  // Create sandbox folder
  const sandboxDir = join(SANDBOX_BASE, run.id);
  mkdirSync(sandboxDir, { recursive: true });

  const mcpConfigPath = join(MCP_DIR, run.mcpConfig);
  const symptom = SYMPTOMS[run.bug];
  const prompt = buildPrompt(symptom);

  // Build claude command
  const args = [
    '-p', prompt,
    '--output-format', 'stream-json', '--verbose',
    '--mcp-config', mcpConfigPath, '--strict-mcp-config',
    '--permission-mode', 'dontAsk',
    '--disable-slash-commands', '--no-chrome',
    '--no-session-persistence',
    '--max-turns', String(MAX_TURNS),
  ];

  if (run.needsBash) {
    args.push('--tools', 'Bash');
    args.push('--allowedTools', `mcp__${run.serverName}__*`, 'Bash(agent-react-devtools *)');
  } else {
    args.push('--tools', '');
    args.push('--allowedTools', `mcp__${run.serverName}__*`);
  }

  if (run.appendSystemPrompt) {
    args.push('--append-system-prompt', run.appendSystemPrompt);
  }

  console.log(`  Launching claude for ${run.id}`);
  const startTime = Date.now();

  return new Promise((resolve) => {
    const proc = spawn(CLAUDE_BIN, args, {
      cwd: sandboxDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    let finished = false;
    let hitRateLimit = false;
    const stdoutChunks = [];

    proc.stdout.on('data', (chunk) => {
      stdoutChunks.push(chunk);
      const text = chunk.toString();
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
          const evt = JSON.parse(line);
          if (evt.type === 'result') {
            finished = true;
          }
          if (evt.type === 'error' && /rate.limit|overloaded/i.test(JSON.stringify(evt))) {
            hitRateLimit = true;
          }
        } catch {}
      }
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      if (/rate.limit|overloaded|auth/i.test(text)) {
        hitRateLimit = true;
      }
    });

    // Wall clock timeout
    const timer = setTimeout(() => {
      console.log(`  TIMEOUT: ${run.id} hit ${WALL_CLOCK_MINUTES}m wall clock`);
      proc.kill('SIGTERM');
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 5000);
    }, WALL_CLOCK_MINUTES * 60 * 1000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      const output = Buffer.concat(stdoutChunks).toString();
      writeFileSync(outPath, output);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  ${run.id} done in ${elapsed}s (code=${code}, finished=${finished}, rateLimit=${hitRateLimit})`);

      if (hitRateLimit && !finished) {
        console.log(`  Rate limit hit on ${run.id}. Run not marked done.`);
      }

      resolve({
        skipped: false,
        finished,
        hitRateLimit,
        elapsed: parseFloat(elapsed),
        code,
      });
    });
  });
}

// ---------- Smoke test ----------
async function smokeTest() {
  console.log('\n=== SMOKE TEST ===\n');

  const configs = [
    { name: 'no-mcp', config: null },
    { name: 'chrome', config: 'chrome.json' },
    { name: 'chrome-react', config: 'chrome-react.json' },
    { name: 'firefox', config: 'firefox.json' },
    { name: 'safari', config: 'safari.json' },
  ];

  // Also test firefox with default preset
  configs.push({
    name: 'firefox-basic',
    config: null,
    customArgs: true,
  });

  for (const cfg of configs) {
    const runId = `smoke-${cfg.name}`;
    const outPath = join(RAW_DIR, `${runId}.jsonl`);
    const sandboxDir = join(SANDBOX_BASE, runId);
    mkdirSync(sandboxDir, { recursive: true });

    const args = ['-p', 'Reply with the single word OK.',
      '--output-format', 'stream-json', '--verbose',
      '--permission-mode', 'dontAsk',
      '--disable-slash-commands', '--no-chrome',
      '--no-session-persistence',
      '--max-turns', '1',
    ];

    if (cfg.config) {
      const mcpConfigPath = join(MCP_DIR, cfg.config);
      args.push('--mcp-config', mcpConfigPath, '--strict-mcp-config');
    }

    if (cfg.name === 'firefox-basic') {
      // Firefox with default (basic) preset
      const basicConfig = {
        mcpServers: {
          firefox: {
            command: 'npx',
            args: ['-y', '@mozilla/firefox-devtools-mcp@0.10.4', '--viewport', '1280x720'],
          },
        },
      };
      const basicPath = join(MCP_DIR, 'firefox-basic.json');
      writeFileSync(basicPath, JSON.stringify(basicConfig, null, 2));
      args.push('--mcp-config', basicPath, '--strict-mcp-config');
    }

    console.log(`Smoke: ${cfg.name}`);
    const startTime = Date.now();

    await new Promise((resolve) => {
      const chunks = [];
      const proc = spawn(CLAUDE_BIN, args, {
        cwd: sandboxDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      proc.stdout.on('data', (chunk) => chunks.push(chunk));
      proc.stderr.on('data', () => {});

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
      }, 60000);

      proc.on('close', () => {
        clearTimeout(timer);
        writeFileSync(outPath, Buffer.concat(chunks).toString());
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  Done in ${elapsed}s`);
        resolve();
      });
    });

    // Parse the result
    if (existsSync(outPath)) {
      const lines = readFileSync(outPath, 'utf8').trim().split('\n');
      let model = 'unknown';
      let tools = [];
      let inputTokens = 0;

      for (const line of lines) {
        try {
          const evt = JSON.parse(line);
          if (evt.type === 'system' && evt.subtype === 'init') {
            model = evt.model || evt.data?.model || 'unknown';
            tools = evt.tools || evt.data?.tools || [];
          }
          if (evt.type === 'result') {
            inputTokens = evt.input_tokens || evt.usage?.input_tokens || evt.data?.usage?.input_tokens || 0;
          }
        } catch {}
      }

      console.log(`  Model: ${model}`);
      console.log(`  Tools (${tools.length}): ${tools.join(', ') || '(parse from events)'}`);
      console.log(`  Input tokens: ${inputTokens}`);
    }
    console.log('');
  }

  // Real session per browser on bug 3
  console.log('\n=== REAL SMOKE RUNS (bug 3, one per browser) ===\n');

  await startDevServer('dev');

  for (const browser of ['chrome', 'safari', 'firefox']) {
    const run = {
      id: `smoke-real-${browser}-bug3`,
      track: 'smoke',
      browser,
      bug: 'bug3',
      mcpConfig: `${browser}.json`,
      serverName: browser,
      devMode: 'dev',
      appendSystemPrompt: null,
      needsBash: false,
      needsDaemon: false,
    };

    console.log(`Real smoke: ${browser} on bug 3`);
    const result = await runOne(run);
    console.log(`  Result:`, JSON.stringify(result));
    console.log('');
  }

  await stopDevServer();
}

// ---------- Main ----------
const mode = process.argv[2];

if (mode === '--smoke') {
  smokeTest().then(() => {
    console.log('\nSmoke test complete.');
    process.exit(0);
  }).catch((e) => {
    console.error('Smoke test failed:', e);
    process.exit(1);
  });
} else if (mode === '--all') {
  const SEED = 20261006;
  console.log(`Seed: ${SEED}`);
  console.log(`Runs per cell: ${RUNS_PER_CELL}`);
  console.log(`Max turns: ${MAX_TURNS}`);
  console.log(`Wall clock: ${WALL_CLOCK_MINUTES} min`);

  const matrix = buildMatrix(SEED);
  console.log(`Total runs: ${matrix.length}`);
  console.log(`Run order: ${matrix.map((r) => r.id).join(', ')}`);

  (async () => {
    let lastDevMode = null;

    for (let i = 0; i < matrix.length; i++) {
      const run = matrix[i];
      console.log(`\n--- Run ${i + 1}/${matrix.length}: ${run.id} ---`);

      // Start dev server if needed
      if (run.devMode !== lastDevMode) {
        await stopDaemon();
        await startDevServer(run.devMode);
        lastDevMode = run.devMode;
      }

      // Start daemon if needed
      if (run.needsDaemon) {
        await startDaemon();
      } else {
        await stopDaemon();
      }

      const result = await runOne(run);

      if (result.hitRateLimit) {
        console.log('  Rate limit detected. Waiting 60s before retry...');
        await sleep(60000);
        i--; // Retry this run
        continue;
      }

      // Check for contamination (layer B runs only)
      if (run.needsBash && result.finished && !result.skipped) {
        const outPath = join(RAW_DIR, `${run.id}.jsonl`);
        const content = readFileSync(outPath, 'utf8');
        const lines = content.trim().split('\n');
        let contaminated = false;

        for (const line of lines) {
          try {
            const evt = JSON.parse(line);
            // Look for tool_use events that are Bash but not agent-react-devtools
            if (evt.type === 'assistant' && evt.message?.content) {
              for (const block of evt.message.content) {
                if (block.type === 'tool_use' && block.name === 'Bash') {
                  const cmd = block.input?.command || '';
                  if (!cmd.trimStart().startsWith('agent-react-devtools')) {
                    console.log(`  CONTAMINATED: ${run.id} ran unauthorized command: ${cmd.substring(0, 80)}`);
                    contaminated = true;
                  }
                }
              }
            }
          } catch {}
        }

        if (contaminated) {
          // Rename the file and retry
          const contPath = join(RAW_DIR, `${run.id}.contaminated.jsonl`);
          const fs = await import('node:fs');
          fs.renameSync(outPath, contPath);
          console.log(`  Moved to ${contPath}. Will retry.`);
          i--; // Retry
          continue;
        }
      }
    }

    await stopDaemon();
    await stopDevServer();
    console.log('\n=== ALL RUNS COMPLETE ===');
    process.exit(0);
  })().catch((e) => {
    console.error('Matrix run failed:', e);
    stopDaemon().then(() => stopDevServer()).then(() => process.exit(1));
  });
} else if (mode === '--count') {
  const SEED = 20261006;
  const matrix = buildMatrix(SEED);
  console.log(`Seed: ${SEED}`);
  console.log(`Total scored runs: ${matrix.length}`);
  console.log(`Track A: ${matrix.filter((r) => r.track === 'A').length} runs (3 browsers x 4 bugs x ${RUNS_PER_CELL})`);
  console.log(`Track B: ${matrix.filter((r) => r.track === 'B').length} runs (4 setups x ${RUNS_PER_CELL})`);
  const est = matrix.length * WALL_CLOCK_MINUTES;
  console.log(`Worst-case time: ${est} min (${(est / 60).toFixed(1)} hours)`);
} else {
  console.log('Usage:');
  console.log('  node harness/run.mjs --smoke    Run smoke tests');
  console.log('  node harness/run.mjs --all      Run full matrix');
  console.log('  node harness/run.mjs --count    Show run count and time estimate');
}
