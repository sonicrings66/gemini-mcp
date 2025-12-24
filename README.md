# Local MCP server for Gemini CLI

![MCP smoke test](https://github.com/sonicrings66/gemini-mcp/actions/workflows/mcp-smoke.yml/badge.svg)
![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)

This repository contains a small, safe local MCP (Model Context Protocol) server
that exposes developer tools to the Gemini CLI. Use it to let Gemini inspect and
help with your local project.

Repository: `sonicrings66/gemini-mcp`

---

## Tools provided

- `file_read` — Read files inside the project (safe, read-only). Files above the
  server's working directory are not allowed.
- `file_write` — Write to files inside the project (disabled by default).
  Enable by setting the environment variable `ENABLE_MCP_FILE_WRITE=1`.
- `run_script` — Run npm scripts defined in `package.json` (e.g., `build`,
  `start`, `test`). Returns combined stdout/stderr and exit code.
- `run_tests` — Convenience tool that runs `npm test`.
- `lint` — Runs `npm run lint`.
- `git_status`, `git_log` — Git helpers (require the working directory to be a
  git repository).
- `describe-repo` — A reusable prompt that asks Gemini to summarize the
  repository.

---

## Quick start (local)

1. Install dependencies:

```bash
cd mcp-server
npm install
```

2. Start the server (stdio transport):

```bash
npm start
# or
node src/server.js
```

3. From the project root, register the server with Gemini (project scope):

```bash
cd ..  # project root
gemini mcp add -s project local-mcp node src/server.js --cwd ./mcp-server --description "Local project MCP server (stdio)"
```

4. Verify discovery and list tools:

```bash
gemini mcp list
# or inside Gemini: /mcp
```

5. Example: Run tests via Gemini:

```bash
gemini -p "/run_tests" --output-format json
```

---

## Enabling file writes (opt-in)

This server is read-first by default to avoid accidental edits. To allow file
modifications via the `file_write` tool, set this environment variable when
starting the MCP server:

```bash
export ENABLE_MCP_FILE_WRITE=1
node src/server.js
```

Only enable this for trusted environments.

---

## CI smoke test (GitHub Actions)

A smoke test workflow is included at `.github/workflows/mcp-smoke.yml`. It:

- Installs Node.js
- Installs `mcp-server` dependencies
- Starts the MCP server and waits for the "MCP server connected via stdio"
  message
- Fails the job if the server does not start within 15 seconds

This validates the server can start in CI and prevents regressions.

---

## Security notes

- The server **disallows** reading or writing files outside its working
  directory.
- Do **not** enable `file_write` unless you trust the environment and users.
- Keep `trust` disabled in `~/.gemini/settings.json` or project settings; the
  Gemini CLI will then ask for confirmation before running tools.

---

## Development

- Run `npm start` to run the server locally and check stderr logs for
  `MCP server connected via stdio`.
- Add tools in `src/server.js` using `server.registerTool()` and `server.registerPrompt()`.

---

If you'd like, I can add extra tools (formatting, coverage, test reporters) or
scaffold a GitHub Action that runs an end-to-end Gemini CLI check on PRs.