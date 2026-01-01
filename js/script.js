// --- STATE VARIABLES ---
let currentLevel = 'low';
let currentIndex = -1;
let isPlaying = false;
let audioUnlocked = false; 

// Data objects
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
let doomerSpeedMode = "red";

const API_URL = "https://script.google.com/macros/s/AKfycbzfITEDH6ig3Waq4yHIoT12IVnZvPXKpuxUNcHFEnzAqqtMzNkQTiYQ7sBXtgerjCACZw/exec";

// --- YOUTUBE SETUP ---
let ytPlayer;
let ytReady = false;
let pendingYTTrack = null;

function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player('yt-player', {
        height: '0', width: '0', videoId: '',
        playerVars: { 'autoplay': 0, 'controls': 0, 'playsinline': 1, 'enablejsapi': 1 },
        events: {
            onReady: () => {
                ytReady = true;
                if (pendingYTTrack) {
                    playTrackAtIndex(currentIndex);
                    pendingYTTrack = null;
                }
            },
            onStateChange: (e) => {
                if (e.data === YT.PlayerState.ENDED) playTrackAtIndex(currentIndex + 1);
            }
        }
    });
}

// --- iOS CRITICAL FIX: UNLOCKER ---
function unlockMobileMedia() {
    if (audioUnlocked) return;

    // 1. Video Fix
    videoPlayer.muted = true;
    videoPlayer.setAttribute('playsinline', 'true');
    videoPlayer.setAttribute('webkit-playsinline', 'true');
    videoPlayer.play().then(() => {
        if (!isPlaying) videoPlayer.pause();
    }).catch(err => console.log("Video priming failed", err));

    // 2. Audio Fix (Play silent sound to 'warm up' the audio context)
    audioPlayer.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA=="; 
    audioPlayer.play().then(() => {
        audioPlayer.pause();
        audioUnlocked = true;
        console.log("iOS Audio Unlocked");
    }).catch(err => console.log("Audio priming failed", err));
}

// Use both click and touchstart for faster response on mobile
document.addEventListener("touchstart", unlockMobileMedia, { once: true });
document.addEventListener("click", unlockMobileMedia, { once: true });

