const peerConnections = {}; // socket id to socket object
var localPeerConnection;

const video = document.getElementById('localVideo')
const videoR1 = document.getElementById('remoteVideo1')
const videoR2 = document.getElementById('remoteVideo2')
const videoR3 = document.getElementById('remoteVideo3')

video.muted = true;

var videoList = [video, videoR1, videoR2, videoR3]
const slots = {} // id to videoList index
var currentIndex = 0

const config = {
    "iceServers": [{ "url": "stun:stun2.1.google.com:19302" }]
};

function addStreamToPage(stream, id){
    //Determine if id is already in the page
    //if it is rewrite
    //if it is not, add to new slot 
    if (!(id in slots)){
        slots[id] = getFirstFreeSlot()
    }
    videoList[slots[id]].srcObject = stream;
}

function getFirstFreeSlot(){
    currentIndex += 1
    return currentIndex
}

var socket = io('https://4af90ae35339.ngrok.io/') //io('ws://localhost:4001');

function startVideo() {
    navigator.mediaDevices.getUserMedia(
        { video: { frameRate: { ideal: 12, max: 12 }}, audio: true,
        video: true }).then(
        stream => {
            video.srcObject = stream; // local feed
            socket.emit("broadcaster");
        }).catch(
        err => console.error(err))
}

socket.on("watcher", id => { //
    
    console.log('recieve watcher from ', id)
    peerConnection = new RTCPeerConnection(config);
    peerConnections[id] = peerConnection;

    let stream = video.srcObject;
    stream.getTracks().forEach(track => peerConnections[id].addTrack(track, stream));

    peerConnections[id].onicecandidate = event => {
        if (event.candidate) {
            socket.emit("candidate", id, event.candidate);
        }
    };

    peerConnections[id].ontrack = event => {
        addStreamToPage(event.streams[0], id);
        // videoR.srcObject = event.streams[0]; // connecting to remote streams 
    };

    peerConnections[id]
        .createOffer()
        .then(sdp => peerConnections[id].setLocalDescription(sdp))
        .then(() => {
            socket.emit("offer", id, peerConnections[id].localDescription);
        });
});

socket.on("answer", (id, description) => {
    console.log('recieve answer from ', id)
    peerConnections[id].setRemoteDescription(description); 
});

socket.on("candidate", (id, candidate) => {
    
    console.log('recieve candidate from ', id)
    
    peerConnections[id]
        .addIceCandidate(new RTCIceCandidate(candidate))
        .catch(e => console.error(e))

    peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("disconnectPeer", id => {
    console.log("Disconnected peer with id: ", id);
    peerConnections[id].close();
    delete peerConnections[id];
});

socket.on("offer", (id, description) => { //
    console.log('recieve offer from ', id)

    peerConnection = new RTCPeerConnection(config);
    peerConnections[id] = peerConnection
    
    let stream = video.srcObject;
    stream.getTracks().forEach(track => peerConnections[id].addTrack(track, stream));

    peerConnections[id]
        .setRemoteDescription(description)
        .then(() => peerConnections[id].createAnswer())
        .then(sdp => peerConnections[id].setLocalDescription(sdp))
        .then(() => {
            socket.emit("answer", id, peerConnections[id].localDescription);
        });
        peerConnections[id].ontrack = event => {
        addStreamToPage(event.streams[0], id);
        // videoR.srcObject = event.streams[0];
    };
    peerConnections[id].onicecandidate = event => {
        if (event.candidate) {
            socket.emit("candidate", id, event.candidate);
        }
    };
});

socket.on("connect", () => {
    console.log("Connected to webRTC");
    socket.emit("watcher", socket.id);
});

socket.on("broadcaster", (id) => {
    console.log("broadcast from ", id)
    socket.emit("watcher", id);
});

socket.on('word_bindings', ids => {
    console.log(ids)
})

window.onunload = window.onbeforeunload = () => {
    socket.close();
};

// close socket on closed window
window.onunload = window.onbeforeunload = () => {
    socket.close();
};

// startVideo();
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/static/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/static/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/static/models'),
    // faceapi.nets.faceExpressionNet.loadFromUri('/static/models')
]).then(startVideo)

video.addEventListener('play', function() { updateFaceData(video); })
videoR1.addEventListener('play', function() { updateFaceData(videoR1); })
videoR2.addEventListener('play', function() { updateFaceData(videoR2); })
videoR3.addEventListener('play', function() { updateFaceData(videoR3); })

function updateFaceData(inputVideo){
    console.log(inputVideo)
    const canvas = faceapi.createCanvasFromMedia(inputVideo)
    inputVideo.parentNode.appendChild(canvas);
    // document.body.append(canvas)
    
    const displaySize = { width: inputVideo.videoWidth, height: inputVideo.videoHeight }
    faceapi.matchDimensions(canvas, displaySize)
    setInterval(async () => {
        const detections = await faceapi.detectSingleFace(inputVideo, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks()
        
        const resizedDetections = faceapi.resizeResults(detections, displaySize)

        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
        faceapi.draw.drawDetections(canvas, resizedDetections)
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
    }, 83)
}