PORT ?= 3000
PID_FILE := .chirp-jobs.pid
LOG_FILE := chirp-jobs.log

.DEFAULT_GOAL := help

.PHONY: help install setup seed start stop restart status dev

help: ## List all make targets
	@echo "Chirp Jobs — available commands:"
	@echo ""
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_.-]+:.*## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST) | sort
	@echo ""
	@echo "Variables: PORT (default $(PORT))"

install: ## Install npm dependencies
	npm install

setup: ## Copy .env.example to .env and install dependencies
	@test -f .env || cp .env.example .env
	npm install
	@if git rev-parse --git-dir >/dev/null 2>&1; then \
		chmod +x .githooks/prepare-commit-msg; \
		git config core.hooksPath .githooks; \
	fi
	@echo "Setup complete. Edit .env if needed, then: make seed && make start"

seed: ## Load admin user, categories, cities, and sample jobs
	node scripts/seed.js

start: ## Start the server in the background (nohup)
	@port_pid=$$(lsof -ti :$(PORT) 2>/dev/null); \
	if [ -n "$$port_pid" ] && [ -f $(PID_FILE) ] && [ "$$port_pid" = "$$(cat $(PID_FILE))" ]; then \
		echo "Already running at http://localhost:$(PORT) (PID $$port_pid)"; \
		exit 0; \
	fi; \
	if [ -n "$$port_pid" ]; then \
		echo "Port $(PORT) is in use by PID $$port_pid (another app?)."; \
		echo "Stop it first, or run: PORT=3001 make start"; \
		exit 1; \
	fi
	@PORT=$(PORT) nohup node src/index.js >> $(LOG_FILE) 2>&1 & echo $$! > $(PID_FILE)
	@sleep 0.5
	@if lsof -ti :$(PORT) >/dev/null 2>&1; then \
		echo "Started at http://localhost:$(PORT) (PID $$(cat $(PID_FILE)))"; \
	else \
		echo "Failed to start — check $(LOG_FILE):"; \
		tail -5 $(LOG_FILE) 2>/dev/null || true; \
		rm -f $(PID_FILE); \
		exit 1; \
	fi

stop: ## Stop the background server
	@if [ -f $(PID_FILE) ]; then \
		kill $$(cat $(PID_FILE)) 2>/dev/null || true; \
		rm -f $(PID_FILE); \
	fi
	@pid=$$(lsof -ti :$(PORT) 2>/dev/null); \
	if [ -n "$$pid" ]; then \
		kill $$pid 2>/dev/null || true; \
		echo "Stopped process on port $(PORT) (PID $$pid)"; \
	else \
		echo "Not running on port $(PORT)"; \
	fi

restart: stop start ## Restart the background server

status: ## Show whether the server is running
	@pid=$$(lsof -ti :$(PORT) 2>/dev/null); \
	if [ -n "$$pid" ]; then \
		echo "Running at http://localhost:$(PORT) (PID $$pid)"; \
	else \
		echo "Not running on port $(PORT)"; \
	fi

dev: ## Run in the foreground with file watch (Ctrl+C to stop)
	PORT=$(PORT) node --watch src/index.js
