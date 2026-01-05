// --- STATE VARIABLES ---
let currentLevel = 'low';
let currentIndex = -1;
let isPlaying = false;
let audioUnlocked = false; 

let audioFiles = { low: [], medium: [], high: [] };
let audioFilesDoomer = { low: [], medium: [], high: [] };

let videoClips = {
    low: "./videos/low_clip.mp4",
    medium: "./videos/medium_clip.mp4",
    high: "./videos/high_clip.mp4"
};

const audioPlayer = document.getElementById('audioPlayer');
const videoPlayer = document.getElementById('backgroundVideo');
const doomerSwitch = document.getElementById('doomerToggle');
const infoBtnLink = document.getElementById('btn-info');
let doomerSpeedMode = "red"; // Red = Normal, Green = Slow/Doomer

const API_URL = "https://script.google.com/macros/s/AKfycbzfITEDH6ig3Waq4yHIoT12IVnZvPXKpuxUNcHFEnzAqqtMzNkQTiYQ7sBXtgerjCACZw/exec";

// --- SHUFFLE HELPER (Fisher-Yates) ---
// This ensures the "Random" feel is high-quality
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- YOUTUBE SETUP ---
let ytPlayer;
let ytReady = false;
let pendingYTTrack = null;

function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player('yt-player', {
        height: '0',
        width: '0',
        videoId: '',
        playerVars: {
            autoplay: 0,
            controls: 0,
            playsinline: 1,
            enablejsapi: 1
        },
        events: {
            onReady: () => {
                ytReady = true;
                if (pendingYTTrack) {
                    playTrackAtIndex(null);
                    pendingYTTrack = null;
                }
            },
            onStateChange: (e) => {
                if (e.data === YT.PlayerState.ENDED) {
                    playTrackAtIndex(null);
                }
            }
        }
    });
}

// --- iOS MEDIA UNLOCK ---
function unlockMobileMedia() {
    if (audioUnlocked) return;
    videoPlayer.muted = true;
    videoPlayer.play().then(() => { if (!isPlaying) videoPlayer.pause(); }).catch(() => {});
    audioPlayer.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
    audioPlayer.play().then(() => { audioPlayer.pause(); audioUnlocked = true; }).catch(() => {});
}

document.addEventListener("touchstart", unlockMobileMedia, { once: true });
document.addEventListener("click", unlockMobileMedia, { once: true });

// --- DATA FETCH & INITIAL SHUFFLE ---
async function fetchAndInitialize() {
    try {
        const res = await fetch(API_URL);
        const rawData = await res.json();

        const formatSheetData = (rows) => {
            if (!rows) return [];
            let formatted = rows.slice(1)
                .filter(row => row[2] && row[2].includes("http"))
                .map(row => ({
                    artist: row[0] || "Unknown Artist",
                    title: row[1] || "Unknown Song",
                    file: row[2],
                    shopifyUrl: row[3] || "#"
                }));
            // RANDOMIZATION: Shuffle every time the app loads
            return shuffleArray(formatted);
        };

        audioFiles.low = formatSheetData(rawData.Low);
        audioFiles.medium = formatSheetData(rawData.Medium);
        audioFiles.high = formatSheetData(rawData.High);

        audioFilesDoomer = JSON.parse(JSON.stringify(audioFiles));
        updateVideoSource();
    } catch (e) {
        console.error("Fetch Error", e);
    }
}

// --- CORE PLAYBACK ---
function getCurrentTrackList() {
    return audioFiles[currentLevel] || [];
}

async function playTrackAtIndex(index = null) {
    const tracks = getCurrentTrackList();
    if (!tracks.length) return;

    // Logic for next song
    if (index === null) {
        currentIndex = (currentIndex + 1) % tracks.length;
    } else {
        currentIndex = index;
    }

    const track = tracks[currentIndex];
    infoBtnLink.href = track.shopifyUrl;

    audioPlayer.pause();
    if (ytReady && ytPlayer?.stopVideo) ytPlayer.stopVideo();

    const isYT = track.file.includes("youtube") || track.file.includes("youtu.be");
    const speed = doomerSpeedMode === "green" ? 0.9 : 1;

    if (isYT) {
        const id = track.file.includes("youtu.be")
            ? track.file.split("/").pop().split("?")[0]
            : new URL(track.file).searchParams.get("v");

        if (ytReady) {
            ytPlayer.loadVideoById(id);
            ytPlayer.playVideo();
            ytPlayer.setPlaybackRate(speed);
            isPlaying = true;
        } else {
            pendingYTTrack = track;
        }
    } else {
        audioPlayer.src = track.file;
        audioPlayer.load();
        try {
            await audioPlayer.play();
            audioPlayer.playbackRate = speed;
            isPlaying = true;
        } catch {
            isPlaying = false;
        }
    }

    updatePlayPauseUI();
    videoPlayer.play().catch(() => {});
}

