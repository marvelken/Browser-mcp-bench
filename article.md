# Field log: Chrome vs Safari vs Firefox debugging MCPs

## 1. Environment

- **Machine:** Apple M4, 16 GB RAM
- **OS:** macOS 26.6.2 (Build 25G83)
- **Safari:** 26.6.2 (21624.5.1.11.3) -- NOT 27+. `safaridriver --mcp` is NOT available.
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

## 3. Setup notes per tool

### Safari
- `safaridriver --mcp` does not exist on Safari 26.6.2.
- `/usr/bin/safaridriver` is a symlink to `/System/Cryptexes/App/usr/bin/safaridriver`.
- No alternative path works. The `--mcp` flag is simply not in this build.
- Blocker: need Safari 27+.

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
(to be filled in Phase 1)

## 5. Fixed cost per MCP
| Config | Tools exposed | Input tokens on a one-word prompt | Extra tokens vs no MCP |
| --- | --- | --- | --- |

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
