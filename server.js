import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const app = express();
const server = createServer(app);
const io = new Server(server);
const allusers = {};

// Get the current directory
const __dirname = dirname(fileURLToPath(import.meta.url));

// Exposing public directory to the outside world
app.use(express.static("public"));

// Handle incoming HTTP requests
app.get("/", (req, res) => {
    console.log("GET Request /");
    res.sendFile(join(__dirname, "/app/index.html"));
});

// Handle socket connections
io.on("connection", (socket) => {
    console.log(`A user connected: Socket ID = ${socket.id}`);

    // Join a user with their username
    socket.on("join-user", (username) => {
        console.log(`${username} joined the socket connection`);
        allusers[username] = { username, id: socket.id };

        // Inform everyone that a new user has joined
        io.emit("joined", allusers);
    });

    // Handle offer from one peer to another
    socket.on("offer", ({ from, to, offer }) => {
        console.log(`Offer from ${from} to ${to}`);

        // Ensure the 'to' user exists
        if (allusers[to]) {
            io.to(allusers[to].id).emit("offer", { from, to, offer });
        } else {
            console.log(`User ${to} not found`);
        }
    });

    // Handle answer from one peer to another
    socket.on("answer", ({ from, to, answer }) => {
        console.log(`Answer from ${to} to ${from}`);

        // Ensure the 'from' user exists
        if (allusers[from]) {
            io.to(allusers[from].id).emit("answer", { from, to, answer });
        } else {
            console.log(`User ${from} not found`);
        }
    });

    // Handle call end signal
    socket.on("end-call", ({ from, to }) => {
        console.log(`Call ended between ${from} and ${to}`);

        if (allusers[to]) {
            io.to(allusers[to].id).emit("end-call", { from, to });
        }
    });

    // Inform both parties when a call is fully ended
    socket.on("call-ended", (caller) => {
        const [from, to] = caller;

        if (allusers[from] && allusers[to]) {
            io.to(allusers[from].id).emit("call-ended", caller);
            io.to(allusers[to].id).emit("call-ended", caller);
        }
    });

    // Handle ICE candidate exchange
    socket.on("icecandidate", ({ candidate, to }) => {
        console.log(`ICE candidate from ${socket.id} to ${to}`);

        // Send the candidate to the correct peer
        if (allusers[to]) {
            io.to(allusers[to].id).emit("icecandidate", { candidate });
        } else {
            console.log(`User ${to} not found`);
        }
    });

    // Handle socket disconnection and cleanup
    socket.on("disconnect", () => {
        console.log(`User with Socket ID ${socket.id} disconnected`);

        // Remove the user from the list
        for (const username in allusers) {
            if (allusers[username].id === socket.id) {
                delete allusers[username];
                break;
            }
        }

        // Inform everyone that the user has left
        io.emit("joined", allusers);
    });
});

// Start the server
server.listen(8080, () => {
    console.log(`Server is listening on port 8080`);
});
