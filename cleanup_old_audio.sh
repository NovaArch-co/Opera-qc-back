#!/bin/bash

# MinIO Audio Files Cleanup Script
# Removes audio files older than 2 days from MinIO storage

echo "🧹 MinIO Audio Files Cleanup"
echo "============================"
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed or not in PATH"
    exit 1
fi

# Check if the cleanup script exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLEANUP_SCRIPT="$SCRIPT_DIR/cleanup-old-audio-files.js"

if [ ! -f "$CLEANUP_SCRIPT" ]; then
    echo "❌ Error: Cleanup script not found at $CLEANUP_SCRIPT"
    exit 1
fi

# Parse command line arguments
DRY_RUN=false
HELP=false

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            HELP=true
            shift
            ;;
        *)
            # Unknown option
            echo "❌ Unknown option: $arg"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Show help
if [ "$HELP" = true ]; then
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --dry-run    Show what files would be deleted without actually deleting them"
    echo "  --help, -h   Show this help message"
    echo ""
    echo "Description:"
    echo "  This script removes audio files from MinIO that are older than 2 days."
    echo "  It connects to MinIO at http://31.184.134.153:9005 and processes the 'audio-files' bucket."
    echo ""
    echo "Examples:"
    echo "  $0                 # Delete old files"
    echo "  $0 --dry-run       # Preview what would be deleted"
    echo ""
    exit 0
fi

# Show configuration
echo "Configuration:"
echo "  MinIO Endpoint: http://31.184.134.153:9005"
echo "  Bucket: audio-files"
echo "  Retention: 2 days"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo "🔍 Running in DRY RUN mode - no files will be deleted"
    echo ""
    node "$CLEANUP_SCRIPT" --dry-run
else
    echo "⚠️  WARNING: This will permanently delete old audio files!"
    echo "   Press Ctrl+C within 5 seconds to cancel..."
    echo ""
    
    # Give user time to cancel
    for i in {5..1}; do
        echo "   Starting in $i seconds..."
        sleep 1
    done
    
    echo ""
    echo "🚀 Starting cleanup..."
    node "$CLEANUP_SCRIPT"
fi

echo ""
echo "✅ Script completed."
