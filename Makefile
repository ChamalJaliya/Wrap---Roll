SHELL := /bin/bash
export PATH := /Applications/Docker.app/Contents/Resources/bin:$(PATH)

DOCKER := $(shell command -v docker 2>/dev/null)
ifeq ($(DOCKER),)
DOCKER := /Applications/Docker.app/Contents/Resources/bin/docker
endif

COMPOSE := $(DOCKER) compose

.PHONY: help docker-check up down restart ps logs logs-api logs-worker build pull config

help:
	@echo "Wrap & Roll Docker shortcuts"
	@echo "Using Docker CLI: $(DOCKER)"
	@echo ""
	@echo "  make up         - Build and start all services (detached)"
	@echo "  make down       - Stop and remove containers"
	@echo "  make restart    - Restart all services"
	@echo "  make ps         - Show service status"
	@echo "  make logs       - Follow logs for all services"
	@echo "  make logs-api   - Follow API logs"
	@echo "  make logs-worker- Follow worker logs"
	@echo "  make build      - Build images"
	@echo "  make pull       - Pull base images"
	@echo "  make config     - Validate/print resolved compose config"

docker-check:
	@if [ ! -x "$(DOCKER)" ]; then \
		echo "Docker CLI not found at $(DOCKER)"; \
		echo "Start Docker Desktop and ensure CLI is installed."; \
		exit 1; \
	fi
	@$(DOCKER) version >/dev/null

up: docker-check
	$(COMPOSE) up -d --build

down: docker-check
	$(COMPOSE) down

restart: down up

ps: docker-check
	$(COMPOSE) ps

logs: docker-check
	$(COMPOSE) logs -f --tail=200

logs-api: docker-check
	$(COMPOSE) logs -f --tail=200 api

logs-worker: docker-check
	$(COMPOSE) logs -f --tail=200 worker

build: docker-check
	$(COMPOSE) build

pull: docker-check
	$(COMPOSE) pull

config: docker-check
	$(COMPOSE) config
