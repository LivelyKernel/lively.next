.PHONY: clear-esm-cache start install hooks
clear-esm-cache:
	rm -rf esm_cache
	mkdir esm_cache

start:
	./start.sh

hooks:
	git config --local core.hooksPath $(shell pwd)/.githooks

