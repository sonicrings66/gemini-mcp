import path from 'path';
import fs from 'fs/promises';
import { execa } from 'execa';
import simpleGit from 'simple-git';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const cwd = process.cwd();
const git = simpleGit({ baseDir: cwd });

function safeJoinRepo(target) {
  const resolved = path.resolve(cwd, target);
  if (!resolved.startsWith(cwd)) throw new Error('Path outside repo not allowed');
  return resolved;
}

function textContent(text) {
  return { content: [{ type: 'text', text }] };
}

const server = new McpServer({ name: 'local-mcp', version: '0.1.0' });

// file_read: read files under repo
server.registerTool(
  'file_read',
  {
    title: 'Read file in repo',
    description: 'Read a file from the repository (safe, read-only)',
    argsSchema: z.object({ path: z.string() })
  },
  async ({ path: filePath }) => {
    try {
      const resolved = safeJoinRepo(filePath);
      const stats = await fs.stat(resolved);
      if (stats.size > 200 * 1024) return textContent('File too large to return (>200KB)');
      const content = await fs.readFile(resolved, 'utf8');
      return textContent(content);
    } catch (e) {
      return textContent(`Error reading file: ${String(e.message)}`);
    }
  }
);

// file_write: gated by env var ENABLE_MCP_FILE_WRITE=1
server.registerTool(
  'file_write',
  {
    title: 'Write file (restricted)',
    description: 'Write to a file inside repo (disabled by default for safety). Enable with ENABLE_MCP_FILE_WRITE=1',
    argsSchema: z.object({ path: z.string(), content: z.string() })
  },
  async ({ path: filePath, content }) => {
    if (!process.env.ENABLE_MCP_FILE_WRITE) return textContent('file_write is disabled on this server');
    try {
      const resolved = safeJoinRepo(filePath);
      await fs.writeFile(resolved, content, 'utf8');
      return textContent('Write successful');
    } catch (e) {
      return textContent(`Error writing file: ${String(e.message)}`);
    }
  }
);

// run_script: run npm scripts declared in package.json at repo root
server.registerTool(
  'run_script',
  {
    title: 'Run npm script',
    description: 'Run a script from package.json (whitelisted to scripts defined there)',
    argsSchema: z.object({ script: z.string() })
  },
  async ({ script }) => {
    try {
      const pkgPath = path.join(cwd, 'package.json');
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
      if (!pkg.scripts || !pkg.scripts[script]) return textContent(`Script '${script}' not found in package.json`);

      const proc = execa('npm', ['run', script], { cwd, all: true });
      let all = '';
      proc.all?.on('data', (d) => { all += d.toString(); });
      const { exitCode } = await proc;
      return textContent(`Exit code: ${exitCode}\n\n${all}`);
    } catch (e) {
      return textContent(`Error running script: ${String(e.message)}`);
    }
  }
);

// run_tests: run 'npm test' directly
server.registerTool(
  'run_tests',
  {
    title: 'Run tests',
    description: 'Run project tests (npm test by default)',
    argsSchema: z.object({}).optional()
  },
  async () => {
    try {
      const proc = execa('npm', ['run', 'test'], { cwd, all: true });
      let all = '';
      proc.all?.on('data', (d) => { all += d.toString(); });
      const { exitCode } = await proc;
      return textContent(`Exit code: ${exitCode}\n\n${all}`);
    } catch (e) {
      return textContent(`Error running tests: ${String(e.message)}`);
    }
  }
);

// lint: run 'npm run lint' directly
server.registerTool(
  'lint',
  {
    title: 'Run linter',
    description: 'Run project linter (npm run lint)',
    argsSchema: z.object({}).optional()
  },
  async () => {
    try {
      const proc = execa('npm', ['run', 'lint'], { cwd, all: true });
      let all = '';
      proc.all?.on('data', (d) => { all += d.toString(); });
      const { exitCode } = await proc;
      return textContent(`Exit code: ${exitCode}\n\n${all}`);
    } catch (e) {
      return textContent(`Error running lint: ${String(e.message)}`);
    }
  }
);

// git_status
server.registerTool(
  'git_status',
  {
    title: 'Git status',
    description: 'Show git status for the repo',
    argsSchema: z.object({}).optional()
  },
  async () => {
    try {
      const status = await git.status();
      return textContent(JSON.stringify(status, null, 2));
    } catch (e) {
      return textContent(`Error getting git status: ${String(e.message)}`);
    }
  }
);

// git_log
server.registerTool(
  'git_log',
  {
    title: 'Git log',
    description: 'Get recent git commits',
    argsSchema: z.object({ max: z.number().optional().default(10) })
  },
  async ({ max }) => {
    try {
      const log = await git.log({ maxCount: max || 10 });
      return textContent(JSON.stringify(log.all.slice(0, max || 10), null, 2));
    } catch (e) {
      return textContent(`Error getting git log: ${String(e.message)}`);
    }
  }
);

// Helpful prompt
server.registerPrompt(
  'describe-repo',
  {
    title: 'Describe repository',
    description: 'Describe repository files and status',
    argsSchema: z.object({}).optional()
  },
  async () => ({ messages: [{ role: 'user', content: { type: 'text', text: 'Summarize the repository and git status' } }] })
);

const transport = new StdioServerTransport();

(async () => {
  try {
    await server.connect(transport);
    console.error('MCP server connected via stdio');
  } catch (e) {
    console.error('Failed to start MCP server:', e);
    process.exit(1);
  }
})();
