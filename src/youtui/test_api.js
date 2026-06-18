const YTMusic = require('ytmusic-api');

async function run() {
    const ytmusic = new YTMusic();
    await ytmusic.initialize();
    console.log("Initialized");
    const results = await ytmusic.search("never gonna give you up");
    console.log(JSON.stringify(results.slice(0, 2), null, 2));
}

run().catch(console.error);
