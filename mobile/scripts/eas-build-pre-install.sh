#!/bin/bash
set -e

echo "=================================================="
echo "🚀 EAS Pre-Install Hook: Installing Python 3.10"
echo "=================================================="

# Check if python3.10 is already available
if command -v python3.10 >/dev/null 2>&1; then
  echo "✅ python3.10 already exists on PATH:"
  which python3.10
  python3.10 --version
  exit 0
fi

export DEBIAN_FRONTEND=noninteractive

# Update apt repositories
sudo apt-get update -y || true
sudo apt-get install -y --no-install-recommends software-properties-common || true

# Add deadsnakes PPA to guarantee Python 3.10 on any Ubuntu version (20.04, 22.04, 24.04)
echo "Adding deadsnakes PPA..."
sudo add-apt-repository -y ppa:deadsnakes/ppa || true
sudo apt-get update -y || true

# Install Python 3.10 and build dependencies
echo "Installing python3.10, distutils, and dev tools..."
sudo apt-get install -y --no-install-recommends \
  python3.10 \
  python3.10-venv \
  python3.10-dev \
  python3.10-distutils || true

# Ensure python3.10 is accessible from /usr/local/bin
if [ -f /usr/bin/python3.10 ]; then
  sudo ln -sf /usr/bin/python3.10 /usr/local/bin/python3.10
elif command -v python3 >/dev/null 2>&1; then
  sudo ln -sf "$(which python3)" /usr/local/bin/python3.10
fi

echo "=================================================="
echo "✅ Python 3.10 verification:"
which python3.10 || echo "python3.10 not in which"
python3.10 --version || echo "python3.10 --version not available"
echo "=================================================="
