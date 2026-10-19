const fs = require('fs');
const path = require('path');

const PLAYLIST_URL = "https://server-iota-nine-71.vercel.app/api/event";
const IMG_DIR = path.join(__dirname, 'images');

if (!fs.existsSync(IMG_DIR)) {
    fs.mkdirSync(IMG_DIR);
}

function getSafeFileName(title) {
    return title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.jpg';
}

// YouTube se Horizontal (16:9) Thumbnail nikalne ka function (Shorts Skip karke)
async function getYouTubeThumbUrl(title) {
    try {
        let cleanTitle = title.trim().replace(/^Live[\-\s]*/i, '');
        // Search query me '-shorts' filter add kiya hai
        const searchQuery = encodeURIComponent(cleanTitle + " match live -shorts");

        const response = await fetch("https://www.youtube.com/results?search_query=" + searchQuery, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        const html = await response.text();

        // Regular 16:9 video renderer ID extract kar rahe hain (Shorts/Reels renderer skip ho jata hai)
        const videoMatch = html.match(/"videoRenderer":\s*\{"videoId":"([^"]+)"/);

        if (videoMatch && videoMatch[1]) {
            const videoId = videoMatch[1];
            // hqdefault.jpg hamesha 16:9 landscape aspect ratio me rehta hai
            return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }

        // Fallback agar videoRenderer na mile
        const fallbackMatch = html.match(/"videoId":"([^"]+)"/);
        if (fallbackMatch && fallbackMatch[1]) {
            return `https://img.youtube.com/vi/${fallbackMatch[1]}/hqdefault.jpg`;
        }
    } catch (e) {
        console.log("YT Fetch Error:", e);
    }

    // Default Fallback Image agar YT pe kuch na mile
    return "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800";
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

        // CHECK: Agar image GitHub pe pehle se download hai, toh dubara YT fetch nahi karega!
        if (!fs.existsSync(filePath)) {
            console.log(`Searching YT & Downloading image for: ${title}`);
            const ytThumbUrl = await getYouTubeThumbUrl(title);
            try {
                const imgRes = await fetch(ytThumbUrl);
                const buffer = await imgRes.arrayBuffer();
                fs.writeFileSync(filePath, Buffer.from(buffer));
            } catch (err) {
                console.log("Download Error:", err);
            }
        } else {
            console.log(`Image already exists on GitHub: ${title}`);
        }

        const directImageUrl = rawBaseUrl + fileName;

        if (/tvg-logo="[^"]*"/i.test(block)) {
            block = block.replace(/tvg-logo="[^"]*"/i, `tvg-logo="${directImageUrl}"`);
        } else {
            block = block.replace("#EXTINF:-1", `#EXTINF:-1 tvg-logo="${directImageUrl}"`);
        }

        finalPlaylist += block.trim() + "\n\n";
    }

    // CLEANUP: Jo live stream over ho chuki hain, unki images ko GitHub storage se delete kar do
    const existingFiles = fs.readdirSync(IMG_DIR);
    for (const file of existingFiles) {
        if (!activeFiles.has(file)) {
            console.log(`Deleting old stream image: ${file}`);
            fs.unlinkSync(path.join(IMG_DIR, file));
        }
    }

    fs.writeFileSync(path.join(__dirname, 'playlist.m3u'), finalPlaylist, 'utf8');
    console.log("Playlist & Real YT Images updated successfully!");
}

main();
