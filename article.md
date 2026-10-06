# Field log: Chrome vs Safari vs Firefox debugging MCPs

## 1. Environment

- **Machine:** Apple M4, 16 GB RAM
- **OS:** macOS 26.6.2 (Build 25G83)
- **Safari:** 27.0 (21625.1.29.18.28) -- upgraded from 26.6.2 during Phase 0. `safaridriver --mcp` works.
- **Chrome:** 154.0.8037.98
- **Firefox:** 157.0
- **Node:** v22.14.0
- **npm:** 10.9.2
- **Claude Code:** 2.1.97
- **Model:** (will be read from system/init events; expected Opus 4.6)
- **`~/.claude/CLAUDE.md`:** does not exist

### Pinned package versions

| Package | Pinned version |
| --- | --- |
| `chrome-devtools-mcp` | 1.10.1 |
| `@mozilla/firefox-devtools-mcp` | 0.10.4 |
| `react-devtools-cdt-mcp` | 0.1.0 |
| `agent-react-devtools` | 0.5.0 |

### Safari --mcp check

- Command: `safaridriver --mcp`
- Result: FAIL
- Exact output: `safaridriver: unrecognized option '--mcp'`
- safaridriver help lists these flags only: `--help`, `--version`, `--port`, `--bidi`, `--enable`, `--diagnose`
- Safari 27 is required for MCP support. This machine has Safari 26.6.2.
- The Safari MCP track cannot run unless the human upgrades to Safari 27 or later.

## 2. Running log

### [Phase 0] Environment collection
- Command: `sw_vers`, `node --version`, `npm --version`, `claude --version`, browser version checks, `npm view <pkg> version`
- Result: PASS
- All versions collected. See section 1.

### [Phase 0] safaridriver --mcp test
- Command: `safaridriver --mcp`
- Result: FAIL
- Exact output: `safaridriver: unrecognized option '--mcp'`
- What I changed next: Logged the failure. Safari track blocked until Safari 27+ is installed.

### [Phase 0] Doc check
- Fetched READMEs for all 5 tools via WebFetch.
- Result: PASS for Chrome, Firefox, React layer A, React layer B. Safari docs fetched from Apple .md URL.
- Key differences from prompt claims:
  - React layer A has 12 tools, not 10. Extra: `react_get_component_by_dom_element`, `react_get_parent_stack`.
  - `--categoryExperimentalThirdParty` is documented in the react-devtools-cdt-mcp README, not the Chrome MCP README.
  - Safari requires Safari 27+. We have 26.6.2. BLOCKER.
  - Firefox `basic` preset (default) lacks network/console/profiler. Confirmed. Must use `developer`.
- `gh` CLI is not installed on this machine. Used WebFetch for all doc fetches.

### [Phase 1] App built
- Stack: Vite 8.3.2, React 19.3.0, TypeScript 6.0.2
- React Compiler OFF, StrictMode OFF
- Mock API: Vite middleware plugin with fixed delays (350 ms stats, 80 ms others)
- All 4 bugs planted and verified via API:
  - Bug 1: sequential stats take ~3160 ms (confirmed)
  - Bug 2: long project name with nowrap + no min-width:0 on flex item
  - Bug 3: project 5 returns `{data:{...}}` instead of `{revenue,...}` (confirmed)
  - Bug 4: context provider creates new value object on every render, 300 memo'd rows re-render
- Three run modes: `npm run dev`, `npm run dev:cdt`, `npm run dev:ard`
- Installed: react-devtools-cdt-mcp@0.1.0, agent-react-devtools@0.5.0
- No debug globals, no bug-hinting names, no comments naming bugs

### [Phase 0] Safari upgrade
- Command: `softwareupdate --install "Safari27.0TahoeAuto-27.0"`
- Result: PASS
- Safari upgraded from 26.6.2 to 27.0 (21625.1.29.18.28). No restart needed.
- `safaridriver --mcp` now works. Clean exit code 0, no error output.

## 3. Setup notes per tool

### Safari (safaridriver --mcp, Safari 27.0)
- Initially Safari 26.6.2. `safaridriver --mcp` returned `unrecognized option '--mcp'`.
- Upgraded to Safari 27.0 via `softwareupdate --install "Safari27.0TahoeAuto-27.0"` (standalone, no restart).
- `/usr/bin/safaridriver --mcp` now works. Clean exit, no errors.
- Config: `{ "command": "/usr/bin/safaridriver", "args": ["--mcp"] }`
- First action in a session must be a navigation. Other actions before that may return an error.
- 17 tools exposed (from Apple docs): browser_console_messages, browser_dialogs, close_tab, create_tab, evaluate_javascript, get_network_request, get_page_content, list_network_requests, list_tabs, navigate_to_url, page_info, page_interactions, screenshot, set_emulated_media, set_viewport_size, switch_tab, wait_for_navigation.

