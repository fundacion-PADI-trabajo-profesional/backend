.PHONY: up-backend down build restart logs db-push \
        test test-backend test-contracts \
        coverage coverage-backend

# ── Dev local ──────────────────────────────────────────────

up-backend:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

restart:
	docker compose restart backend

logs:
	docker compose logs -f backend

db-push:
	docker compose exec -w /app/functions backend npx prisma db push --schema=prisma/schema.prisma

# ── Tests ──────────────────────────────────────────────────

test: test-backend

test-backend:
	cd functions && npm test

test-contracts:
	cd functions && npm run test:contracts

# ── Coverage ───────────────────────────────────────────────

coverage: coverage-backend

coverage-backend:
	cd functions && npm run test:coverage