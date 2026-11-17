# Music Room — `make help`
.PHONY: help install start dev test bench mobile-install mobile clean
help:
	@echo "make install         install backend dependencies (npm ci / install)"
	@echo "make start           run the API on http://localhost:4000 (docs: /docs)"
	@echo "make test            unit + integration tests (node:test)"
	@echo "make bench           load test (autocannon) -> see docs/PERFORMANCE.md"
	@echo "make mobile-install  install the Expo (React Native) app dependencies"
	@echo "make mobile          start the Expo dev server (Android / iOS / web)"

install:
	cd backend && npm install
start: install
	@test -f .env || cp .env.example .env
	cd backend && npm start
dev: install
	@test -f .env || cp .env.example .env
	cd backend && npm run dev
test: install
	cd backend && npm test
bench: install
	cd backend && npm run bench
mobile-install:
	cd mobile && npm install
mobile: mobile-install
	cd mobile && npx expo start
clean:
	rm -rf backend/node_modules mobile/node_modules data logs
