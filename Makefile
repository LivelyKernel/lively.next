.PHONY: clear-esm-cache clear-headless-cache start install hooks docker-build-prepare docker-start docker-watch docker-bash docker-stop
clear-esm-cache:
	rm -rf esm_cache
	mkdir esm_cache

clear-headless-cache:
	rm -r lively.headless/chrome-data-dir
	mkdir lively.headless/chrome-data-dir && touch lively.headless/chrome-data-dir/.gitkeep

start:
	./start.sh

hooks:
	git config --local core.hooksPath $(shell pwd)/.githooks

docker-build-prepare:
	# Builds the image our containers are based on, including all dependencies which are not installed via flatn
	docker build -t lively:latest .
	# Delete old lively.next container in case we previously had containers on this system
	docker rm lively.next || true

# Mounts the lively root directory inside of a container and runs the install script, which installs flatns deps
# Using the host user and group id leads to correct permissions on files created inside of the container
# Fot not entirely clear reasons it is important that the absolute path to lively is the same on the host and inside of containers
# Otherwise, DAV dirLists might produce nonsense.
# Inside of CI, we need to ommit the -it flag, as its used to make the installation canceable with Strg+C, but this only works in TTYs.
# However, CI does not provide one. 
ifeq ($(GITHUB_ACTIONS),true)
docker-install:
	docker run -p 127.0.0.1:9011:9011 -v $(shell pwd):$(shell pwd):z -w $(shell pwd) --user $(shell id -u):$(shell id -g) lively:latest ./install.sh
else
docker-install:
	docker run -it -p 127.0.0.1:9011:9011 -v $(shell pwd):$(shell pwd):z -w $(shell pwd) --user $(shell id -u):$(shell id -g) lively:latest ./install.sh
endif

ifeq ($(GITHUB_ACTIONS),true)
docker-build-start:
	docker run -p 127.0.0.1:9011:9011 -v $(shell pwd):$(shell pwd):z -w $(shell pwd) --name lively.next --user $(shell id -u):$(shell id -g)  lively:latest ./start.sh
else
docker-build-start:
	docker run -it -p 127.0.0.1:9011:9011 -v $(shell pwd):$(shell pwd):z -w $(shell pwd) --name lively.next --user $(shell id -u):$(shell id -g)  lively:latest ./start.sh
endif

docker-build-only: docker-build-prepare docker-install

docker-build: docker-build-prepare docker-install docker-build-start

docker-start:
	docker start lively.next

docker-watch:
	docker exec lively.next cat /proc/1/fd/1

docker-bash:
	docker exec -ti lively.next bash

docker-stop:
	docker stop lively.next
