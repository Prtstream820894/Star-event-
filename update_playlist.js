const fs = require('fs');
const path = require('path');

const PLAYLIST_URL = "https://server-iota-nine-71.vercel.app/api/event";
const IMG_DIR = path.join(__dirname, 'images');

if (!fs.existsSync(IMG_DIR)) {
    fs.mkdirSync(IMG_DIR);
}

function getSafeFileName(title) {
    return title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.png';
}

// Direct real image URL generator (Jo ki ek asli PNG image return karega)
function getDirectPngUrl(title) {
    let cleanTitle = title.trim().replace(/^Live[\-\s]*/i, '');
    let parts = cleanTitle.split('-');
    if (parts.length >= 2 && parts[0].trim() === parts[1].trim()) {
        cleanTitle = parts[0].trim();
    } else if (parts.length > 2) {
        cleanTitle = (parts[0] + " " + parts[1]).trim();
    }

    const teamsWithFlags = {
        "INDIA": "🇮🇳 INDIA", "IND": "🇮🇳 IND",
        "AUSTRALIA": "🇦🇺 AUSTRALIA", "AUS": "🇦🇺 AUS",
        "PAKISTAN": "🇵🇰 PAKISTAN", "PAK": "🇵🇰 PAK",
        "ENGLAND": "🏴󠁧󠁢󠁥󠁮󠁧󠁿 ENGLAND", "ENG": "🏴󠁧󠁢󠁥󠁮󠁧󠁿 ENG",
        "SOUTH AFRICA": "🇿🇦 SOUTH AFRICA", "SA": "🇿🇦 SA",
        "NEW ZEALAND": "🇳🇿 NEW ZEALAND", "NZ": "🇳🇿 NZ",
        "SRI LANKA": "🇱🇰 SRI LANKA", "SL": "🇱🇰 SL",
        "BANGLADESH": "🇧🇩 BANGLADESH", "BAN": "🇧🇩 BAN",
        "AFGHANISTAN": "🇦🇫 AFGHANISTAN", "AFG": "🇦🇫 AFG"
    };

    let displayLine = cleanTitle.toUpperCase();
    for (let code in teamsWithFlags) {
        let regex = new RegExp('\\b' + code + '\\b', 'gi');
        displayLine = displayLine.replace(regex, teamsWithFlags[code]);
    }

    let sportEmoji = "🏆";
    let lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('volleyball')) { sportEmoji = "🏐"; }
    else if (lowerTitle.includes('cricket') || lowerTitle.includes('ipl') || lowerTitle.includes('t20')) { sportEmoji = "🏏"; }
    else if (lowerTitle.includes('football') || lowerTitle.includes('soccer') || lowerTitle.includes('ucl')) { sportEmoji = "⚽"; }
    else if (lowerTitle.includes('basketball') || lowerTitle.includes('nba')) { sportEmoji = "🏀"; }
    else if (lowerTitle.includes('tennis')) { sportEmoji = "🎾"; }
    else if (lowerTitle.includes('badminton')) { sportEmoji = "🏸"; }
    else if (lowerTitle.includes('hockey')) { sportEmoji = "🏑"; }
    else if (lowerTitle.includes('kabaddi')) { sportEmoji = "🤼"; }
    else if (lowerTitle.includes('wrestling') || lowerTitle.includes('ufc') || lowerTitle.includes('mma') || lowerTitle.includes('boxing')) { sportEmoji = "🥊"; }
    else if (lowerTitle.includes('f1') || lowerTitle.includes('formula') || lowerTitle.includes('racing')) { sportEmoji = "🏎️"; }

    let displayText = `LIVE STREAM\n\n${displayLine}\n\n${sportEmoji}`;
    
    // QuickChart / Dummyimage API jo direct ek image file degi (.png)
    return `https://dummyimage.com/800x800/0f172a/ffffff.png&text=` + encodeURIComponent(displayText);
}

async function main() {
    console.log("Fetching playlist...");
    const response = await fetch(PLAYLIST_URL);
    const playlistText = await response.text();

    const blocks = playlistText.split("#EXTINF:");
    const activeFiles = new Set();
    let finalPlaylist = "#EXTM3U\n";

    const repoOwner = process.env.GITHUB_REPOSITORY_OWNER || "Prtstream820894";
    const repoName = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : "Star-event-";
    const rawBaseUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/images/`;

    for (let i = 1; i < blocks.length; i++) {
        let block = "#EXTINF:" + blocks[i];
        const firstLineEnd = block.indexOf("\n");
        if (firstLineEnd === -1) {
            finalPlaylist += block + "\n";
            continue;
        }

        const metaLine = block.substring(0, firstLineEnd);
        const commaIndex = metaLine.indexOf(",");
        if (commaIndex === -1) {
            finalPlaylist += block + "\n";
            continue;
        }

        const title = metaLine.substring(commaIndex + 1).trim();
        const fileName = getSafeFileName(title);
        activeFiles.add(fileName);

        const filePath = path.join(IMG_DIR, fileName);

        // Agar image file pehle se nahi bani hai, toh API se download karke direct save karo
        if (!fs.existsSync(filePath)) {
            console.log(`Downloading and saving real image for: ${title}`);
            const imgUrl = getDirectPngUrl(title);
            try {
                const imgRes = await fetch(imgUrl);
                const buffer = await imgRes.arrayBuffer();
                fs.writeFileSync(filePath, Buffer.from(buffer));
            } catch (err) {
                console.log("Image download error:", err);
            }
        } else {
            console.log(`Image already exists: ${title}`);
        }

        const directImageUrl = rawBaseUrl + fileName;

        if (/tvg-logo="[^"]*"/i.test(block)) {
            block = block.replace(/tvg-logo="[^"]*"/i, `tvg-logo="${directImageUrl}"`);
        } else {
            block = block.replace("#EXTINF:-1", `#EXTINF:-1 tvg-logo="${directImageUrl}"`);
        }

        finalPlaylist += block.trim() + "\n\n";
    }

    // Cleanup: Purani unused images delete karna
    const existingFiles = fs.readdirSync(IMG_DIR);
    for (const file of existingFiles) {
        if (!activeFiles.has(file)) {
            console.log(`Deleting unused image: ${file}`);
            fs.unlinkSync(path.join(IMG_DIR, file));
        }
    }

    fs.writeFileSync(path.join(__dirname, 'playlist.m3u'), finalPlaylist, 'utf8');
    console.log("Playlist & Real PNG Images updated successfully!");
}

main();
