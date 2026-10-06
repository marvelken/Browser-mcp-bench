import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const RAW_DIR = join(ROOT, 'results', 'raw');
const RESULTS_DIR = join(ROOT, 'results');

function parseTranscript(filePath) {
  const content = readFileSync(filePath, 'utf8').trim();
  if (!content) return null;

  const lines = content.split('\n').filter(Boolean);
  const events = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {}
  }

  if (events.length === 0) return null;

  // Extract from system/init
  let model = 'unknown';
  let tools = [];
  let mcpServers = [];

  for (const evt of events) {
    if (evt.type === 'system' && evt.subtype === 'init') {
      model = evt.model || 'unknown';
      tools = evt.tools || [];
      mcpServers = evt.mcp_servers || [];
    }
  }

  // Extract from result
  let resultEvt = null;
  for (const evt of events) {
    if (evt.type === 'result') {
      resultEvt = evt;
    }
  }

  if (!resultEvt) return null;

  const usage = resultEvt.usage || {};
  const inputTokens = (usage.input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0) +
    (usage.cache_read_input_tokens || 0);
  const outputTokens = usage.output_tokens || 0;
  const cacheCreation = usage.cache_creation_input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;

  // Extract tool calls
  const toolCalls = [];
  const toolErrors = [];
  let readAppSource = false;

  for (const evt of events) {
    if (evt.type === 'assistant' && evt.message?.content) {
      for (const block of evt.message.content) {
        if (block.type === 'tool_use') {
          toolCalls.push({
            name: block.name,
            input: block.input || {},
          });

          // Check if agent fetched app source
          const input = JSON.stringify(block.input || {});
          if (/\/src\/|\.tsx|\.ts|\.jsx|\.js/.test(input) && /fetch|navigate|url/i.test(block.name)) {
            readAppSource = true;
          }
        }
      }
    }

    // Check for tool errors in tool results
    if (evt.type === 'user' && evt.message?.content) {
      const content = Array.isArray(evt.message.content) ? evt.message.content : [];
      for (const block of content) {
        if (block.type === 'tool_result' && block.is_error) {
          toolErrors.push({
            tool_use_id: block.tool_use_id,
            error: typeof block.content === 'string' ? block.content.substring(0, 200) : JSON.stringify(block.content).substring(0, 200),
          });
        }
      }
    }
  }

  // Count tools
  const toolCounts = {};
  for (const tc of toolCalls) {
    toolCounts[tc.name] = (toolCounts[tc.name] || 0) + 1;
  }

  // Permission denials
  const permissionDenials = resultEvt.permission_denials || [];

  // Extract final answer block
  const resultText = resultEvt.result || '';
  const rootCauseMatch = resultText.match(/ROOT_CAUSE:\s*(.*?)(?=\nEVIDENCE:|\n\n|$)/s);
  const evidenceMatch = resultText.match(/EVIDENCE:\s*(.*?)(?=\nCONFIDENCE:|\n\n|$)/s);
  const confidenceMatch = resultText.match(/CONFIDENCE:\s*(.*?)(?=\nCOULD_NOT_SEE:|\n\n|$)/s);
  const couldNotSeeMatch = resultText.match(/COULD_NOT_SEE:\s*(.*?)$/s);

  const finalBlock = {
    root_cause: rootCauseMatch ? rootCauseMatch[1].trim() : '',
    evidence: evidenceMatch ? evidenceMatch[1].trim() : '',
    confidence: confidenceMatch ? confidenceMatch[1].trim() : '',
    could_not_see: couldNotSeeMatch ? couldNotSeeMatch[1].trim() : '',
  };

  return {
    model,
    wall_time_s: (resultEvt.duration_ms || 0) / 1000,
    num_turns: resultEvt.num_turns || 0,
    finished: resultEvt.subtype === 'success',
    hit_cap: resultEvt.terminal_reason !== 'completed',
    stop_reason: resultEvt.stop_reason || '',
    terminal_reason: resultEvt.terminal_reason || '',
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_creation_tokens: cacheCreation,
    cache_read_tokens: cacheRead,
    total_tokens: inputTokens + outputTokens,
    cost_usd: resultEvt.total_cost_usd || 0,
    tool_calls: toolCalls.map(tc => tc.name),
    tool_counts: toolCounts,
    tool_errors: toolErrors,
    permission_denials: permissionDenials,
    read_app_source: readAppSource,
    final_block: finalBlock,
  };
}

// Main
const files = readdirSync(RAW_DIR).filter(f => f.endsWith('.jsonl') && f.startsWith('trackA-') || f.startsWith('trackB-'));

const summary = {};

for (const file of files) {
  const runId = file.replace('.jsonl', '');
  const filePath = join(RAW_DIR, file);
  const parsed = parseTranscript(filePath);

  if (parsed) {
    summary[runId] = parsed;
  } else {
    summary[runId] = { error: 'Could not parse transcript' };
  }
}

writeFileSync(join(RESULTS_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(`Summarized ${Object.keys(summary).length} runs to results/summary.json`);

// Print quick stats
let finished = 0;
let hitCap = 0;
for (const [id, s] of Object.entries(summary)) {
  if (s.error) continue;
  if (s.finished) finished++;
  if (s.hit_cap) hitCap++;
}
console.log(`Finished: ${finished}, Hit cap: ${hitCap}, Parse errors: ${Object.values(summary).filter(s => s.error).length}`);
