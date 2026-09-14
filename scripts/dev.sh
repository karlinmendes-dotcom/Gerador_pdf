#!/bin/sh
cd "$(dirname "$0")/.."
exec npx vite --host 0.0.0.0
