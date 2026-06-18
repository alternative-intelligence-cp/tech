# nytmusic

A blazing fast, native terminal UI (TUI) for playing YouTube Music, built for the Alternative Intelligence ecosystem.

## Features
- **Search**: Instantly search YouTube Music for tracks.
- **Queue System**: Queue up multiple tracks.
- **Background Audio**: Flawless, buffer-free audio playback powered by `mpv` and `yt-dlp`.
- **Keyboard Navigation**: Vim-style navigation and custom hotkeys (`s` to stop, `n` to skip).

## Installation

### Prerequisites
You must have `mpv` and a recent version of `yt-dlp` installed on your system.

```bash
# Ubuntu/Debian
sudo apt install mpv
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

### Setup
```bash
npm install
npm run start
```

## Usage
- Type your search and press **Enter**.
- Use the **Arrow keys** or **vi keys (j/k)** to navigate results.
- Press **Enter** to add a track to the Queue.
- Press **s** to stop playback manually.
- Press **n** to skip to the next track in the queue.
- Press **Tab** to switch between the Results and Queue panes.
- Press **/** to return to the Search bar.
- Press **Esc** or **Q** to exit the application.
