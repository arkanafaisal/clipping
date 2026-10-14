#!/bin/bash
set -e

echo "=================================================="
echo "🚀 EAS Pre-Install Hook: Installing Python 3.10"
echo "=================================================="

export DEBIAN_FRONTEND=noninteractive

# Update apt repositories
sudo apt-get update -y
sudo apt-get install -y --no-install-recommends software-properties-common

# Add deadsnakes PPA to guarantee Python 3.10 on any Ubuntu version (20.04, 22.04, 24.04)
echo "Adding deadsnakes PPA..."
sudo add-apt-repository -y ppa:deadsnakes/ppa
sudo apt-get update -y

# Install Python 3.10 and build dependencies
echo "Installing python3.10, distutils, and dev tools..."
sudo apt-get install -y --no-install-recommends \
  python3.10 \
  python3.10-venv \
  python3.10-dev \
  python3.10-distutils

echo "=================================================="
echo "✅ Python 3.10 successfully installed on EAS builder!"
which python3.10
python3.10 --version
echo "=================================================="
