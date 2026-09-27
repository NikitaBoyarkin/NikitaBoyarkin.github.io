.PHONY: dev build preview check

dev:
	bun run dev

build:
	bun run build

preview:
	bun run preview

check:
	bun run check
	bun run test
	bun run test:monitoring
	bun run test:built
	python3 scripts/check_site.py
