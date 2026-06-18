const { spawn } = require('child_process');

class Player {
    constructor() {
        this.mpvProcess = null;
        this.currentVideoId = null;
        this.onFinished = null;
    }

    play(videoId) {
        this.stop();
        this.currentVideoId = videoId;
        
        // Spawn mpv with no video
        this.mpvProcess = spawn('mpv', [
            `https://music.youtube.com/watch?v=${videoId}`,
            '--no-video',
            '--really-quiet'
        ]);

        this.mpvProcess.on('close', (code) => {
            this.mpvProcess = null;
            this.currentVideoId = null;
            if (this.onFinished) {
                this.onFinished();
            }
        });
    }

    stop() {
        if (this.mpvProcess) {
            this.mpvProcess.removeAllListeners('close');
            this.mpvProcess.kill();
            this.mpvProcess = null;
            this.currentVideoId = null;
        }
    }
}

module.exports = new Player();