// --- DATA FETCHING ---
async function fetchAndInitialize() {
    try {
        const res = await fetch(API_URL);
        const rawData = await res.json();

        const formatSheetData = (rows) => {
            if (!rows) return [];
            return rows.slice(1)
                .filter(row => row[2] && row[2].toString().includes('http'))
                .map(row => ({
                    artist: row[0]?.toString().trim() || "Unknown Artist",
                    title: row[1]?.toString().trim() || "Unknown Song",
                    file: row[2].toString().trim(),
                    shopifyUrl: row[3]?.toString().trim() || "#"
                }));
        };

        audioFiles.low = formatSheetData(rawData.Low);
        audioFiles.medium = formatSheetData(rawData.Medium);
        audioFiles.high = formatSheetData(rawData.High);
        audioFilesDoomer = JSON.parse(JSON.stringify(audioFiles));

        updateVideoSource();
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

// --- CORE PLAYBACK ---
function getCurrentTrackList() {
    return doomerSwitch.classList.contains('domer-active') ? audioFilesDoomer[currentLevel] : audioFiles[currentLevel];
}

function updateVideoSource() {
    videoPlayer.muted = true; 
    videoPlayer.playsInline = true;
    videoPlayer.src = videoClips[currentLevel];
    videoPlayer.load();
    
    if (isPlaying) {
        videoPlayer.play().catch(e => console.log("Video wait for interaction"));
    }
}

async function playTrackAtIndex(index) {
    const tracks = getCurrentTrackList();
    if (!tracks || tracks.length === 0) return;

    if (index >= tracks.length) index = 0;
    if (index < 0) index = tracks.length - 1;

    const track = tracks[index];
    currentIndex = index;
    infoBtnLink.href = track.shopifyUrl || "#";

    // Stop current media
    audioPlayer.pause();
    if (ytReady && ytPlayer?.stopVideo) ytPlayer.stopVideo();

    const isYouTube = track.file.includes("youtube") || track.file.includes("youtu.be");

    if (isYouTube) {
        const id = track.file.includes("youtu.be") ? track.file.split("/").pop().split("?")[0] : new URL(track.file).searchParams.get("v");
        if (ytReady && ytPlayer?.loadVideoById) {
            ytPlayer.loadVideoById(id);
            ytPlayer.playVideo();
            ytPlayer.setPlaybackRate(doomerSpeedMode === "green" ? 0.9 : 1);
            isPlaying = true;
            updatePlayPauseUI();
        } else {
            pendingYTTrack = track;
        }
    } else {
        audioPlayer.src = track.file;
        audioPlayer.load();
        // iOS requires the play() promise to be handled
        try {
            await audioPlayer.play();
            audioPlayer.playbackRate = doomerSpeedMode === "green" ? 0.9 : 1;
            isPlaying = true;
            updatePlayPauseUI();
        } catch (e) {
            console.warn("Playback failed. User interaction might be required.", e);
            isPlaying = false;
            updatePlayPauseUI();
        }
    }
    videoPlayer.play().catch(() => {});
}

async function togglePlay() {
    // Har toggle par unlock function call karein (safety ke liye)
    unlockMobileMedia();

    const tracks = getCurrentTrackList();
    if (!tracks.length) return;

    if (!isPlaying) {
        if (currentIndex === -1) currentIndex = 0;
        await playTrackAtIndex(currentIndex);
    } else {
        if (ytReady && ytPlayer) ytPlayer.pauseVideo();
        audioPlayer.pause();
        videoPlayer.pause();
        isPlaying = false;
    }
    updatePlayPauseUI();
}

// --- SLIDER LOGIC ---
const sliderThumb = document.querySelector(".slider-thumb");
const sliderTrack = document.querySelector(".slider-track");
const loader = document.getElementById("loader");
let isLoading = false;

function showLoader() {
    loader.classList.remove("hidden");
    isLoading = true;
}

function hideLoader() {
    loader.classList.add("hidden");
    isLoading = false;
}

videoPlayer.addEventListener("canplay", hideLoader);

sliderTrack.addEventListener("click", async (e) => {
    unlockMobileMedia(); 
    if (isLoading) return;

    const trackRect = sliderTrack.getBoundingClientRect();
    const clickY = e.clientY - trackRect.top;
    const trackHeight = trackRect.height;

    let newLevel = clickY < trackHeight / 3 ? "low" : (clickY < 2 * trackHeight / 3 ? "medium" : "high");

    if (newLevel === currentLevel) return;

    currentLevel = newLevel;
    currentIndex = 0;
    
    showLoader();
    snapThumbToLevel(newLevel);
    updateVideoSource();

    if (isPlaying) await playTrackAtIndex(0);
});

// --- UI & HELPERS ---
function updatePlayPauseUI() {
    const btnPlayPause = document.getElementById("btn-playpause");
    const playIcon = document.getElementById("play-icon");
    if (isPlaying) {
        btnPlayPause.style.display = "none";
        playIcon.style.display = "inline-block";
    } else {
        btnPlayPause.style.display = "inline-block";
        playIcon.style.display = "none";
    }
}

function snapThumbToLevel(level) {
    const trackRect = sliderTrack.getBoundingClientRect();
    const thumbHeight = sliderThumb.offsetHeight;
    const segmentHeight = trackRect.height / 3;
    let posY = 0;
    if (level === 'low') posY = segmentHeight / 1.5 - thumbHeight / 2;
    else if (level === 'medium') posY = segmentHeight * 1.5 - thumbHeight / 2;
    else if (level === 'high') posY = segmentHeight * 2.5 - thumbHeight / 2;
    sliderThumb.style.top = `${posY}px`;
}

// --- EVENT LISTENERS ---
document.getElementById("btn-playpause").addEventListener("click", togglePlay);
document.getElementById("play-icon").addEventListener("click", togglePlay);
document.getElementById("btn-forward").addEventListener("click", () => playTrackAtIndex(currentIndex + 1));
document.getElementById("btn-backward").addEventListener("click", () => playTrackAtIndex(currentIndex - 1));

doomerSwitch.addEventListener("click", () => {
    doomerSpeedMode = doomerSpeedMode === "red" ? "green" : "red";
    const speed = doomerSpeedMode === "green" ? 0.90 : 1;
    if (audioPlayer.src) audioPlayer.playbackRate = speed;
    if (ytReady && ytPlayer?.setPlaybackRate) ytPlayer.setPlaybackRate(speed);
    doomerSwitch.classList.toggle("domer-active");
});

audioPlayer.addEventListener("ended", () => playTrackAtIndex(currentIndex + 1));

document.addEventListener("DOMContentLoaded", async () => {
    await fetchAndInitialize();
    snapThumbToLevel("low");
});