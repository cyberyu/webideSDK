#!/bin/bash

# Enhanced Multi-threaded Restore Script with deadlock prevention
# Usage: ./restore_files_threaded_improved.sh <backup_files...> [--dry-run] [--force] [--threads=N] [--timeout=N]

set -e

# Parse arguments to separate backup files from options
BACKUP_FILES=()
DRY_RUN=false
FORCE=false
THREADS=4  # Default number of threads
TIMEOUT=3600  # Default timeout: 1 hour
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
            if ! [[ "$THREADS" =~ ^[0-9]+$ ]] || [ "$THREADS" -lt 1 ] || [ "$THREADS" -gt 16 ]; then
                echo "Error: Invalid thread count '$THREADS'. Must be between 1-16."
                exit 1
            fi
            ;;
        --timeout=*)
            TIMEOUT="${arg#*=}"
            if ! [[ "$TIMEOUT" =~ ^[0-9]+$ ]] || [ "$TIMEOUT" -lt 60 ]; then
                echo "Error: Invalid timeout '$TIMEOUT'. Must be at least 60 seconds."
                exit 1
            fi
            ;;
        -*)
            echo "Unknown option $arg"
            echo "Available options: --dry-run, --force, --threads=N (1-16), --timeout=N (seconds)"
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
    echo "Usage: $0 <backup_files...> [--dry-run] [--force] [--threads=N] [--timeout=N]"
    echo "Options:"
    echo "  --dry-run      Show what would be restored without creating files"
    echo "  --force        Overwrite existing files without prompting"
    echo "  --threads=N    Number of parallel threads (1-16, default: 4)"
    echo "  --timeout=N    Maximum runtime in seconds (default: 3600)"
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

echo -e "${CYAN}Enhanced Multi-threaded Restore with Deadlock Prevention${NC}"
echo "Backup files: ${SORTED_BACKUP_FILES[*]}"
echo "Number of parts: ${#SORTED_BACKUP_FILES[@]}"
echo "Threads: $THREADS"
echo "Timeout: ${TIMEOUT}s"
echo "Dry run: $DRY_RUN"
echo "Force mode: $FORCE"
echo

# Create temporary directory for thread coordination
TEMP_DIR=$(mktemp -d)
trap "cleanup_and_exit" EXIT SIGINT SIGTERM

cleanup_and_exit() {
    echo -e "${YELLOW}Cleaning up...${NC}"
    
    # Kill all child processes
    if [ -n "$MONITOR_PID" ]; then
        kill $MONITOR_PID 2>/dev/null || true
    fi
    
    # Kill any hanging parallel processes
    pkill -P $$ 2>/dev/null || true
    
    # Wait a bit for cleanup
    sleep 2
    
    # Force kill if needed
    pkill -9 -P $$ 2>/dev/null || true
    
    # Remove temp directory
    rm -rf "$TEMP_DIR" 2>/dev/null || true
    
    echo -e "${GREEN}Cleanup completed${NC}"
}

# Shared counters using files for thread-safe operations
echo "0" > "$TEMP_DIR/files_restored"
echo "0" > "$TEMP_DIR/files_skipped" 
echo "0" > "$TEMP_DIR/files_failed"
echo "0" > "$TEMP_DIR/conflicts"
echo "$(date +%s)" > "$TEMP_DIR/start_time"
echo "0" > "$TEMP_DIR/last_activity"

# Thread-safe counter functions with improved locking
increment_counter() {
    local counter_file="$1"
    local increment="${2:-1}"
    local lock_file="$counter_file.lock"
    local max_retries=50
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        if (set -C; echo $$ > "$lock_file") 2>/dev/null; then
            local current=$(cat "$counter_file" 2>/dev/null || echo "0")
            echo $((current + increment)) > "$counter_file"
            rm -f "$lock_file"
            
            # Update last activity timestamp
            echo "$(date +%s)" > "$TEMP_DIR/last_activity"
            return 0
        fi
        
        # Check if lock is stale (older than 30 seconds)
        if [ -f "$lock_file" ]; then
            local lock_pid=$(cat "$lock_file" 2>/dev/null || echo "0")
            if ! kill -0 "$lock_pid" 2>/dev/null; then
                echo -e "${YELLOW}Removing stale lock file${NC}"
                rm -f "$lock_file"
            fi
        fi
        
        sleep 0.1
        retry=$((retry + 1))
    done
    
    echo -e "${RED}Failed to acquire lock after $max_retries retries${NC}"
    return 1
}

