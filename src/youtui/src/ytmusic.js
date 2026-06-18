const YTMusic = require('ytmusic-api');

class MusicAPI {
    constructor() {
        this.api = new YTMusic();
        this.initialized = false;
    }

    async init() {
        if (!this.initialized) {
            await this.api.initialize();
            this.initialized = true;
        }
    }

    async search(query) {
        await this.init();
        const results = await this.api.search(query);
        // Filter out things that aren't playable videos/songs
        return results.filter(r => r.type === 'SONG' || r.type === 'VIDEO');
    }
}

module.exports = new MusicAPI();
