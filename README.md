# Tech - Portable System Utilities

**Alternative Intelligence Liberation Platform**  
Statically-linked, portable utilities for Linux systems

---

## Overview

This repository contains production-ready, statically-linked binaries compiled with **musl libc** for maximum portability. These tools run on any x86_64 Linux system without requiring shared libraries or specific libc versions.

**Philosophy**: Zero dependencies, maximum portability, minimal size.

---

## Tools

### printc - ANSI Color Printing Utility

**Size**: 37 KB  
**Dependencies**: None (statically linked)

POSIX shell-compatible color printing utility supporting 16 ANSI colors.

**Usage**:

```bash
printc COLOR "message"
printc red "Error: Something went wrong"
printc green "✓ Success!"
printc cyan "Info: Processing..."
```

**Supported Colors** (case-insensitive):

- Basic: black, red, green, yellow, blue, magenta, cyan, white
- Bright: bright_black, bright_red, bright_green, bright_yellow, bright_blue, bright_magenta, bright_cyan, bright_white

**Installation**:

```bash
# System-wide
sudo cp bin/printc /usr/local/bin/

# User-local
cp bin/printc ~/.local/bin/
```

---

### remote - SSH/SCP Session Manager

**Size**: 71 KB  
**Dependencies**: ssh, scp (system utilities)

Wrapper around SSH/SCP with session management and config file support. Uses `printc` for colored output (optional - gracefully degrades to plain text).

**Quick Start**:

```bash
# Set up session
remote --set-user myuser
remote --set-remote server.example.com

# Connect
remote con

# Copy files
remote cpt localfile.txt /remote/path/
remote cpf /remote/path/file.log ./local/
```

**Features**:

- Session persistence across commands
- Config file support with layering
- Password storage (optional, not recommended)
- Colored output with printc integration

**Usage**: Run `remote --help` for full documentation.

---

### foreach - Command Iterator

**Size**: 66 KB  
**Dependencies**: None (statically linked)

Apply a command to each element from args or stdin. Provides `$_THIS_` and `$_THIS_I` for templating, plus a built-in search mode with extensive filters (ext, contains, prune, size/time, uid/gid, perms).

**Usage**:

```bash
foreach "echo $_THIS_" a b c
printf '%s\n' one two three | foreach "echo $_THIS_I: $_THIS_"
foreach -r 2 4 "echo $_THIS_" one two three four five
foreach --search /var/log -s-name "*.log" "echo $_THIS_"
```

**Usage**: Run `foreach --help` for full documentation.

---

### secret - Encrypted Vault Utility

**Size**: 75 KB  
**Dependencies**: openssl, tar, steghide (optional)

Encrypted vault with optional steganographic key hiding. Stores data in a home-based vault by default and supports `--peek` and environment export.

**Quick Start**:

```bash
secret --init
secret --pack --strong "mypass"
secret --list --strong "mypass"
secret --peek api_key.txt --strong "mypass"
```

**Usage**: Run `secret --help` for full documentation.

---

## Building from Source

The source shell scripts are maintained in the [educational](https://github.com/alternative-intelligence/educational) repository for learning purposes.

To compile your own static binaries:

### Prerequisites

```bash
# Install tools
sudo apt install shc upx

# Install musl libc
cd /tmp
wget https://musl.libc.org/releases/musl-1.2.5.tar.gz
tar xzf musl-1.2.5.tar.gz
cd musl-1.2.5
./configure
make
sudo make install
```

### Compilation Process

```bash
# Generate C source from shell script
shc -v -r -f script.sh

# Compile statically with musl
/usr/local/musl/bin/musl-gcc -static -O2 script.sh.x.c -o script.static

# Strip debug symbols
strip script.static

# Compress with UPX (optional)
upx --best --lzma script.static -o script
```

---

## Technical Details

### Why Static Linking?

**Portability**: These binaries run on:

- Minimal systems (Alpine Linux, BusyBox)
- Rescue/recovery environments
- Containers (FROM scratch)
- Older systems with different glibc versions
- Custom Linux distributions (like AriaX)

**No Dependency Hell**: Unlike Flatpak (500MB+ for simple apps) or Snap packages, these tools have:

- Zero runtime dependencies
- No shared library version conflicts
- No framework bloat

### Binary Validation

```bash
# Verify static linking
ldd bin/printc
# Output: "not a dynamic executable"

# Check file type
file bin/printc
# Output: ELF 64-bit LSB executable, x86-64, statically linked, stripped

# Test functionality
./bin/printc green "Hello, World!"
```

---

## Comparison

| Package Type       | Simple Utility Size | Dependencies        | Portability              |
| ------------------ | ------------------- | ------------------- | ------------------------ |
| **Tech Binaries**  | 37-71 KB            | None                | Any Linux x86_64         |
| Flatpak            | 500 MB - 1.5 GB     | Runtime framework   | Flatpak-enabled systems  |
| Snap               | 200-400 MB          | Snap daemon         | Snap-enabled systems     |
| AppImage           | 50-150 MB           | FUSE (sometimes)    | Most Linux systems       |
| Dynamic Binary     | 10-20 KB            | libc, libs          | Same libc version        |

---

## License

See [LICENSE](LICENSE) file.

---

## Contributing

This is a utility repository for production binaries. For source code contributions, see the [educational](https://github.com/alternative-intelligence/educational) repository.

For bug reports or feature requests, please open an issue.

---

## Changelog

### v1.0.0 - 2026-02-07

- Initial release
- `printc`: ANSI color printing utility (37 KB)
- `remote`: SSH/SCP session manager (71 KB)
- `foreach`: Command iterator (66 KB)
- `secret`: Encrypted vault utility (75 KB)
- Both compiled with musl libc for static linking
- UPX compressed for minimal size
