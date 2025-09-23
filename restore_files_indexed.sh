#!/bin/bash

# Enhanced Indexed Restore Script with direct line seeking
# Usage: ./restore_files_indexed.sh <backup_files...> [--dry-run] [--force] [--threads=N] [--timeout=N]

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
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}Enhanced Indexed Restore Script${NC}"
echo "==============================="

# Validate backup files
if [ ${#BACKUP_FILES[@]} -eq 0 ]; then
    echo -e "${RED}Error: No backup files specified${NC}"
    echo "Usage: $0 <backup_files...> [options]"
    exit 1
fi

# Check if backup files exist and find corresponding index files
VALID_BACKUP_FILES=()
INDEX_FILES=()

for backup_file in "${BACKUP_FILES[@]}"; do
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}Warning: Backup file not found: $backup_file${NC}"
        continue
    fi
    
    # Determine corresponding index file
    if [[ "$backup_file" =~ \.part[0-9]{3}\.txt$ ]]; then
        index_file="${backup_file%.txt}.idx"
    else
        echo -e "${YELLOW}Warning: Non-standard backup file name: $backup_file (assuming no index)${NC}"
        index_file=""
    fi
    
    VALID_BACKUP_FILES+=("$backup_file")
    INDEX_FILES+=("$index_file")
done

if [ ${#VALID_BACKUP_FILES[@]} -eq 0 ]; then
    echo -e "${RED}Error: No valid backup files found${NC}"
    exit 1
fi

# Check index file availability
INDEXED_COUNT=0
NON_INDEXED_COUNT=0
for index_file in "${INDEX_FILES[@]}"; do
    if [ -n "$index_file" ] && [ -f "$index_file" ]; then
        INDEXED_COUNT=$((INDEXED_COUNT + 1))
    else
        NON_INDEXED_COUNT=$((NON_INDEXED_COUNT + 1))
    fi
done

echo "Found ${#VALID_BACKUP_FILES[@]} backup file(s)"
echo "Index files available: $INDEXED_COUNT"
echo "Non-indexed files: $NON_INDEXED_COUNT"

if [ $INDEXED_COUNT -gt 0 ]; then
    echo -e "${GREEN}Using indexed restore for faster processing${NC}"
else
    echo -e "${YELLOW}No index files found, falling back to line-by-line processing${NC}"
fi

echo "Dry run: $([ "$DRY_RUN" = true ] && echo "Yes" || echo "No")"
echo "Force overwrite: $([ "$FORCE" = true ] && echo "Yes" || echo "No")"
echo "Threads: $THREADS"
echo "Timeout: ${TIMEOUT}s"
echo

# Create temporary directory for coordination
TEMP_DIR=$(mktemp -d)
echo "0" > "$TEMP_DIR/files_processed"
echo "0" > "$TEMP_DIR/files_created"
echo "0" > "$TEMP_DIR/files_skipped"
echo "0" > "$TEMP_DIR/files_error"

# Cleanup function
cleanup_and_exit() {
    local exit_code=$1
    echo -e "${YELLOW}Cleaning up...${NC}"
    
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null || true
    
    # Remove temporary directory
    rm -rf "$TEMP_DIR" 2>/dev/null || true
    
    echo -e "${BLUE}Cleanup completed${NC}"
    exit $exit_code
}

# Set up signal handlers
trap 'cleanup_and_exit 130' INT
trap 'cleanup_and_exit 143' TERM

# macOS compatibility functions
mac_timeout() {
    local timeout_duration=$1
    shift
    
    "$@" &
    local cmd_pid=$!
    
    (
        sleep $timeout_duration
        if kill -0 $cmd_pid 2>/dev/null; then
            echo "Process timed out after ${timeout_duration}s" >&2
            kill -TERM $cmd_pid 2>/dev/null || true
            sleep 2
            kill -KILL $cmd_pid 2>/dev/null || true
        fi
    ) &
    local timer_pid=$!
    
    local exit_code=0
    wait $cmd_pid 2>/dev/null || exit_code=$?
    
    kill $timer_pid 2>/dev/null || true
    wait $timer_pid 2>/dev/null || true
    
    return $exit_code
}

# Use appropriate timeout command
if command -v gtimeout >/dev/null 2>&1; then
    TIMEOUT_CMD="gtimeout"
elif command -v timeout >/dev/null 2>&1; then
    TIMEOUT_CMD="timeout"
else
    TIMEOUT_CMD="mac_timeout"
fi

# Simple file locking mechanism for macOS
acquire_lock() {
    local lock_file="$1"
    local max_wait=30
    local waited=0
    
    while [ $waited -lt $max_wait ]; do
        if mkdir "$lock_file" 2>/dev/null; then
            return 0
        fi
        sleep 0.1
        waited=$((waited + 1))
    done
    return 1
}

release_lock() {
    local lock_file="$1"
    rmdir "$lock_file" 2>/dev/null || true
}

# Thread-safe counter functions
increment_counter() {
    local counter_file="$1"
    local increment="${2:-1}"
    local lock_file="$counter_file.lock"
    
    if acquire_lock "$lock_file"; then
        local current=$(cat "$counter_file" 2>/dev/null || echo "0")
        echo $((current + increment)) > "$counter_file"
        release_lock "$lock_file"
        
        # Update last activity timestamp
        echo "$(date +%s)" > "$TEMP_DIR/last_activity"
        return 0
    else
        echo -e "${RED}Failed to acquire lock for counter${NC}" >&2
        return 1
    fi
}

get_counter() {
    local counter_file="$1"
    cat "$counter_file" 2>/dev/null || echo "0"
}

# Function to restore a single file using direct line access
restore_file_indexed() {
    local data_file="$1"
    local filepath="$2"
    local start_line="$3"
    local end_line="$4"
    local file_size="$5"
    local thread_id="$6"
    
    echo -e "${CYAN}[T$thread_id] Restoring (indexed): $filepath${NC}"
    
    increment_counter "$TEMP_DIR/files_processed"
    
    # Check if file already exists and handle accordingly
    if [ -f "$filepath" ] && [ "$FORCE" != true ]; then
        echo -e "${YELLOW}[T$thread_id] File exists, skipping: $filepath${NC}"
        increment_counter "$TEMP_DIR/files_skipped"
        return 0
    fi
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}[T$thread_id] [DRY RUN] Would restore: $filepath (${file_size} bytes)${NC}"
        increment_counter "$TEMP_DIR/files_created"
        return 0
    fi
    
    # Create directory if it doesn't exist
    local dir_path=$(dirname "$filepath")
    if [ "$dir_path" != "." ] && [ ! -d "$dir_path" ]; then
        mkdir -p "$dir_path" || {
            echo -e "${RED}[T$thread_id] Failed to create directory: $dir_path${NC}"
            increment_counter "$TEMP_DIR/files_error"
            return 1
        }
    fi
    
    # Extract file content using sed with line numbers
    # We need to skip the separator line and end separator line
    local content_start=$((start_line + 1))  # Skip "=== FILE: " line
    local content_end=$((end_line - 2))      # Skip blank line and "=== END FILE ===" line
    
    if [ $content_end -ge $content_start ]; then
        # Use sed to extract specific line range efficiently
        if sed -n "${content_start},${content_end}p" "$data_file" > "$filepath"; then
            echo -e "${GREEN}[T$thread_id] ✓ Restored: $filepath (${file_size} bytes)${NC}"
            increment_counter "$TEMP_DIR/files_created"
        else
            echo -e "${RED}[T$thread_id] Failed to restore: $filepath${NC}"
            increment_counter "$TEMP_DIR/files_error"
            return 1
        fi
    else
        # Empty file
        touch "$filepath" || {
            echo -e "${RED}[T$thread_id] Failed to create empty file: $filepath${NC}"
            increment_counter "$TEMP_DIR/files_error"
            return 1
        }
        echo -e "${GREEN}[T$thread_id] ✓ Created empty file: $filepath${NC}"
        increment_counter "$TEMP_DIR/files_created"
    fi
}

# Function to process backup file using index (fast path)
process_backup_indexed() {
    local backup_file="$1"
    local index_file="$2"
    local thread_id="$3"
    
    echo -e "${PURPLE}[T$thread_id] Processing with index: $(basename "$backup_file")${NC}"
    
    local files_in_backup=0
    
    # Read index file and process each entry
    while IFS='|' read -r filepath start_line end_line file_size; do
        # Skip comment lines
        [[ "$filepath" =~ ^#.*$ ]] && continue
        
        # Skip empty lines
        [ -z "$filepath" ] && continue
        
        files_in_backup=$((files_in_backup + 1))
        
        restore_file_indexed "$backup_file" "$filepath" "$start_line" "$end_line" "$file_size" "$thread_id" || {
            echo -e "${RED}[T$thread_id] Error processing: $filepath${NC}"
        }
        
        # Show progress every 100 files
        if [ $((files_in_backup % 100)) -eq 0 ]; then
            echo -e "${CYAN}[T$thread_id] Processed $files_in_backup files from index...${NC}"
            echo "$(date +%s)" > "$TEMP_DIR/last_activity"
        fi
        
    done < "$index_file"
    
    echo -e "${GREEN}[T$thread_id] ✓ Completed indexed backup: $(basename "$backup_file") ($files_in_backup files)${NC}"
}

# Function to process backup file without index (fallback - same as original script)
process_backup_legacy() {
    local backup_file="$1"
    local thread_id="$2"
    
    echo -e "${YELLOW}[T$thread_id] Processing without index (legacy mode): $(basename "$backup_file")${NC}"
    
    local current_file=""
    local current_content=""
    local in_file=false
    local file_line_count=0
    local files_processed=0
    local start_time=$(date +%s)
    
    while IFS= read -r line; do
        file_line_count=$((file_line_count + 1))
        
        # Check for timeout every 1000 lines
        if [ $((file_line_count % 1000)) -eq 0 ]; then
            local current_time=$(date +%s)
            if [ $((current_time - start_time)) -gt $((TIMEOUT / 2)) ]; then
                echo -e "${RED}[T$thread_id] Thread exceeded time limit${NC}"
                return 1
            fi
        fi
        
        # Show progress every 10000 lines
        if [ $((file_line_count % 10000)) -eq 0 ]; then
            echo -e "${CYAN}[T$thread_id] Processed $file_line_count lines, $files_processed files...${NC}"
            echo "$(date +%s)" > "$TEMP_DIR/last_activity"
        fi
        
        # Check for file header
        if [[ "$line" == "$SEPARATOR"* ]]; then
            # Save previous file if we were processing one
            if [ "$in_file" = true ] && [ -n "$current_file" ]; then
                restore_current_file_legacy "$current_file" "$current_content" "$thread_id"
                files_processed=$((files_processed + 1))
            fi
            
            # Start new file
            current_file="${line#$SEPARATOR}"
            current_content=""
            in_file=true
            
        elif [[ "$line" == "$END_SEPARATOR" ]]; then
            # End of current file
            if [ "$in_file" = true ] && [ -n "$current_file" ]; then
                restore_current_file_legacy "$current_file" "$current_content" "$thread_id"
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
        restore_current_file_legacy "$current_file" "$current_content" "$thread_id"
        files_processed=$((files_processed + 1))
    fi
    
    echo -e "${GREEN}[T$thread_id] ✓ Completed legacy processing: $(basename "$backup_file") ($files_processed files)${NC}"
}

# Function to restore a single file (legacy method)
restore_current_file_legacy() {
    local filepath="$1"
    local content="$2"
    local thread_id="$3"
    
    echo -e "${CYAN}[T$thread_id] Restoring (legacy): $filepath${NC}"
    
    increment_counter "$TEMP_DIR/files_processed"
    
    # Check if file already exists
    if [ -f "$filepath" ] && [ "$FORCE" != true ]; then
        echo -e "${YELLOW}[T$thread_id] File exists, skipping: $filepath${NC}"
        increment_counter "$TEMP_DIR/files_skipped"
        return 0
    fi
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}[T$thread_id] [DRY RUN] Would restore: $filepath${NC}"
        increment_counter "$TEMP_DIR/files_created"
        return 0
    fi
    
    # Create directory if needed
    local dir_path=$(dirname "$filepath")
    if [ "$dir_path" != "." ] && [ ! -d "$dir_path" ]; then
        mkdir -p "$dir_path" || {
            echo -e "${RED}[T$thread_id] Failed to create directory: $dir_path${NC}"
            increment_counter "$TEMP_DIR/files_error"
            return 1
        }
    fi
    
    # Write file content
    if echo "$content" > "$filepath"; then
        echo -e "${GREEN}[T$thread_id] ✓ Restored: $filepath${NC}"
        increment_counter "$TEMP_DIR/files_created"
    else
        echo -e "${RED}[T$thread_id] Failed to restore: $filepath${NC}"
        increment_counter "$TEMP_DIR/files_error"
        return 1
    fi
}

# Function to process a single backup file (chooses indexed or legacy)
process_backup_file() {
    local backup_file="$1"
    local index_file="$2"
    local thread_id="$3"
    
    if [ -n "$index_file" ] && [ -f "$index_file" ]; then
        process_backup_indexed "$backup_file" "$index_file" "$thread_id"
    else
        process_backup_legacy "$backup_file" "$thread_id"
    fi
}

# Export functions for parallel processing
export -f process_backup_file process_backup_indexed process_backup_legacy
export -f restore_file_indexed restore_current_file_legacy
export -f increment_counter get_counter acquire_lock release_lock
export -f mac_timeout
export SEPARATOR END_SEPARATOR DRY_RUN FORCE TEMP_DIR TIMEOUT TIMEOUT_CMD
export RED GREEN YELLOW BLUE CYAN PURPLE NC

# Sort backup files for consistent processing order
SORTED_BACKUP_FILES=($(printf '%s\n' "${VALID_BACKUP_FILES[@]}" | sort))
SORTED_INDEX_FILES=()

for backup_file in "${SORTED_BACKUP_FILES[@]}"; do
    for i in "${!VALID_BACKUP_FILES[@]}"; do
        if [ "${VALID_BACKUP_FILES[$i]}" = "$backup_file" ]; then
            SORTED_INDEX_FILES+=("${INDEX_FILES[$i]}")
            break
        fi
    done
done

echo -e "${CYAN}Starting parallel processing with $THREADS threads...${NC}"

# Process backup files with parallel processing
if command -v parallel >/dev/null 2>&1; then
    echo -e "${CYAN}Using GNU parallel for processing...${NC}"
    
    # Create input for parallel: "backup_file|index_file"
    input_pairs=()
    for i in "${!SORTED_BACKUP_FILES[@]}"; do
        input_pairs+=("${SORTED_BACKUP_FILES[$i]}|${SORTED_INDEX_FILES[$i]}")
    done
    
    printf '%s\n' "${input_pairs[@]}" | \
        $TIMEOUT_CMD $TIMEOUT parallel -j "$THREADS" --line-buffer --tagstring '[T{#}]' --halt now,fail=50% \
        'IFS="|" read -r backup_file index_file <<< "{}"; process_backup_file "$backup_file" "$index_file" {#}' || {
        echo -e "${RED}Parallel processing failed or timed out${NC}"
        cleanup_and_exit 1
    }
elif command -v xargs >/dev/null 2>&1; then
    echo -e "${CYAN}Using xargs for processing...${NC}"
    
    # Create input for xargs
    input_pairs=()
    for i in "${!SORTED_BACKUP_FILES[@]}"; do
        input_pairs+=("${SORTED_BACKUP_FILES[$i]}|${SORTED_INDEX_FILES[$i]}")
    done
    
    printf '%s\n' "${input_pairs[@]}" | \
        xargs -n 1 -P "$THREADS" -I {} bash -c 'IFS="|" read -r backup_file index_file <<< "$1"; process_backup_file "$backup_file" "$index_file" $$' _ {} || {
        echo -e "${RED}Xargs processing failed${NC}"
        cleanup_and_exit 1
    }
else
    echo -e "${YELLOW}No parallel processing tool found, falling back to sequential processing...${NC}"
    thread_id=1
    for i in "${!SORTED_BACKUP_FILES[@]}"; do
        process_backup_file "${SORTED_BACKUP_FILES[$i]}" "${SORTED_INDEX_FILES[$i]}" "$thread_id" || {
            echo -e "${RED}Processing failed for ${SORTED_BACKUP_FILES[$i]}${NC}"
            cleanup_and_exit 1
        }
        thread_id=$((thread_id + 1))
    done
fi

# Final statistics
files_processed=$(get_counter "$TEMP_DIR/files_processed")
files_created=$(get_counter "$TEMP_DIR/files_created")
files_skipped=$(get_counter "$TEMP_DIR/files_skipped")
files_error=$(get_counter "$TEMP_DIR/files_error")

echo
echo -e "${BLUE}Restoration Summary:${NC}"
echo "==================="
echo "Files processed: $files_processed"
echo "Files created/updated: $files_created"
echo "Files skipped (existing): $files_skipped"
echo "Files with errors: $files_error"
echo "Backup parts processed: ${#SORTED_BACKUP_FILES[@]}"
echo "Indexed parts: $INDEXED_COUNT"
echo "Legacy parts: $NON_INDEXED_COUNT"
echo

if [ "$files_error" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Some files had errors during restoration${NC}"
    exit_code=1
else
    echo -e "${GREEN}✓ All files restored successfully!${NC}"
    exit_code=0
fi

# Clean up
cleanup_and_exit $exit_code
