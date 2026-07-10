import os
import fnmatch

# Configuration
OUTPUT_FILE = "collected_code.md"
DEFAULT_IGNORES = [
    # Directories
    ".git", ".next", "node_modules", "coverage", "build", "out", "dist",
    ".vercel", ".idea", ".vscode", "__pycache__",
    
    # Files
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
    ".DS_Store", ".env", ".env.*", ".env.local",
    "*.tsbuildinfo", "next-env.d.ts",
    "collect_code.py", "collected_code.md", OUTPUT_FILE,
    "thumbs.db",
    
    # Media/Binary Types
    "*.png", "*.jpg", "*.jpeg", "*.gif", "*.ico", "*.svg", "*.webp",
    "*.mp4", "*.webm", "*.mov", "*.mp3", "*.wav",
    "*.pdf", "*.zip", "*.tar", "*.gz", "*.7z", "*.rar",
    "*.eot", "*.ttf", "*.woff", "*.woff2",
    "*.pyc", "*.exe", "*.dll", "*.dylib", "*.so"
]

def load_gitignore(root_dir):
    """
    Reads the .gitignore file and returns a list of patterns.
    """
    patterns = []
    gitignore_path = os.path.join(root_dir, ".gitignore")
    if os.path.exists(gitignore_path):
        try:
            with open(gitignore_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        # Normalize pattern (remove leading slash if present for fnmatch)
                        patterns.append(line)
        except Exception as e:
            print(f"Warning: Could not read .gitignore: {e}")
    return patterns

def should_ignore(path, root_dir, ignore_patterns):
    """
    Determines if a file or directory should be ignored based on patterns.
    """
    name = os.path.basename(path)
    rel_path = os.path.relpath(path, root_dir)
    
    # Split path parts for directory matching
    path_parts = rel_path.split(os.sep)

    for pattern in ignore_patterns:
        # Handle directory-specific patterns (ending with /)
        is_dir_pattern = pattern.endswith("/")
        clean_pattern = pattern.rstrip("/")
        
        # Check against name (e.g., node_modules)
        if fnmatch.fnmatch(name, clean_pattern):
            return True
        
        # Check against relative path (e.g., public/images)
        if fnmatch.fnmatch(rel_path, clean_pattern):
            return True
            
        # Check if any parent directory matches (vital for recursive ignore)
        if any(fnmatch.fnmatch(part, clean_pattern) for part in path_parts):
            return True

        # Handle simplified gitignore-style absolute paths (starting with /)
        if pattern.startswith("/"):
            p = pattern[1:].rstrip("/")
            if rel_path == p or rel_path.startswith(p + os.sep):
                return True
                
    return False

def collect_files(root_dir):
    """
    Walks through the directory, collects relevant code files, and writes to markdown.
    """
    ignore_patterns = DEFAULT_IGNORES + load_gitignore(root_dir)
    
    # Collect all file paths first
    files_to_process = []
    
    print(f"Scanning directory: {root_dir}")
    
    for root, dirs, files in os.walk(root_dir):
        # Modify dirs in-place to prevent walking into ignored directories
        # This is more efficient than checking every file inside ignored dirs
        dirs[:] = [d for d in dirs if not should_ignore(os.path.join(root, d), root_dir, ignore_patterns)]
        
        for file in files:
            file_path = os.path.join(root, file)
            
            if should_ignore(file_path, root_dir, ignore_patterns):
                continue
                
            files_to_process.append(file_path)

    # Write content
    with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
        out.write(f"# Project Code Collection\n")
        out.write(f"**Source Directory**: `{root_dir}`\n")
        out.write(f"**Total Files**: {len(files_to_process)}\n\n")
        out.write("--- \n\n")

        for file_path in sorted(files_to_process):
            rel_path = os.path.relpath(file_path, root_dir)
            ext = os.path.splitext(file_path)[1].lower().replace(".", "") or "txt"
            
            # Skip empty extension if it's a known config file
            if os.path.basename(file_path) == "Dockerfile":
                ext = "dockerfile"
            
            print(f"Processing: {rel_path}")
            
            try:
                content = ""
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                out.write(f"## {rel_path}\n")
                out.write(f"```{ext}\n")
                out.write(content)
                out.write("\n```\n\n")
                
            except UnicodeDecodeError:
                print(f"Skipping binary file: {rel_path}")
                out.write(f"## {rel_path}\n")
                out.write(f"> [Binary File Skipped]\n\n")
            except Exception as e:
                print(f"Error reading {rel_path}: {e}")

    print(f"\nDone! Code collected in {OUTPUT_FILE}")

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    collect_files(current_dir)
