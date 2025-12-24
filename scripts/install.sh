#!/usr/bin/env sh
set -e

# Simple installer script for the mcp-server project
# Usage: sh ./scripts/install.sh [--register]
# If --register is passed, the script will attempt to register the server with the
# Gemini CLI (requires `gemini` on PATH and user confirmation may be required).

echo "==> Installing mcp-server dependencies"
npm ci

echo "==> Setup complete. Next steps:"
echo "  - Start the server: npm run start:bg"
echo "  - Stop the server: npm run stop"
echo "  - Register with Gemini: npm run register"

if [ "$1" = "--register" ] || [ "$1" = "-r" ] ; then
  if command -v gemini >/dev/null 2>&1; then
    echo "==> Attempting to register with Gemini (project-scoped)"
    gemini mcp add -s project local-mcp node src/server.js --cwd ./mcp-server --description "Local project MCP server (stdio)" || {
      echo "Registration failed or was cancelled by the Gemini CLI; you can run 'npm run register' manually later.";
      exit 0
    }
    echo "Registration succeeded (or was accepted by Gemini)."
  else
    echo "Gemini CLI not found on PATH; install @google/gemini-cli to use registration."
  fi
fi

echo "Done."