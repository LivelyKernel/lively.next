# syntax=docker/dockerfile:1.7

############################
# Base image with common deps
############################
FROM ubuntu:24.04 AS base

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Etc/UTC \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    SHELL=/bin/bash

# Common system/dev tooling
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    git \
    gnupg \
    dirmngr \
    bash \
    coreutils \
    findutils \
    sed \
    gawk \
    grep \
    less \
    nano \
    vim-tiny \
    jq \
    unzip \
    zip \
    xz-utils \
    tar \
    gzip \
    bzip2 \
    procps \
    psmisc \
    file \
    which \
    perl \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    python3-setuptools \
    python3-wheel \
    python3-full \
    build-essential \
    pkg-config \
    make \
    cmake \
    gcc \
    g++ \
    libc6-dev \
    libssl-dev \
    zlib1g-dev \
    libbz2-dev \
    libreadline-dev \
    libsqlite3-dev \
    libffi-dev \
    liblzma-dev \
    libncursesw5-dev \
    libxml2-dev \
    libxmlsec1-dev \
    brotli \
    aspell \
    entr \
    iproute2 \
    net-tools \
    openssh-client \
    rsync \
    socat \
    lsof \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install --break-system-packages --no-cache-dir \
    virtualenv \
    pipx \
    sultan \
    requests \
    pyyaml \
    toml \
    rich \
    ipython

# nvm + Node 24
ENV NVM_DIR=/usr/local/nvm
ENV NODE_VERSION=24
SHELL ["/bin/bash", "-lc"]


RUN mkdir -p "${NVM_DIR}" \
 && curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash \
 && source "${NVM_DIR}/nvm.sh" \
 && nvm install "${NODE_VERSION}" \
 && nvm alias default "${NODE_VERSION}" \
 && nvm use default \
 && npm install -g npm@latest \
 && ln -sf "${NVM_DIR}/versions/node/$(bash -lc 'source ${NVM_DIR}/nvm.sh && nvm version default')/bin/node" /usr/local/bin/node \
 && ln -sf "${NVM_DIR}/versions/node/$(bash -lc 'source ${NVM_DIR}/nvm.sh && nvm version default')/bin/npm" /usr/local/bin/npm \
 && ln -sf "${NVM_DIR}/versions/node/$(bash -lc 'source ${NVM_DIR}/nvm.sh && nvm version default')/bin/npx" /usr/local/bin/npx

WORKDIR /opt

############################
# Builder image
############################
FROM base AS builder

# Rust is checked by install.sh for SWC plugin builds
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | bash -s -- -y --profile minimal \
 && . "${CARGO_HOME}/env" \
 && rustup target add wasm32-wasip1

WORKDIR /opt

# Clone lively.next
RUN git clone --depth 1 https://github.com/LivelyKernel/lively.next.git /opt/lively.next

WORKDIR /opt/lively.next

# Make sure scripts are executable, then install
RUN chmod +x install.sh start.sh start-server.sh scripts/node_version_checker.sh \
 && /bin/bash -lc "source ${NVM_DIR}/nvm.sh && nvm use default && ./install.sh"

############################
# Runtime image
############################
FROM base AS runtime

ENV NVM_DIR=/usr/local/nvm \
    PATH=/usr/local/nvm/versions/node/v24/bin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    PUPPETEER_CACHE_DIR=/opt/lively.next/.puppeteer-browser-cache

# Copy nvm/node install and built app
COPY --from=builder /usr/local/nvm /usr/local/nvm
COPY --from=builder /opt/lively.next /opt/lively.next

WORKDIR /opt/lively.next

# Recreate symlinks in case path layout changes slightly
RUN bash -lc 'source ${NVM_DIR}/nvm.sh && nvm use default >/dev/null && \
    ln -sf "$(dirname "$(command -v node)")/node" /usr/local/bin/node && \
    ln -sf "$(dirname "$(command -v npm)")/npm" /usr/local/bin/npm && \
    ln -sf "$(dirname "$(command -v npx)")/npx" /usr/local/bin/npx' \
 && chmod +x install.sh start.sh start-server.sh scripts/node_version_checker.sh

EXPOSE 9001

ENTRYPOINT ["./start.sh", "--port=9001"]