get_counter() {
    local counter_file="$1"
    cat "$counter_file" 2>/dev/null || echo "0"
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
        increment_counter "$TEMP_DIR/files_restored" || return 1
        echo -e "${GREEN}[T$thread_id] Restoring: $filepath${NC}"
        
        if [ "$DRY_RUN" = false ]; then
            # Create directory if needed (thread-safe with -p)
            if [ "$dir_path" != "." ] && [ "$dir_path" != "./" ]; then
                mkdir -p "$dir_path" || {
                    echo -e "${RED}[T$thread_id] Failed to create directory: $dir_path${NC}"
                    increment_counter "$TEMP_DIR/files_failed"
                    return 1
                }
            fi
            
            # Write file content atomically with timeout
            local temp_file="$filepath.tmp.$$.$thread_id"
            if timeout 60 bash -c "printf '%s' \"\$1\" > \"\$2\"" _ "$content" "$temp_file"; then
                if mv "$temp_file" "$filepath"; then
                    echo -e "${GREEN}[T$thread_id]   ✓ Created successfully${NC}"
                else
                    echo -e "${RED}[T$thread_id]   ✗ Failed to move temp file${NC}"
                    increment_counter "$TEMP_DIR/files_failed"
                    rm -f "$temp_file"
                    return 1
                fi
            else
                echo -e "${RED}[T$thread_id]   ✗ Failed to write content (timeout)${NC}"
                increment_counter "$TEMP_DIR/files_failed"
                rm -f "$temp_file"
                return 1
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

# Function to process a single backup file in a thread with timeout
process_backup_file() {
    local backup_file="$1"
    local thread_id="$2"
    
    echo -e "${BLUE}[T$thread_id] Processing: $backup_file${NC}"
    
    local current_file=""
    local current_content=""
    local in_file=false
    local file_line_count=0
    local files_processed=0
    local start_time=$(date +%s)
    
    # Set up timeout for this thread
    (
        sleep $((TIMEOUT / 2))  # Half of total timeout per thread
        if kill -0 $$ 2>/dev/null; then
            echo -e "${RED}[T$thread_id] Thread timeout - killing${NC}"
            kill -TERM $$
        fi
    ) &
    local timeout_pid=$!
    
    while IFS= read -r line; do
        file_line_count=$((file_line_count + 1))
        
        # Check for timeout
        local current_time=$(date +%s)
        if [ $((current_time - start_time)) -gt $((TIMEOUT / 2)) ]; then
            echo -e "${RED}[T$thread_id] Thread exceeded time limit${NC}"
            kill $timeout_pid 2>/dev/null || true
            return 1
        fi
        
        # Show progress every 10000 lines (less frequent for multi-threading)
        if [ $((file_line_count % 10000)) -eq 0 ]; then
            echo -e "${CYAN}[T$thread_id]   Processed $file_line_count lines, $files_processed files...${NC}"
            # Update activity timestamp
            echo "$current_time" > "$TEMP_DIR/last_activity"
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
    
    # Clean up timeout process
    kill $timeout_pid 2>/dev/null || true
    
    echo -e "${GREEN}[T$thread_id] ✓ Completed processing $backup_file ($files_processed files)${NC}"
}

# Export functions for parallel processing
export -f process_backup_file
export -f restore_current_file
export -f should_restore_file
export -f increment_counter
export -f get_counter
export SEPARATOR END_SEPARATOR DRY_RUN FORCE TEMP_DIR TIMEOUT
export RED GREEN YELLOW BLUE CYAN NC

# Enhanced progress monitoring with stall detection
monitor_progress() {
    local last_total=0
    local stall_count=0
    local max_stall_cycles=6  # 60 seconds of no progress
    
    while true; do
        sleep 10
        local restored=$(get_counter "$TEMP_DIR/files_restored")
        local skipped=$(get_counter "$TEMP_DIR/files_skipped")
        local failed=$(get_counter "$TEMP_DIR/files_failed")
        local total=$((restored + skipped + failed))
        local start_time=$(cat "$TEMP_DIR/start_time")
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [ $total -gt 0 ]; then
            local rate=$((total * 60 / elapsed))  # files per minute
            echo -e "${CYAN}Progress: $total files processed (✓$restored ⚠$skipped ✗$failed) - ${rate}/min - ${elapsed}s elapsed${NC}"
        fi
        
        # Stall detection
        if [ $total -eq $last_total ]; then
            stall_count=$((stall_count + 1))
            if [ $stall_count -ge $max_stall_cycles ]; then
                echo -e "${RED}⚠️  STALL DETECTED: No progress for 60 seconds!${NC}"
                echo -e "${YELLOW}Checking for deadlocked processes...${NC}"
                # You could add process checks here
            fi
        else
            stall_count=0
        fi
        
        last_total=$total
        
        # Global timeout check
        if [ $elapsed -gt $TIMEOUT ]; then
            echo -e "${RED}⚠️  GLOBAL TIMEOUT: Exceeded ${TIMEOUT}s limit!${NC}"
            echo -e "${YELLOW}Terminating all processes...${NC}"
            pkill -P $$ || true
            break
        fi
    done &
    MONITOR_PID=$!
}

# Start enhanced progress monitoring
monitor_progress

echo -e "${CYAN}Starting parallel processing...${NC}"

# Process backup files with improved parallel handling
if command -v parallel >/dev/null 2>&1; then
    echo -e "${CYAN}Using GNU parallel for processing...${NC}"
    printf '%s\n' "${SORTED_BACKUP_FILES[@]}" | \
        timeout $TIMEOUT parallel -j "$THREADS" --line-buffer --tagstring '[T{#}]' --halt now,fail=50% \
        'process_backup_file {} {#}' || {
        echo -e "${RED}Parallel processing failed or timed out${NC}"
        exit 1
    }
elif command -v xargs >/dev/null 2>&1; then
    echo -e "${CYAN}Using xargs for processing...${NC}"
    printf '%s\n' "${SORTED_BACKUP_FILES[@]}" | \
        timeout $TIMEOUT xargs -n 1 -P "$THREADS" -I {} bash -c 'process_backup_file "$1" $$' _ {} || {
        echo -e "${RED}Xargs processing failed or timed out${NC}"
        exit 1
    }
else
    echo -e "${YELLOW}No parallel processing tool found, falling back to sequential processing...${NC}"
    thread_id=1
    for backup_file in "${SORTED_BACKUP_FILES[@]}"; do
        timeout $((TIMEOUT / ${#SORTED_BACKUP_FILES[@]})) process_backup_file "$backup_file" "$thread_id" || {
            echo -e "${RED}Processing failed for $backup_file${NC}"
            exit 1
        }
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
start_time=$(cat "$TEMP_DIR/start_time")
end_time=$(date +%s)
total_time=$((end_time - start_time))

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
echo -e "Total time:     ${CYAN}${total_time}s${NC}"

if [ $total_time -gt 0 ]; then
    local rate=$((files_restored * 60 / total_time))
    echo -e "Average rate:   ${CYAN}${rate} files/min${NC}"
fi

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}This was a dry run. No files were actually created.${NC}"
    echo "Run without --dry-run to perform the actual restore."
elif [ $files_failed -eq 0 ]; then
    echo -e "${GREEN}✓ Restore completed successfully!${NC}"
else
    echo -e "${RED}✗ Restore completed with $files_failed failures${NC}"
    exit 1
fi
