const fs = require('fs');
const path = require('path');

const PLAYLIST_URL = "https://server-iota-nine-71.vercel.app/api/event";
const IMG_DIR = path.join(__dirname, 'images');

// Images folder agar na ho toh bana lo
if (!fs.existsSync(IMG_DIR)) {
    fs.mkdirSync(IMG_DIR);
}

// Title ko safe filename me convert karne ke liye
function getSafeFileName(title) {
    return title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.png';
}

// Simple placeholder/banner SVG ko .png file ke roop me save karne ka logic
function createSvgContent(title) {
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

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
        <rect width="100%" height="100%" fill="#0f172a"/>
        <rect x="40" y="40" width="720" height="720" rx="35" fill="#1e293b" stroke="#334155" stroke-width="6"/>
        <text x="50%" y="170" dominant-baseline="middle" text-anchor="middle" fill="#ef4444" font-family="Arial, sans-serif" font-size="38" font-weight="bold">🔴 LIVE STREAM</text>
        <text x="50%" y="380" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="44" font-weight="bold">${displayLine}</text>
        <text x="50%" y="650" dominant-baseline="middle" text-anchor="middle" font-size="65">${sportEmoji}</text>
    </svg>`;
}

async function main() {
    console.log("Fetching playlist...");
    const response = await fetch(PLAYLIST_URL);
    const playlistText = await response.text();

    const blocks = playlistText.split("#EXTINF:");
    const activeFiles = new Set();
    let finalPlaylist = "#EXTM3U\n";

    // GitHub raw base URL (Aapko yahan apna username aur repo name dalna hoga)
    const repoOwner = process.env.GITHUB_REPOSITORY_OWNER || "AapkaUsername";
    const repoName = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : "RepoName";
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

        // CHECK: Agar image pehle se bani hai toh dubara generate nahi karega!
        if (!fs.existsSync(filePath)) {
            console.log(`Creating new image for: ${title}`);
            const svgData = createSvgContent(title);
            fs.writeFileSync(filePath, svgData, 'utf8');
        } else {
            console.log(`Image already exists, skipping: ${title}`);
        }

        const directImageUrl = rawBaseUrl + fileName;

        if (/tvg-logo="[^"]*"/i.test(block)) {
            block = block.replace(/tvg-logo="[^"]*"/i, `tvg-logo="${directImageUrl}"`);
        } else {
            block = block.replace("#EXTINF:-1", `#EXTINF:-1 tvg-logo="${directImageUrl}"`);
        }

        finalPlaylist += block.trim() + "\n\n";
    }

    // CLEANUP: Jo images ab playlist me nahi hain, unhe delete kar do
    const existingFiles = fs.readdirSync(IMG_DIR);
    for (const file of existingFiles) {
        if (!activeFiles.has(file)) {
            console.log(`Deleting old unused image: ${file}`);
            fs.unlinkSync(path.join(IMG_DIR, file));
        }
    }

    // Final playlist ko file me save karna
    fs.writeFileSync(path.join(__dirname, 'playlist.m3u'), finalPlaylist, 'utf8');
    console.log("Playlist updated successfully!");
}

main();
      