### Chrome (chrome-devtools-mcp 1.10.1)
- Start: `npx -y chrome-devtools-mcp@1.10.1`
- Flags used: `--isolated`, `--no-usage-statistics`, `--no-performance-crux`
- For React layer A: add `--categoryExperimentalThirdParty=true`
- Chrome requirement: current stable or newer (we have 154.0.8037.98)
- Default is headed mode. `--headless` is an option but we run headed.
- Full tool list not in README. References docs/tool-reference.md. Will get actual list from smoke test.
- Docs also mention: `--slim`, `--no-update-checks`

### Firefox (@mozilla/firefox-devtools-mcp 0.10.4)
- Start: `npx @mozilla/firefox-devtools-mcp@0.10.4`
- Flags used: `--tool-preset developer --viewport 1280x720`
- Presets (cumulative): slim (pages, snapshot, input, screenshot) < basic (default, adds downloads, script, utilities, management, webextension, screencast) < developer (adds debugging, network, console, profiler) < mozilla (adds launch, prefs, privileged) < all
- The `basic` default has NO network, console, or profiler. Must use `developer` for scored runs.
- Firefox requirement: 100+ (we have 157.0). Node 20.19.0+ (we have 22.14.0).
- Other flags: `--firefox-path`, `--profile-path`, `--start-url`, `--accept-insecure-certs`, `--connect-existing`, `--marionette-port`, `--pref`, `--log-file`, `--unrestricted-save-paths`

### React layer A (react-devtools-cdt-mcp 0.1.0)
- Install: `npm install react-devtools-cdt-mcp`
- Import line: `import 'react-devtools-cdt-mcp/register';` -- must come BEFORE importing React.
- Chrome-only. Requires chrome-devtools-mcp 1.3.0+ (we have 1.10.1) and `--categoryExperimentalThirdParty=true`.
- Accessed through `list_3p_developer_tools` and `execute_3p_developer_tool` on the Chrome MCP.
- Tools registered (12, not 10 as prompt claimed):
  1. `react_get_component_tree`
  2. `react_get_component_by_uid`
  3. `react_get_component_by_dom_element`
  4. `react_find_components`
  5. `react_get_component_source`
  6. `react_get_owner_stack_trace`
  7. `react_get_parent_stack`
  8. `react_get_owner_stack`
  9. `react_start_profiling`
  10. `react_stop_profiling`
  11. `react_get_trace_overview`
  12. `react_get_commit_report`
- Prompt claimed 10 tools. Docs show 12. Extra: `react_get_component_by_dom_element`, `react_get_parent_stack`.

### React layer B (agent-react-devtools 0.5.0)
- Install: `npm install -g agent-react-devtools` or `npx agent-react-devtools start`
- NOT an MCP server. It is a CLI tool.
- Daemon runs on port 8097 by default. Survives across CLI calls.
- Vite plugin: `import { reactDevtools } from "agent-react-devtools/vite";` in vite.config.ts, placed before `react()`.
- Must use headed mode. Headless Chromium does not properly execute the devtools connect script.
- Agent interacts via shell commands like `agent-react-devtools get tree`, `find`, `profile`.

## 4. Planted bugs

### Stack
- Vite 8.3.2, React 19.3.0, TypeScript 6.0.2
- React Compiler: OFF (could fix bug 4 by itself)
- StrictMode: OFF (doubles effects in dev, would muddy network log)
- Mock API: Vite middleware plugin, fixed 350 ms delay per stats call, 80 ms for other endpoints

### Bug 1: Network waterfall
**File:** `src/components/CardRow.tsx`
**Symptom:** Stats take about 3 seconds to appear after page load.
```typescript
// CardRow.tsx, load function inside useEffect
async function load() {
  const userRes = await fetch('/api/user');
  await userRes.json();
  const projRes = await fetch('/api/projects');
  const projData = await projRes.json();
  setProjects(projData);
  const map = {};
  for (const p of projData) {
    const statsRes = await fetch(`/api/projects/${p.id}/stats`);
    const statsData = await statsRes.json();
    map[p.id] = statsData;
  }
  setStatsMap(map);
}
```
Verified: sequential API calls take ~3160 ms. Parallel would take ~350 ms.

### Bug 2: CSS layout break
**File:** `src/components/ProjectCard.tsx`
**Symptom:** Page scrolls sideways at 1280x720.
```typescript
// ProjectCard.tsx - card container
<div style={{ flex: 1, border: '1px solid #ddd', borderRadius: 8, padding: '1rem', background: '#fff' }}>
  <div style={{ whiteSpace: 'nowrap', fontWeight: 600, fontSize: '1rem' }}>
    {project.name}  // Project 3: "InfrastructureMonitoringDashboardForProductionServices"
  </div>
```
No `min-width: 0` on the flex item. The long name with `white-space: nowrap` prevents shrinking.

