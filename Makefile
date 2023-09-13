.PHONY: clear-esm-cache clear-headless-cache start install hooks loading-screen landing-page clear-freezer-dir
clear-esm-cache:
	rm -rf esm_cache
	mkdir esm_cache

clear-headless-cache:
	rm -r lively.headless/chrome-data-dir
	mkdir lively.headless/chrome-data-dir && touch lively.headless/chrome-data-dir/.gitkeep

start:
	./start.sh

artifacts: classes-runtime landing-page loading-screen

classes-runtime:
	rm -rf lively.classes/build
	env CI=true npm --prefix lively.classes run build

landing-page:
	rm -rf lively.freezer/landing-page
	env CI=true npm --prefix lively.freezer run build-landing-page

loading-screen:
	rm -rf lively.freezer/loading-screen
	env CI=true npm --prefix lively.freezer run build-loading-screen

clear-freezer-dir:
	rm -rf lively.freezer/landing-page
	rm -rf lively.freezer/loading-screen

hooks:
	git config --local core.hooksPath $(shell pwd)/.githooks
