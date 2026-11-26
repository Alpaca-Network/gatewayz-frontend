#!/bin/bash
# Kept so links already shared keep working. The setup is setup.sh (macOS and Linux).
exec bash <(curl -fsSL https://raw.githubusercontent.com/Alpaca-Network/gatewayz-frontend/master/opencode/setup.sh) "$@"
