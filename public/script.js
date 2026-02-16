const socket = io();

let localStream;
let remoteStream;
let peerConnection;
let myUsername;
let targetUser; // যার সাথে কথা বলছি

const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// HTML Elements
const loginPanel = document.getElementById('login-panel');
const callPanel = document.getElementById('call-panel');
const incomingPanel = document.getElementById('incoming-call-panel');
const controls = document.getElementById('controls');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// --- ১. ইউজার রেজিস্ট্রেশন ---
function registerUser() {
    const username = document.getElementById('username-input').value;
    if (username) {
        socket.emit('register-user', username);
    }
}

socket.on('register-success', (name) => {
    myUsername = name;
    document.getElementById('my-username').innerText = name;
    loginPanel.classList.add('hidden');
    callPanel.classList.remove('hidden');
    
    // ভিডিও/অডিও পারমিশন নেওয়া
    initializeMedia();
});

socket.on('register-failed', (msg) => alert(msg));


// --- ২. মিডিয়া সেটআপ (ক্যামেরা ও মাইক) ---
async function initializeMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        localVideo.srcObject = localStream;
    } catch (err) {
        alert("Camera/Mic permission needed!");
        console.error(err);
    }
}


// --- ৩. কল করা (Caller Side) ---
async function startCall() {
    targetUser = document.getElementById('target-username').value;
    if (!targetUser || targetUser === myUsername) return alert("Invalid Username");

    createPeerConnection();
    
    // স্ট্রিম অ্যাড করা
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('call-user', { userToCall: targetUser, offer: offer });
    callPanel.classList.add('hidden');
    controls.style.display = 'block';
}


// --- ৪. ইনকামিং কল রিসিভ করা (Receiver Side) ---
let incomingOffer;
let incomingCaller;

socket.on('incoming-call', (data) => {
    incomingPanel.classList.remove('hidden');
    document.getElementById('caller-name').innerText = data.from;
    incomingOffer = data.offer;
    incomingCaller = data.from;
});

async function acceptCall() {
    incomingPanel.classList.add('hidden');
    callPanel.classList.add('hidden');
    controls.style.display = 'block';
    
    targetUser = incomingCaller;
    createPeerConnection();

    // স্ট্রিম অ্যাড করা
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    await peerConnection.setRemoteDescription(incomingOffer);
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    socket.emit('call-accepted', { to: incomingCaller, answer: answer });
}

function rejectCall() {
    incomingPanel.classList.add('hidden');
    socket.emit('call-rejected', { to: incomingCaller });
}

socket.on('call-rejected', () => {
    alert("Call Rejected");
    location.reload(); // পেজ রিফ্রেশ করে রিসেট করা
});


// --- ৫. কানেকশন হ্যান্ডলিং ---
socket.on('call-accepted', async (answer) => {
    await peerConnection.setRemoteDescription(answer);
});

socket.on('ice-candidate', async (candidate) => {
    if (peerConnection) {
        await peerConnection.addIceCandidate(candidate);
    }
});

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(config);

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { to: targetUser, candidate: event.candidate });
        }
    };
}

function endCall() {
    location.reload(); // আপাতত সহজ সমাধান: পেজ রিফ্রেশ
}


// --- ৬. ফিচার্স: মিউট, ভিডিও অফ, স্ক্রিন শেয়ার ---

// অডিও মিউট/আনমিউট
function toggleAudio() {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        document.getElementById('btn-audio').innerText = audioTrack.enabled ? "🎤 Mute" : "🎤 Unmute";
    }
}

// ভিডিও অন/অফ
function toggleVideo() {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        document.getElementById('btn-video').innerText = videoTrack.enabled ? "📷 Video Off" : "📷 Video On";
    }
}

// --- নতুন স্ক্রিন শেয়ার লজিক (Start & Stop) ---

let isScreenSharing = false;
let screenStream;

function toggleScreenShare() {
    if (isScreenSharing) {
        stopScreenShare();
    } else {
        startScreenShare();
    }
}

async function startScreenShare() {
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        // ১. পিয়ার কানেকশনে ভিডিও ট্র্যাক পরিবর্তন করে স্ক্রিন ট্র্যাক পাঠানো
        const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
        if (sender) {
            sender.replaceTrack(screenTrack);
        }

        // ২. নিজের স্ক্রিনেও স্ক্রিন শেয়ার দেখানো
        localVideo.srcObject = screenStream;

        // ৩. বাটনের নাম পরিবর্তন করা
        document.getElementById('btn-screen-share').innerText = "❌ Stop Sharing";
        document.getElementById('btn-screen-share').classList.remove('btn-blue');
        document.getElementById('btn-screen-share').classList.add('btn-red'); // লাল রঙের বাটন
        
        isScreenSharing = true;

        // ৪. যদি কেউ ব্রাউজারের "Stop Sharing" ফ্লোটিং বারে ক্লিক করে
        screenTrack.onended = () => {
            stopScreenShare();
        };

    } catch (err) {
        console.error("Error sharing screen:", err);
    }
}

function stopScreenShare() {
    if (!isScreenSharing) return;

    // ১. আবার ক্যামেরা ট্র্যাকে ফিরে আসা
    const cameraTrack = localStream.getVideoTracks()[0];
    const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
    if (sender) {
        sender.replaceTrack(cameraTrack);
    }

    // ২. নিজের ভিডিওতে আবার ক্যামেরা দেখানো
    localVideo.srcObject = localStream;

    // ৩. স্ক্রিন শেয়ার স্ট্রিম বন্ধ করে দেওয়া
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
    }

    // ৪. বাটন আগের অবস্থায় ফিরিয়ে আনা
    document.getElementById('btn-screen-share').innerText = "🖥 Share Screen";
    document.getElementById('btn-screen-share').classList.remove('btn-red');
    document.getElementById('btn-screen-share').classList.add('btn-blue');
    
    isScreenSharing = false;
}
