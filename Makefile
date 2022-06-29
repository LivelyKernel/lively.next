.PHONY: clear-esm-cache start install hooks docker-build docker-start docker-watch docker-bash docker-stop
clear-esm-cache:
	rm -rf esm_cache
	mkdir esm_cache

start:
	./start.sh

hooks:
	git config --local core.hooksPath $(shell pwd)/.githooks

docker-build:
	# Builds the image our containers are based on, including all dependencies which are not installed via flatn
	docker build -t lively:latest .
	# Delete old lively.next container in case we previously had containers on this system
	docker rm lively.next || true
	# Mounts the lively root directory inside of a container and runs the install script, which installs flatns deps
	# Since we are CONTAINERIZED, the last step of the install script will be running chmod a+rwx on all files in the lively folder
	docker run -p 127.0.0.1:9011:9011 -v $(CURDIR):/lively.next:z -w /lively.next --name lively.next lively:latest ./install.sh
	# Convert the changes resulting from the lines above back into the lively image
	# Not doing this results in problems when running headless sessions inside of the docker containers 
	docker commit lively.next lively:latest
	# Build a new lively container which is bound to start.sh which will be used for all future operations
	docker rm lively.next || true
	docker run -p 127.0.0.1:9011:9011 -v $(CURDIR):/lively.next:z -w /lively.next --name lively.next  lively:latest ./start.sh

docker-start:
	docker start lively.next

docker-watch:
	docker exec lively.next cat /proc/1/fd/1

docker-bash:
	docker exec -ti lively.next bash

docker-stop:
	docker stop lively.next
