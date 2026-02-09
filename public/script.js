const socket = io();

const localAudio = document.getElementById('localAudio');
const remoteAudio = document.getElementById('remoteAudio');
const callBtn = document.getElementById('callBtn');
const statusDiv = document.getElementById('status');

let localStream;
let peerConnection;

const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

async function init() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localAudio.srcObject = localStream; 
        statusDiv.innerText = "Microphone access granted.";
    } catch (err) {
        console.error('Error accessing media devices.', err);
        statusDiv.innerText = "Error: Microphone access denied!";
    }
}
init();

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(config);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        console.log("Remote stream received!");
        remoteAudio.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate);
        }
    };
}

callBtn.addEventListener('click', async () => {
    createPeerConnection();
    
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    socket.emit('offer', offer);
    statusDiv.innerText = "Calling...";
});

socket.on('offer', async (offer) => {
    createPeerConnection();
    
    await peerConnection.setRemoteDescription(offer);
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    socket.emit('answer', answer);
    statusDiv.innerText = "Incoming Call... Connected!";
});

socket.on('answer', async (answer) => {
    if (!peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(answer);
        statusDiv.innerText = "Call Connected!";
    }
});

socket.on('ice-candidate', async (candidate) => {
    if (peerConnection) {
        try {
            await peerConnection.addIceCandidate(candidate);
        } catch (e) {
            console.error('Error adding received ice candidate', e);
        }
    }
});