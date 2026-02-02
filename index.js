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
// 🔥 YENİ: Tekrarlayan mesajları engellemek için geçici hafıza
const lastMessages = {}; 

console.log("🚀 Sunucu Başlatıldı...");

io.on("connection", (socket) => {
  socket.currentRoom = null;
  socket.username = null;

  // --- ODA OLUŞTURMA ---
  socket.on("CREATE_ROOM", ({ roomName, password, username }) => {
    if (rooms[roomName]) {
      socket.emit("JOIN_ERROR", "⚠️ BU ODA İSMİ KULLANILIYOR");
    } else {
      rooms[roomName] = { pass: password, users: [] };
      joinLogic(socket, roomName, username);
      socket.emit("JOIN_SUCCESS", "ODA OLUŞTURULDU");
    }
  });

  // --- ODAYA KATILMA ---
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

    // 🔊 VOICE: Odaya yeni biri geldi, diğerlerine haber ver
    socket.to(room).emit("VOICE_USER_JOINED", { socketId: socket.id, username: user });
  }

  // --- VİDEO EYLEMLERİ ---
  socket.on("ACTION", (data) => {
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit("SYNC_ACTION", data);
    }
  });

  // --- 🔥 CHAT ---
  socket.on("SEND_CHAT", (data) => {
    if (socket.currentRoom) {
      const room = socket.currentRoom;
      if (lastMessages[room] && 
          lastMessages[room].text === data.text && 
          lastMessages[room].username === data.username && 
          lastMessages[room].time === data.time) {
          return;
      }

      lastMessages[room] = data;
      io.to(room).emit("RECEIVE_CHAT", data);
    }
  });

  // ================================
  // 🔊 VOICE CHAT (WEBRTC SİNYALLEŞME)
  // ================================

  socket.on("VOICE_OFFER", ({ targetId, offer }) => {
    io.to(targetId).emit("VOICE_OFFER", {
      from: socket.id,
      username: socket.username,
      offer
    });
  });

  socket.on("VOICE_ANSWER", ({ targetId, answer }) => {
    io.to(targetId).emit("VOICE_ANSWER", {
      from: socket.id,
      answer
    });
  });

  socket.on("VOICE_ICE_CANDIDATE", ({ targetId, candidate }) => {
    io.to(targetId).emit("VOICE_ICE_CANDIDATE", {
      from: socket.id,
      candidate
    });
  });

  // --- ÇIKIŞ ---
  socket.on("disconnect", () => {
    const r = socket.currentRoom;
    if (r && rooms[r]) {
      rooms[r].users = rooms[r].users.filter(u => u !== socket.username);
      io.to(r).emit("UPDATE_USER_LIST", rooms[r].users);

      // 🔊 VOICE: Odadakilere biri çıktı bilgisini ver
      socket.to(r).emit("VOICE_USER_LEFT", { socketId: socket.id });

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
