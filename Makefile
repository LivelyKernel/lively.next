.PHONY: clear-esm-cache start install hooks docker-build docker-start docker-watch docker-bash docker-stop
clear-esm-cache:
	rm -rf esm_cache
	mkdir esm_cache

start:
	./start.sh

hooks:
	git config --local core.hooksPath $(shell pwd)/.githooks

docker-build:
	docker rm lively.next || true
	docker build -t lively:latest .
	docker run -p 127.0.0.1:9011:9011 -v $(CURDIR):/lively.next:z -w /lively.next --name lively.next lively:latest ./install.sh
	docker commit lively.next lively:latest
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
