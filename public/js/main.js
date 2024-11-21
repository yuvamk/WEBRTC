const createUserBtn = document.getElementById("create-user");
const username = document.getElementById("username");
const allusersHtml = document.getElementById("allusers");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const endCallBtn = document.getElementById("end-call-btn");
const socket = io();
let localStream;
let caller = [];

// Singleton for peer connection
const PeerConnection = (function () {
    let peerConnection;

    const createPeerConnection = () => {
        const config = {
            iceServers: [
                {
                    urls: 'stun:stun.l.google.com:19302'
                }
            ]
        };
        peerConnection = new RTCPeerConnection(config);

        // Add local stream to peer connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // Handle remote stream and display it in the video element
        peerConnection.ontrack = function (event) {
            remoteVideo.srcObject = event.streams[0];
        };

        // Listen for ICE candidates and send them to the server
        peerConnection.onicecandidate = function (event) {
            if (event.candidate) {
                socket.emit("icecandidate", { candidate: event.candidate, to: caller[1] });
            }
        };

        return peerConnection;
    };

    return {
        getInstance: () => {
            if (!peerConnection) {
                peerConnection = createPeerConnection();
            }
            return peerConnection;
        },
        closeConnection: () => {
            if (peerConnection) {
                peerConnection.close();
                peerConnection = null;
            }
        }
    };
})();

// Handle user creation and joining
createUserBtn.addEventListener("click", () => {
    if (username.value !== "") {
        const usernameContainer = document.querySelector(".username-input");
        socket.emit("join-user", username.value);
        usernameContainer.style.display = 'none';
    }
});

// Handle call ending
endCallBtn.addEventListener("click", () => {
    socket.emit("call-ended", caller);
});

// Handle socket events
socket.on("joined", (allusers) => {
    console.log({ allusers });
    updateUsersList(allusers);
});

// Handle incoming call offer
socket.on("offer", async ({ from, to, offer }) => {
    const pc = PeerConnection.getInstance();
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { from, to, answer: pc.localDescription });
    caller = [from, to];
    endCallBtn.style.display = 'block'; // Show end call button
});

// Handle incoming call answer
socket.on("answer", async ({ from, to, answer }) => {
    const pc = PeerConnection.getInstance();
    await pc.setRemoteDescription(answer);
    endCallBtn.style.display = 'block'; // Show end call button
    caller = [from, to];
});

// Handle incoming ICE candidate
socket.on("icecandidate", async ({ candidate }) => {
    const pc = PeerConnection.getInstance();
    if (candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
});

// Handle call end event
socket.on("end-call", ({ from, to }) => {
    endCall();
});

// Cleanup on call end
socket.on("call-ended", () => {
    endCall();
});

// Update user list dynamically
const updateUsersList = (allusers) => {
    allusersHtml.innerHTML = ""; // Clear the user list

    for (const user in allusers) {
        const li = document.createElement("li");
        li.textContent = `${user} ${user === username.value ? "(You)" : ""}`;

        if (user !== username.value) {
            const button = document.createElement("button");
            button.classList.add("call-btn");
            button.addEventListener("click", () => startCall(user));

            const img = document.createElement("img");
            img.setAttribute("src", "/images/phone.png");
            img.setAttribute("width", 20);

            button.appendChild(img);
            li.appendChild(button);
        }

        allusersHtml.appendChild(li);
    }
};

// Start a call
const startCall = async (user) => {
    console.log({ user });
    const pc = PeerConnection.getInstance();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { from: username.value, to: user, offer: pc.localDescription });
    caller = [username.value, user];
};

// End a call
const endCall = () => {
    PeerConnection.closeConnection();
    endCallBtn.style.display = 'none'; // Hide end call button
    remoteVideo.srcObject = null; // Clear remote video stream
};

// Start local video stream
const startMyVideo = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        localStream = stream;
        localVideo.srcObject = stream;
    } catch (error) {
        console.error("Error accessing local media:", error);
    }
};

// Initialize local video on page load
startMyVideo();
