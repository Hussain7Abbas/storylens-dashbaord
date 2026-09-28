SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
.DEFAULT_GOAL := help
.PHONY: help install dev build preview typecheck lint format test orval deploy sync
# Show available commands
help:
	@awk '/^# / { description = substr($$0, 3); next } /^[a-zA-Z][a-zA-Z0-9_-]*:/ { if (description != "") printf "  %-14s %s\n", substr($$1, 1, length($$1)-1), description; description = "" }' "$(ROOT)/Makefile"
# Setup: install pinned Bun dependencies
install:
	@cd "$(ROOT)" && bun install --frozen-lockfile
# App: run the development server on http://localhost:3040
dev:
	@cd "$(ROOT)" && bun run dev
# App: typecheck and build the static dashboard into dist/
build:
	@cd "$(ROOT)" && bun run build
# App: preview the production build on http://localhost:4174
preview:
	@cd "$(ROOT)" && bun run preview
# Quality: check TypeScript
typecheck:
	@cd "$(ROOT)" && bun run typecheck
# Quality: check Biome without modifying source
lint:
	@cd "$(ROOT)" && bun run lint
# Quality: format source with Biome
format:
	@cd "$(ROOT)" && bun run format
# Test: run browser and accessibility tests against a mocked API
test:
	@cd "$(ROOT)" && bun run test
# API: regenerate the client from a running backend (ORVAL_API_URL, default http://localhost:3030)
orval:
	@cd "$(ROOT)" && bun run orval
# Deploy: build and atomically activate on the standalone Linux server
deploy:
	@cd "$(ROOT)" && bash deploy/deploy.sh
# Deploy: fast-forward main and deploy on the standalone server
sync:
	@cd "$(ROOT)" && git pull --ff-only origin main && $(MAKE) deploy
