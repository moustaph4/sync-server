const http = require("http");
const { Server } = require("socket.io");
const express = require("express");

const app = express();
const httpServer = http.createServer(app);

app.get("/", (req, res) => res.send("✅ SYNC FHAMS SUNUCU AKTİF!!"));

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

const rooms = {};
const lastMessages = {};

console.log("🚀 Sunucu Başlatıldı...");

io.on("connection", (socket) => {
  socket.currentRoom = null;
  socket.username = null;

  socket.on("CREATE_ROOM", ({ roomName, password, username }) => {
    if (rooms[roomName]) {
      socket.emit("JOIN_ERROR", "⚠️ BU ODA İSMİ KULLANILIYOR");
    } else {
      rooms[roomName] = { pass: password, users: [] };
      joinLogic(socket, roomName, username);
      socket.emit("JOIN_SUCCESS", "ODA OLUŞTURULDU");
    }
  });

  socket.on("JOIN_ROOM", ({ roomName, password, username }) => {
    if (!rooms[roomName]) {
      socket.emit("JOIN_ERROR", "❌ BÖYLE BİR ODA YOK");
    } else if (rooms[roomName].pass !== password) {
      socket.emit("JOIN_ERROR", "🔒 ŞİFRE HATALI");
    } else {
      joinLogic(socket, roomName, username);
      socket.emit("JOIN_SUCCESS", "GİRİŞ BAŞARILI");
    }
  });

  function joinLogic(socket, room, user) {
    socket.join(room);
    socket.currentRoom = room;
    socket.username = user;

    if (!rooms[room].users.includes(user)) {
      rooms[room].users.push(user);
    }
    io.to(room).emit("UPDATE_USER_LIST", rooms[room].users);
  }

  socket.on("ACTION", (data) => {
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit("SYNC_ACTION", data);
    }
  });

  socket.on("SEND_CHAT", (data) => {
    if (socket.currentRoom) {
      const room = socket.currentRoom;
      if (
        lastMessages[room] &&
        lastMessages[room].text === data.text &&
        lastMessages[room].username === data.username &&
        lastMessages[room].time === data.time
      ) return;

      lastMessages[room] = data;
      io.to(room).emit("RECEIVE_CHAT", data);
    }
  });

  // 🔥🔥🔥 SES SİNYALİ (SADECE RELAY)
  socket.on("VOICE_OFFER", (data) => {
    socket.to(socket.currentRoom).emit("VOICE_OFFER", data);
  });

  socket.on("VOICE_ANSWER", (data) => {
    socket.to(socket.currentRoom).emit("VOICE_ANSWER", data);
  });

  socket.on("VOICE_ICE", (data) => {
    socket.to(socket.currentRoom).emit("VOICE_ICE", data);
  });
  // 🔥🔥🔥

  socket.on("disconnect", () => {
    const r = socket.currentRoom;
    if (r && rooms[r]) {
      rooms[r].users = rooms[r].users.filter(u => u !== socket.username);
      io.to(r).emit("UPDATE_USER_LIST", rooms[r].users);

      if (rooms[r].users.length === 0) {
        delete rooms[r];
        delete lastMessages[r];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sunucu ${PORT} portunda başlatıldı.`);
});
