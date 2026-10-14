#!/bin/bash
set -e

echo "=== EAS Pre-Install Hook ==="
if [ "$EAS_BUILD" = "true" ] && [ "$EAS_BUILD_PLATFORM" = "android" ]; then
  echo "Installing Python 3.10 on EAS Cloud Ubuntu builder..."
  sudo apt-get update -y
  sudo apt-get install -y python3.10 python3.10-distutils python3.10-dev python3.10-venv || {
    echo "Adding deadsnakes PPA for Python 3.10..."
    sudo add-apt-repository -y ppa:deadsnakes/ppa
    sudo apt-get update -y
    sudo apt-get install -y python3.10 python3.10-distutils python3.10-dev python3.10-venv
  }
  echo "Python 3.10 successfully installed on EAS builder!"
  python3.10 --version
fi
