FROM node:18-buster

RUN apt update
RUN apt install -y \
    python3-pip \
    brotli \
    aspell

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# Skip minification of bundle code (loading screen...)
ENV CI=true

RUN apt install -y chromium

ENV CONTAINERIZED=true

RUN pip3 install sultan
