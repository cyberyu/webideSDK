#!/bin/bash

# Fixed Restore Script: Read backup file(s) and restore all files to original locations
# Usage: ./restore_files_fixed.sh <backup_files...> [--dry-run] [--force]

set -e

# Parse arguments to separate backup files from options
BACKUP_FILES=()
DRY_RUN=false
FORCE=false
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
        -*)
            echo "Unknown option $arg"
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
NC='\033[0m' # No Color

# Validate backup files
if [ ${#BACKUP_FILES[@]} -eq 0 ]; then
    echo -e "${RED}Error: No backup files specified${NC}"
    echo "Usage: $0 <backup_files...> [--dry-run] [--force]"
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

echo -e "${YELLOW}Backup restoration starting...${NC}"
echo "Backup files: ${SORTED_BACKUP_FILES[*]}"
echo "Number of parts: ${#SORTED_BACKUP_FILES[@]}"
echo

# Initialize counters
files_restored=0
files_skipped=0
files_failed=0
conflicts=0

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

# Function to prompt for overwrite
prompt_overwrite() {
    local filepath="$1"
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}  Would overwrite: $filepath${NC}"
        return 0
    fi
    
    echo -e "${YELLOW}File exists: $filepath${NC}"
    read -p "Overwrite? (y/N/a=all/q=quit): " -n 1 -r
    echo
    
    case $REPLY in
        [Yy])
            return 0
            ;;
        [Aa])
            FORCE=true
            return 0
            ;;
        [Qq])
            echo -e "${RED}Restore cancelled by user${NC}"
            exit 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Function to process a single backup file
process_backup_file() {
    local backup_file="$1"
    echo -e "${BLUE}Processing: $backup_file${NC}"
    
    local current_file=""
    local current_content=""
    local in_file=false
    local file_line_count=0
    
    while IFS= read -r line; do
        file_line_count=$((file_line_count + 1))
        
        # Show progress every 1000 lines
        if [ $((file_line_count % 1000)) -eq 0 ]; then
            echo -e "${BLUE}  Processed $file_line_count lines in $backup_file...${NC}"
        fi
        
        # Check for file header
        if [[ "$line" == "$SEPARATOR"* ]]; then
            # Save previous file if we were processing one
            if [ "$in_file" = true ] && [ -n "$current_file" ]; then
                restore_current_file "$current_file" "$current_content"
            fi
            
            # Start new file
            current_file="${line#$SEPARATOR}"
            current_content=""
            in_file=true
            
        elif [[ "$line" == "$END_SEPARATOR" ]]; then
            # End of current file
            if [ "$in_file" = true ] && [ -n "$current_file" ]; then
                restore_current_file "$current_file" "$current_content"
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
        restore_current_file "$current_file" "$current_content"
    fi
    
    echo -e "${GREEN}  ✓ Completed processing $backup_file${NC}"
}

# Function to restore a single file
restore_current_file() {
    local filepath="$1"
    local content="$2"
    
    local dir_path
    dir_path=$(dirname "$filepath")
    
    if should_restore_file "$filepath" || prompt_overwrite "$filepath"; then
        files_restored=$((files_restored + 1))
        echo -e "${GREEN}  Restoring: $filepath${NC}"
        
        if [ "$DRY_RUN" = false ]; then
            # Create directory if needed
            if [ "$dir_path" != "." ] && [ "$dir_path" != "./" ]; then
                mkdir -p "$dir_path"
            fi
            
            # Write file content
            if printf '%s' "$content" > "$current_file"; then
                echo -e "${GREEN}    ✓ Created successfully${NC}"
            else
                echo -e "${RED}    ✗ Failed to create${NC}"
                files_failed=$((files_failed + 1))
                files_restored=$((files_restored - 1))
            fi
        else
            echo -e "${BLUE}    ✓ Would create${NC}"
        fi
    else
        files_skipped=$((files_skipped + 1))
        conflicts=$((conflicts + 1))
        echo -e "${YELLOW}    - Skipped (exists)${NC}"
    fi
}

# Process each backup file in order
for backup_file in "${SORTED_BACKUP_FILES[@]}"; do
    process_backup_file "$backup_file"
done

# Print summary
echo
echo -e "${BLUE}Restore Summary:${NC}"
echo "================"
echo "Files restored: $files_restored"
echo "Files skipped: $files_skipped"
echo "Files failed: $files_failed"
echo "Conflicts detected: $conflicts"

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}This was a dry run. No files were actually created.${NC}"
    echo "Run without --dry-run to perform the actual restore."
elif [ $files_failed -eq 0 ]; then
    echo -e "${GREEN}✓ Restore completed successfully!${NC}"
else
    echo -e "${RED}✗ Restore completed with $files_failed failures${NC}"
    exit 1
fi
