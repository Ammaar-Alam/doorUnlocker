#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
check_dir=$(mktemp -d)
trap 'rm -rf "$check_dir"' EXIT
xcrun swiftc -sdk "$(xcrun --sdk macosx --show-sdk-path)" -swift-version 5 -target "$(uname -m)-apple-macosx14.0" \
  ios/DoorOpener/DoorClient.swift ios/DoorOpener/BluetoothConnection.swift \
  tests/ios-checks.swift -o "$check_dir/check"
"$check_dir/check"
