FROM node:17-buster

RUN apt update
RUN apt install -y \
    python3-pip \
    brotli

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
RUN apt install -y ./google-chrome-stable_current_amd64.deb

ENV CONTAINERIZED=true

RUN pip3 install sultan