### Bug 3: Console error with hidden cause
**Files:** `src/api/server.ts` (response), `src/components/StatDisplay.tsx` (crash)
**Symptom:** One card shows "Something went wrong".
```typescript
// server.ts - project 5 returns a different shape
function makeStatsForProject5() {
  return { data: { revenue: 68000, users: 1850, growth: 4.2, tickets: 22 } };
}
// All other projects return: { revenue, users, growth, tickets }

// StatDisplay.tsx - crashes on undefined
<div>Growth: {stats.growth.toFixed(1)}%</div>
// stats.growth is undefined because stats is { data: { ... } }
```

### Bug 4: Re-render cascade
**Files:** `src/context/AppContext.tsx` (provider), `src/components/ActivityTable.tsx` (consumer), `src/components/NotesBox.tsx` (trigger)
**Symptom:** Typing in the notes box lags.
```typescript
// AppContext.tsx - new value object every render
<AppContext.Provider value={{ user, theme, draftNote, setDraftNote }}>
  {children}
</AppContext.Provider>

// ActivityTable.tsx - memo'd row reads context
const TableRow = memo(function TableRow({ row }) {
  const { theme } = useAppContext();  // context change bypasses memo
  const dateFmt = new Intl.DateTimeFormat(...);  // expensive per render
  const costFmt = new Intl.NumberFormat(...);
  // ...
});
```
1500 rows re-render on every keystroke. `memo` does not block context updates.
Each row creates ~12 Intl formatters (5 locales x currency + date + relative time + collator + percent + 2 number). Bumped from 300 to 1500 rows because M4 handled 300 without visible lag.

## 5. Fixed cost per MCP
| Config | Tools exposed | Input tokens on a one-word prompt | Extra tokens vs no MCP |
| --- | --- | --- | --- |
| No MCP (baseline) | 0 | 5,807 | 0 |
| Chrome | 30 | 13,604 | +7,797 |
| Chrome + React layer A | 32 | 14,001 | +8,194 |
| Firefox (developer preset) | 48 | 14,014 | +8,207 |
| Safari | 17 | 9,653 | +3,846 |

All measured with `--tools "" --strict-mcp-config`. Model: claude-opus-4-6.

Chrome tools (30): click, close_page, drag, emulate, evaluate_script, fill, fill_form, get_console_message, get_css_styles, get_network_request, handle_dialog, hover, lighthouse_audit, list_console_messages, list_network_requests, list_pages, navigate_page, new_page, performance_analyze_insight, performance_start_trace, performance_stop_trace, press_key, resize_page, select_page, take_heapsnapshot, take_screenshot, take_snapshot, type_text, upload_file, wait_for.

Chrome + React adds: list_3p_developer_tools, execute_3p_developer_tool.

Firefox developer preset (48): accept_dialog, clear_downloads, clear_snapshot, click_by_uid, close_firefox_session, close_page, dismiss_dialog, drag_by_uid_to_uid, evaluate_script, fill_by_uid, fill_form_by_uid, get_console_messages, get_console_output, get_firefox_info, get_firefox_output, get_network_request, get_page_text, hover_by_uid, install_extension, list_downloads, list_network_requests, list_pages, navigate_history, navigate_page, new_page, press_key, resolve_uid_to_selector, screencast_start, screencast_stop, screenshot_by_uid, screenshot_page, select_page, set_download_behavior, set_viewport_size, take_snapshot, type_text, uninstall_extension, upload_file_by_uid, and more.

Safari (17): browser_console_messages, browser_dialogs, close_tab, create_tab, evaluate_javascript, get_network_request, get_page_content, list_network_requests, list_tabs, navigate_to_url, page_info, page_interactions, screenshot, set_emulated_media, set_viewport_size, switch_tab, wait_for_navigation.

Note: Firefox developer preset showed 0 tools at init in quick smoke (MCP still connecting) but 48 in the fixed-cost test. The server takes longer to start than Chrome or Safari.

### Smoke real runs (bug 3, one per browser, unscored)
All three correctly diagnosed bug 3 (different API shape for project 5) with high confidence.
- Chrome: 13 turns, 64s, 158k input + 2k output tokens
- Safari: 25 turns, 175s, 311k input + 3k output tokens
- Firefox: 12 turns, 59s, 104k input + 1.4k output tokens

Safari was notably slower (25 turns vs 12-13). Chrome and Firefox both found it quickly.

## 6. Track A results: browser MCP alone
| Bug | Browser | Scores per run | Median time | Median turns | Median total tokens | Hit a cap |
| --- | --- | --- | --- | --- | --- | --- |

## 7. Track B results: React layer on bug 4
| Setup | Scores per run | Median time | Median turns | Median total tokens |
| --- | --- | --- | --- | --- |

## 8. What each tool could not see

## 9. Failures worth telling

## 10. Surprises

## 11. Quotable moments

## 12. Score table

## 13. Grades that need human review

## 14. Diagrams

## 15. Screenshots needed

## 16. Limits of this test

## 17. How to reproduce
