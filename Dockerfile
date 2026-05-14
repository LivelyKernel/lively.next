FROM ubuntu:24.04

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Ubuntu 24.04 is pinned so the development runtime stays reproducible while
# still matching a current LTS release supported by NodeSource's Node 24 setup.
ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    BUN_INSTALL=/root/.bun \
    RUSTUP_HOME=/opt/rustup \
    CARGO_HOME=/opt/cargo

ENV PATH="${CARGO_HOME}/bin:${BUN_INSTALL}/bin:${PATH}"

# Install the base OS tools, build chain, browser shared libraries, and fonts
# needed for a host with only Docker to run install.sh, start the server, and
# execute Puppeteer-based boot checks inside the container.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      apt-transport-https \
      aspell \
      bash \
      brotli \
      build-essential \
      ca-certificates \
      curl \
      dumb-init \
      entr \
      fonts-freefont-ttf \
      fonts-ipafont-gothic \
      fonts-kacst \
      fonts-liberation \
      fonts-thai-tlwg \
      fonts-wqy-zenhei \
      git \
      gnupg \
      iproute2 \
      libasound2t64 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libatspi2.0-0 \
      libcairo2 \
      libcups2 \
      libdbus-1-3 \
      libdrm2 \
      libgbm1 \
      libglib2.0-0 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      libpango-1.0-0 \
      libx11-6 \
      libx11-xcb1 \
      libxcb1 \
      libxcomposite1 \
      libxdamage1 \
      libxext6 \
      libxfixes3 \
      libxkbcommon0 \
      libxrandr2 \
      libxss1 \
      lsb-release \
      net-tools \
      perl \
      pkg-config \
      procps \
      python3 \
      python3-pip \
      python3-venv \
      sudo \
      tar \
      tree \
      unzip \
      wget \
      xdg-utils \
      xz-utils \
    && rm -rf /var/lib/apt/lists/*

# NodeSource provides Node 24 packages for Noble; using the distro package keeps
# node and npm available without requiring a host-level version manager.
RUN curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh \
    && bash /tmp/nodesource_setup.sh \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -f /tmp/nodesource_setup.sh \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash

# Rust is installed in a shared location because the project build needs the
# wasm32-wasip1 target and the container may run as different users later.
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
      | sh -s -- -y --profile minimal --default-toolchain stable \
    && rustup target add wasm32-wasip1 \
    && chmod -R a+rwx "${RUSTUP_HOME}" "${CARGO_HOME}"

RUN pip3 install --break-system-packages --no-cache-dir sultan

WORKDIR /workspace

COPY scripts/docker-entrypoint.sh /usr/local/bin/lively-docker-entrypoint
RUN chmod +x /usr/local/bin/lively-docker-entrypoint

EXPOSE 9011

ENTRYPOINT ["dumb-init", "--", "lively-docker-entrypoint"]
