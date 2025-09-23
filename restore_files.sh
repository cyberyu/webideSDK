#!/bin/bash

# Restore Script: Read backup file(s) and restore all files to original locations
# Usage: ./restore_files.sh <backup_files...> [--dry-run] [--force]
# Examples: 
#   ./restore_files.sh backup.part*.txt
#   ./restore_files.sh backup.part001.txt backup.part002.txt --dry-run

set -e

# Parse arguments to separate backup files from options
BACKUP_FILES=()
OPTIONS=()
for arg in "$@"; do
    case $arg in
        --dry-run)
            OPTIONS+=("$arg")
            ;;
        --force)
            OPTIONS+=("$arg")
            ;;
        -*)
            OPTIONS+=("$arg")
            ;;
        *)
            BACKUP_FILES+=("$arg")
            ;;
    esac
done

DRY_RUN=false
FORCE=false
SEPARATOR="=== FILE: "
END_SEPARATOR="=== END FILE ==="

# Process options
for option in "${OPTIONS[@]}"; do
    case $option in
        --dry-run)
            DRY_RUN=true
            ;;
        --force)
            FORCE=true
            ;;
    esac
done

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        -*)
            echo "Unknown option $1"
            exit 1
            ;;
        *)
            if [ -z "$BACKUP_FILE" ]; then
                BACKUP_FILE="$1"
            fi
            shift
            ;;
    esac
done

# Validate input
if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}Usage: $0 <backup_file> [--dry-run] [--force]${NC}"
    echo
    echo "Options:"
    echo "  --dry-run    Show what would be restored without actually creating files"
    echo "  --force      Overwrite existing files without prompting"
    exit 1
fi

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

# Sort backup files to process in correct order
IFS=$'\n' SORTED_BACKUP_FILES=($(sort <<<"${BACKUP_FILES[*]}"))
unset IFS

echo -e "${BLUE}WebIDE Repository Restore Script${NC}"
echo "================================="
echo "Backup files: ${SORTED_BACKUP_FILES[*]}"
echo "Number of parts: ${#SORTED_BACKUP_FILES[@]}"
echo "Dry run: $DRY_RUN"
echo "Force overwrite: $FORCE"
echo

# Initialize counters
files_restored=0
files_skipped=0
files_failed=0
conflicts=0

# Function to create directory if it doesn't exist
create_directory() {
    local dir="$1"
    if [ -n "$dir" ] && [ "$dir" != "." ]; then
        if [ "$DRY_RUN" = false ]; then
            mkdir -p "$dir"
        fi
        echo -e "${BLUE}  Created directory: $dir${NC}"
    fi
}

# Function to check if file should be restored
should_restore_file() {
    local filepath="$1"
    
    if [ ! -e "$filepath" ]; then
        return 0  # File doesn't exist, safe to create
    fi
    
    if [ "$FORCE" = true ]; then
        return 0  # Force mode, overwrite existing
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

# Read backup file header and show info
echo -e "${YELLOW}Reading backup file header...${NC}"
head -20 "$BACKUP_FILE" | grep "^#" | while read line; do
    echo -e "${BLUE}$line${NC}"
done
echo

# Process backup files
echo -e "${YELLOW}Processing files...${NC}"

# Function to process a single backup file
process_backup_file() {
    local backup_file="$1"
    echo -e "${BLUE}  Processing: $backup_file${NC}"
    
    local file_line_count=0
    while IFS= read -r line; do
        file_line_count=$((file_line_count + 1))
        
        # Show progress every 1000 lines
        if [ $((file_line_count % 1000)) -eq 0 ]; then
            echo -e "${BLUE}    Processed $file_line_count lines in $backup_file...${NC}"
        fi
    
    # Check for file header
    if [[ "$line" == "$SEPARATOR"* ]]; then
        # Save previous file if we were processing one
        if [ "$in_file" = true ] && [ -n "$current_file" ]; then
            # Process the accumulated file content
            dir_path=$(dirname "$current_file")
            
            if should_restore_file "$current_file" || prompt_overwrite "$current_file"; then
                files_restored=$((files_restored + 1))
                echo -e "${GREEN}  Restoring: $current_file${NC}"
                
                if [ "$DRY_RUN" = false ]; then
                    # Create directory if needed
                    if [ "$dir_path" != "." ] && [ "$dir_path" != "./" ]; then
                        mkdir -p "$dir_path"
                    fi
                    
                    # Write file content
                    if echo "$current_content" | head -c -1 > "$current_file"; then
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
        fi
        
        # Start new file
        current_file="${line#$SEPARATOR}"
        current_content=""
        in_file=true
        
    elif [[ "$line" == "$END_SEPARATOR" ]]; then
        # End of current file
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
}

# Initialize file processing variables
current_file=""
current_content=""
in_file=false

# Process each backup file in order
for backup_file in "${SORTED_BACKUP_FILES[@]}"; do
    process_backup_file "$backup_file"
done

# Process the last file if needed
if [ "$in_file" = true ] && [ -n "$current_file" ]; then
    dir_path=$(dirname "$current_file")
    
    if should_restore_file "$current_file" || prompt_overwrite "$current_file"; then
        files_restored=$((files_restored + 1))
        echo -e "${GREEN}  Restoring: $current_file${NC}"
        
        if [ "$DRY_RUN" = false ]; then
            if [ "$dir_path" != "." ] && [ "$dir_path" != "./" ]; then
                mkdir -p "$dir_path"
            fi
            
            if echo "$current_content" | head -c -1 > "$current_file"; then
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
fi

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
