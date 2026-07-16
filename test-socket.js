// test-socket.js
const io = require("socket.io-client");

const socket = io("http://localhost:5000", {
    auth: { token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTRhYWQ0NjBlMmJlNGY0NTdjODRjMDAiLCJyb2xlIjoicmVzaWRlbnQiLCJpYXQiOjE3ODM0MjI3NjIsImV4cCI6MTc4NDAyNzU2Mn0.1vsCBZfxmzd89p11RN-vH3wmNl1smbQYH78BdH3uudU" }
});

socket.on("connect", () => {
    console.log("Connected!");
    socket.emit("join:room", "pickup:6a4ccda6951a2dc4e52a8898");
});

socket.on("tracking:update", (data) => {
    console.log("📍 Location:", data);
});

// Send location after 2 seconds
setTimeout(() => {
    socket.emit("tracking:update", {
        roomId: "pickup:6a4ccda6951a2dc4e52a8898",
        lat: 4.0525,
        lng: 9.7055
    });
}, 2000);