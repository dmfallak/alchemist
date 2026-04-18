.PHONY: build test clean install run help

# Default target
help:
	@echo "Project Alchemist Build System"
	@echo ""
	@echo "Usage:"
	@echo "  make build    - Compile TypeScript to JavaScript"
	@echo "  make test     - Run the test suite"
	@echo "  make clean    - Remove build artifacts"
	@echo "  make install  - Install dependencies"
	@echo "  make run      - Build and run the alchemy CLI (usage: make run ARGS='plan \"Title\"')"

# Install dependencies
install:
	npm install

# Build the project
build:
	npm run build

# Run tests
test:
	npm run test

# Clean build artifacts
clean:
	rm -rf dist/

# Build and run the CLI
run: build
	node dist/cli/index.js $(ARGS)
