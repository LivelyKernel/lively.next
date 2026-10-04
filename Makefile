BUN ?= bun

.PHONY: clear-esm-cache clear-headless-cache start install hooks loading-screen landing-page freezer-unified freezer-unified-debug clear-freezer-dir clean clean-install
clear-esm-cache:
	rm -rf esm_cache
	mkdir esm_cache

clear-headless-cache:
	rm -r lively.headless/chrome-data-dir
	mkdir lively.headless/chrome-data-dir && touch lively.headless/chrome-data-dir/.gitkeep

# New unified build - builds both landing-page and loading-screen in one pass
artifacts: classes-runtime freezer-unified

classes-runtime:
	rm -rf lively.server/.module_cache
	rm -rf lively.classes/build
	env CI=true $(BUN) run --cwd lively.classes build

# Unified build - faster than building landing-page and loading-screen separately
freezer-unified:
	rm -rf lively.server/.module_cache
	rm -rf lively.freezer/landing-page
	rm -rf lively.freezer/loading-screen
	env CI=true $(BUN) run --cwd lively.freezer build-unified

freezer-unified-debug:
	rm -rf lively.server/.module_cache
	rm -rf lively.freezer/landing-page
	rm -rf lively.freezer/loading-screen
	env CI=true DEBUG=true $(BUN) run --cwd lively.freezer build-unified

# Legacy targets - kept for backward compatibility (but consider using freezer-unified instead)
landing-page:
	rm -rf lively.server/.module_cache
	rm -rf lively.freezer/landing-page
	env CI=true $(BUN) run --cwd lively.freezer build-landing-page

landing-page-debug:
	rm -rf lively.server/.module_cache
	rm -rf lively.freezer/landing-page
	env CI=true DEBUG=true $(BUN) run --cwd lively.freezer build-landing-page

loading-screen:
	rm -rf lively.server/.module_cache
	rm -rf lively.freezer/loading-screen
	env CI=true $(BUN) run --cwd lively.freezer build-loading-screen

loading-screen-debug:
	rm -rf lively.server/.module_cache
	rm -rf lively.freezer/loading-screen
	env CI=true DEBUG=true $(BUN) run --cwd lively.freezer build-loading-screen

clear-freezer-dir:
	rm -rf lively.freezer/landing-page
	rm -rf lively.freezer/loading-screen

hooks:
	git config --local core.hooksPath $(shell pwd)/.githooks

install:
	./install.sh

clean: clear-freezer-dir clear-headless-cache clear-esm-cache
	rm -rf lively.server/.module_cache
	rm -rf .module_cache
	rm -rf node_modules lively.*/node_modules lively-system-interface/node_modules mocha-es6/node_modules
	find lively.* lively-system-interface mocha-es6 -name ".cachedImportMap.json" -type f -delete

clean-install: clean
	./install.sh