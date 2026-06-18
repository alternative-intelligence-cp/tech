const blessed = require('blessed');
const ytmusic = require('./ytmusic');
const player = require('./player');

const screen = blessed.screen({
    smartCSR: true,
    title: 'nytmusic'
});

const searchBox = blessed.textbox({
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    border: { type: 'line' },
    label: ' Search (Enter to submit) ',
    inputOnFocus: true
});

const resultsList = blessed.list({
    top: 3,
    left: 0,
    width: '50%',
    height: '100%-6',
    border: { type: 'line' },
    label: ' Search Results ',
    keys: true,
    vi: true,
    style: {
        selected: { bg: 'blue' }
    }
});

const queueList = blessed.list({
    top: 3,
    left: '50%',
    width: '50%',
    height: '100%-6',
    border: { type: 'line' },
    label: ' Queue ',
    keys: true,
    vi: true,
    style: {
        selected: { bg: 'blue' }
    }
});

const nowPlayingBox = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 3,
    border: { type: 'line' },
    content: ' Stopped',
    style: {
        fg: 'green'
    }
});

screen.append(searchBox);
screen.append(resultsList);
screen.append(queueList);
screen.append(nowPlayingBox);

let currentResults = [];
let queue = [];
let isPlaying = false;

searchBox.on('submit', async (text) => {
    if (!text) return;
    nowPlayingBox.setContent(` Searching for: ${text}...`);
    screen.render();
    try {
        const results = await ytmusic.search(text);
        currentResults = results;
        resultsList.setItems(results.map(r => {
            const artist = r.artist ? (r.artist.name || '') : '';
            return `${r.name} - ${artist}`;
        }));
        nowPlayingBox.setContent(' Search complete. Use arrow keys to select, Enter to queue.');
        searchBox.clearValue();
        resultsList.focus();
        screen.render();
    } catch (e) {
        nowPlayingBox.setContent(` Search failed: ${e.message}`);
        screen.render();
    }
});

resultsList.on('select', (item, index) => {
    const track = currentResults[index];
    if (track) {
        queue.push(track);
        updateQueueUI();
        if (!isPlaying) {
            playNext();
        }
    }
});

queueList.on('select', (item, index) => {
    // Play selected track from queue
    if (queue[index]) {
        const track = queue[index];
        queue.splice(index, 1);
        queue.unshift(track);
        updateQueueUI();
        playNext();
    }
});

function updateQueueUI() {
    queueList.setItems(queue.map(r => {
        const artist = r.artist ? (r.artist.name || '') : '';
        return `${r.name} - ${artist}`;
    }));
    screen.render();
}

function playNext() {
    if (queue.length === 0) {
        isPlaying = false;
        nowPlayingBox.setContent(' Queue empty. Stopped.');
        screen.render();
        return;
    }

    const track = queue.shift();
    updateQueueUI();
    isPlaying = true;
    
    const artist = track.artist ? (track.artist.name || '') : '';
    nowPlayingBox.setContent(` ▶ Playing: ${track.name} - ${artist}  |  Press 's' to Stop, 'n' to Skip`);
    screen.render();

    player.play(track.videoId);
}

player.onFinished = () => {
    playNext();
};

screen.key(['escape', 'q', 'C-c'], (ch, key) => {
    player.stop();
    return process.exit(0);
});

searchBox.key(['escape'], () => {
    resultsList.focus();
});

resultsList.key(['tab', 'right'], () => {
    queueList.focus();
});

queueList.key(['tab', 'left'], () => {
    resultsList.focus();
});

screen.key(['/'], () => {
    searchBox.focus();
});

screen.key(['s'], () => {
    player.stop();
    isPlaying = false;
    nowPlayingBox.setContent(' Stopped manually.');
    screen.render();
});

screen.key(['n'], () => {
    if (isPlaying) {
        player.stop(); // Manually stop the current track
        playNext();    // And trigger the next one
    }
});

module.exports = {
    start: () => {
        searchBox.focus();
        screen.render();
    }
};