// --- DOOMER TOGGLE LOGIC ---
doomerSwitch.addEventListener("click", () => {
    // 1. Toggle the mode
    doomerSpeedMode = (doomerSpeedMode === "red") ? "green" : "red";
    
    // 2. Visual Feedback (Update Image)
    // Assuming domer1 is red/off and domer2 is green/active
    if (doomerSpeedMode === "green") {
        doomerSwitch.src = "images/domer.png"; // Make sure you have this image!
        doomerSwitch.classList.add("domer-active");
    } else {
        doomerSwitch.src = "images/domer1.png";
        doomerSwitch.classList.remove("domer-active");
    }

    // 3. Apply speed change immediately to current audio
    const speed = doomerSpeedMode === "green" ? 0.9 : 1;
    audioPlayer.playbackRate = speed;
    if (ytReady && ytPlayer?.setPlaybackRate) {
        ytPlayer.setPlaybackRate(speed);
    }
});

// --- REMAINING CONTROLS ---

async function togglePlay() {
    unlockMobileMedia();
    const tracks = getCurrentTrackList();
    if (!tracks.length) return;

    if (!isPlaying) {
        if (currentIndex === -1) {
            await playTrackAtIndex(null);
        } else {
            if (audioPlayer.src && !audioPlayer.src.includes("data:audio")) audioPlayer.play();
            if (ytReady && ytPlayer?.playVideo) ytPlayer.playVideo();
            videoPlayer.play().catch(() => {});
            isPlaying = true;
        }
    } else {
        audioPlayer.pause();
        if (ytReady && ytPlayer?.pauseVideo) ytPlayer.pauseVideo();
        videoPlayer.pause();
        isPlaying = false;
    }
    updatePlayPauseUI();
}

const sliderThumb = document.querySelector(".slider-thumb");
const sliderTrack = document.querySelector(".slider-track");
const loader = document.getElementById("loader");

function updateVideoSource() {
    videoPlayer.src = videoClips[currentLevel];
    videoPlayer.load();
    if (isPlaying) videoPlayer.play().catch(() => {});
}

sliderTrack.addEventListener("click", async (e) => {
    const rect = sliderTrack.getBoundingClientRect();
    const y = e.clientY - rect.top;
    currentLevel = y < rect.height / 3 ? "low" : y < rect.height * 2 / 3 ? "medium" : "high";
    
    // Shuffle level list again on level change for "fresh experience"
    shuffleArray(audioFiles[currentLevel]);
    currentIndex = -1; 
    
    snapThumbToLevel(currentLevel);
    updateVideoSource();
    if (isPlaying) await playTrackAtIndex(null);
});

function updatePlayPauseUI() {
    document.getElementById("btn-playpause").style.display = isPlaying ? "none" : "inline-block";
    document.getElementById("play-icon").style.display = isPlaying ? "inline-block" : "none";
}

function snapThumbToLevel(level) {
    const h = sliderTrack.getBoundingClientRect().height / 3;
    sliderThumb.style.top = level === "low" ? `${h * 0.5}px` : level === "medium" ? `${h * 1.5}px` : `${h * 2.5}px`;
}

document.getElementById("btn-playpause").addEventListener("click", togglePlay);
document.getElementById("play-icon").addEventListener("click", togglePlay);
document.getElementById("btn-forward").addEventListener("click", () => playTrackAtIndex(null));
document.getElementById("btn-backward").addEventListener("click", () => playTrackAtIndex(null));

audioPlayer.addEventListener("ended", () => playTrackAtIndex(null));

document.addEventListener("DOMContentLoaded", async () => {
    await fetchAndInitialize();
    snapThumbToLevel("low");
});