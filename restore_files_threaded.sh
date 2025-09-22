#!/bin/bash

# Multi-threaded Restore Script: Read backup file(s) and restore all files to original locations
# Usage: ./restore_files_threaded.sh <backup_files...> [--dry-run] [--force] [--threads=N]

set -e

# Parse arguments to separate backup files from options
BACKUP_FILES=()
DRY_RUN=false
FORCE=false
THREADS=4  # Default number of threads
SEPARATOR="=== FILE: "
END_SEPARATOR="=== END FILE ==="

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            ;;
        --force)
            FORCE=true
            ;;
        --threads=*)
            THREADS="${arg#*=}"
            if ! [[ "$THREADS" =~ ^[0-9]+$ ]] || [ "$THREADS" -lt 1 ]; then
                echo "Error: Invalid thread count '$THREADS'. Must be a positive integer."
                exit 1
            fi
            ;;
        -*)
            echo "Unknown option $arg"
            echo "Available options: --dry-run, --force, --threads=N"
            exit 1
            ;;
        *)
            BACKUP_FILES+=("$arg")
            ;;
    esac
done

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Validate backup files
if [ ${#BACKUP_FILES[@]} -eq 0 ]; then
    echo -e "${RED}Error: No backup files specified${NC}"
    echo "Usage: $0 <backup_files...> [--dry-run] [--force] [--threads=N]"
    echo "Options:"
    echo "  --dry-run      Show what would be restored without creating files"
    echo "  --force        Overwrite existing files without prompting"
    echo "  --threads=N    Number of parallel threads (default: 4)"
    exit 1
fi

# Check if all backup files exist
for backup_file in "${BACKUP_FILES[@]}"; do
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}Error: Backup file '$backup_file' not found${NC}"
        exit 1
    fi
done

# Sort backup files
IFS=$'\n' SORTED_BACKUP_FILES=($(sort <<<"${BACKUP_FILES[*]}"))

echo -e "${CYAN}Multi-threaded backup restoration starting...${NC}"
echo "Backup files: ${SORTED_BACKUP_FILES[*]}"
echo "Number of parts: ${#SORTED_BACKUP_FILES[@]}"
echo "Threads: $THREADS"
echo "Dry run: $DRY_RUN"
echo "Force mode: $FORCE"
echo

# Create temporary directory for thread coordination
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Shared counters using files for thread-safe operations
echo "0" > "$TEMP_DIR/files_restored"
echo "0" > "$TEMP_DIR/files_skipped" 
echo "0" > "$TEMP_DIR/files_failed"
echo "0" > "$TEMP_DIR/conflicts"

# Thread-safe counter functions
increment_counter() {
    local counter_file="$1"
    local increment="${2:-1}"
    (
        flock -x 200
        local current=$(cat "$counter_file")
        echo $((current + increment)) > "$counter_file"
    ) 200>"$counter_file.lock"
}

get_counter() {
    local counter_file="$1"
    cat "$counter_file"
}

# Function to check if file should be restored
should_restore_file() {
    local filepath="$1"
    
    if [ ! -f "$filepath" ]; then
        return 0  # File doesn't exist, safe to restore
    fi
    
    if [ "$FORCE" = true ]; then
        return 0  # Force mode enabled
    fi
    
    return 1  # File exists and no force mode
}

# Function to restore a single file (thread-safe)
restore_current_file() {
    local filepath="$1"
    local content="$2"
    local thread_id="$3"
    
    local dir_path
    dir_path=$(dirname "$filepath")
    
    if should_restore_file "$filepath"; then
        increment_counter "$TEMP_DIR/files_restored"
        echo -e "${GREEN}[T$thread_id] Restoring: $filepath${NC}"
        
        if [ "$DRY_RUN" = false ]; then
            # Create directory if needed (thread-safe with -p)
            if [ "$dir_path" != "." ] && [ "$dir_path" != "./" ]; then
                mkdir -p "$dir_path"
            fi
            
            # Write file content atomically
            if echo -n "$content" > "$filepath.tmp" && mv "$filepath.tmp" "$filepath"; then
                echo -e "${GREEN}[T$thread_id]   ✓ Created successfully${NC}"
            else
                echo -e "${RED}[T$thread_id]   ✗ Failed to create${NC}"
                increment_counter "$TEMP_DIR/files_failed"
                increment_counter "$TEMP_DIR/files_restored" -1
                rm -f "$filepath.tmp"
            fi
        else
            echo -e "${BLUE}[T$thread_id]   ✓ Would create${NC}"
        fi
    else
        increment_counter "$TEMP_DIR/files_skipped"
        increment_counter "$TEMP_DIR/conflicts"
        echo -e "${YELLOW}[T$thread_id]   - Skipped (exists): $filepath${NC}"
    fi
}

# Function to process a single backup file in a thread
process_backup_file() {
    local backup_file="$1"
    local thread_id="$2"
    
    echo -e "${BLUE}[T$thread_id] Processing: $backup_file${NC}"
    
    local current_file=""
    local current_content=""
    local in_file=false
    local file_line_count=0
    local files_processed=0
    
    while IFS= read -r line; do
        file_line_count=$((file_line_count + 1))
        
        # Show progress every 5000 lines (less frequent for multi-threading)
        if [ $((file_line_count % 5000)) -eq 0 ]; then
            echo -e "${CYAN}[T$thread_id]   Processed $file_line_count lines, $files_processed files...${NC}"
        fi
        
        # Check for file header
        if [[ "$line" == "$SEPARATOR"* ]]; then
            # Save previous file if we were processing one
            if [ "$in_file" = true ] && [ -n "$current_file" ]; then
                restore_current_file "$current_file" "$current_content" "$thread_id"
                files_processed=$((files_processed + 1))
            fi
            
            # Start new file
            current_file="${line#$SEPARATOR}"
            current_content=""
            in_file=true
            
        elif [[ "$line" == "$END_SEPARATOR" ]]; then
            # End of current file
            if [ "$in_file" = true ] && [ -n "$current_file" ]; then
                restore_current_file "$current_file" "$current_content" "$thread_id"
                files_processed=$((files_processed + 1))
            fi
            current_file=""
            current_content=""
            in_file=false
            
        elif [ "$in_file" = true ]; then
            # Accumulate file content
            if [ -z "$current_content" ]; then
                current_content="$line"
            else
                current_content="$current_content"$'\n'"$line"
            fi
        fi
        
    done < "$backup_file"
    
    # Handle last file if backup ends without END_SEPARATOR
    if [ "$in_file" = true ] && [ -n "$current_file" ]; then
        restore_current_file "$current_file" "$current_content" "$thread_id"
        files_processed=$((files_processed + 1))
    fi
    
    echo -e "${GREEN}[T$thread_id] ✓ Completed processing $backup_file ($files_processed files)${NC}"
}

# Export functions for parallel processing
export -f process_backup_file
export -f restore_current_file
export -f should_restore_file
export -f increment_counter
export -f get_counter
export SEPARATOR END_SEPARATOR DRY_RUN FORCE TEMP_DIR
export RED GREEN YELLOW BLUE CYAN NC

# Progress monitoring in background
monitor_progress() {
    while true; do
        sleep 10
        local restored=$(get_counter "$TEMP_DIR/files_restored")
        local skipped=$(get_counter "$TEMP_DIR/files_skipped")
        local failed=$(get_counter "$TEMP_DIR/files_failed")
        local total=$((restored + skipped + failed))
        
        if [ $total -gt 0 ]; then
            echo -e "${CYAN}Progress: $total files processed (✓$restored ⚠$skipped ✗$failed)${NC}"
        fi
    done &
    MONITOR_PID=$!
}

# Start progress monitoring
if [ "$DRY_RUN" = false ]; then
    monitor_progress
fi

# Process backup files in parallel using GNU parallel or xargs
if command -v parallel >/dev/null 2>&1; then
    echo -e "${CYAN}Using GNU parallel for processing...${NC}"
    printf '%s\n' "${SORTED_BACKUP_FILES[@]}" | \
        parallel -j "$THREADS" --line-buffer --tagstring '[T{#}]' \
        'process_backup_file {} {#}'
elif command -v xargs >/dev/null 2>&1; then
    echo -e "${CYAN}Using xargs for processing...${NC}"
    printf '%s\n' "${SORTED_BACKUP_FILES[@]}" | \
        xargs -n 1 -P "$THREADS" -I {} bash -c 'process_backup_file "$1" $$' _ {}
else
    echo -e "${YELLOW}No parallel processing tool found, falling back to sequential processing...${NC}"
    thread_id=1
    for backup_file in "${SORTED_BACKUP_FILES[@]}"; do
        process_backup_file "$backup_file" "$thread_id"
        thread_id=$((thread_id + 1))
    done
fi

# Stop progress monitoring
if [ -n "$MONITOR_PID" ]; then
    kill $MONITOR_PID 2>/dev/null || true
    wait $MONITOR_PID 2>/dev/null || true
fi

# Final progress check
sleep 1

# Get final counters
files_restored=$(get_counter "$TEMP_DIR/files_restored")
files_skipped=$(get_counter "$TEMP_DIR/files_skipped")
files_failed=$(get_counter "$TEMP_DIR/files_failed")
conflicts=$(get_counter "$TEMP_DIR/conflicts")

# Print summary
echo
echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}         RESTORATION SUMMARY${NC}"
echo -e "${BLUE}===========================================${NC}"
echo -e "Files restored: ${GREEN}$files_restored${NC}"
echo -e "Files skipped:  ${YELLOW}$files_skipped${NC}"
echo -e "Files failed:   ${RED}$files_failed${NC}"
echo -e "Conflicts:      ${YELLOW}$conflicts${NC}"
echo -e "Threads used:   ${CYAN}$THREADS${NC}"

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}This was a dry run. No files were actually created.${NC}"
    echo "Run without --dry-run to perform the actual restore."
elif [ $files_failed -eq 0 ]; then
    echo -e "${GREEN}✓ Restore completed successfully!${NC}"
else
    echo -e "${RED}✗ Restore completed with $files_failed failures${NC}"
    exit 1
fi
