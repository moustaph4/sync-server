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

  // Ortak Giriş Mantığı
  function joinLogic(socket, room, user) {
    socket.join(room);
    socket.currentRoom = room;
    socket.username = user;

    if (!rooms[room].users.includes(user)) {
      rooms[room].users.push(user);
    }
    io.to(room).emit("UPDATE_USER_LIST", rooms[room].users);
  }

  // --- VİDEO EYLEMLERİ ---
  socket.on("ACTION", (data) => {
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit("SYNC_ACTION", data);
    }
  });

  // --- 🔥 YENİ EKLENEN KISIM: CHAT SİSTEMİ ---
  socket.on("SEND_CHAT", (data) => {
    if (socket.currentRoom) {
      // Mesajı odadaki herkese gönder
      io.to(socket.currentRoom).emit("RECEIVE_CHAT", data);
    }
  });

  // --- ÇIKIŞ ---
  socket.on("disconnect", () => {
    const r = socket.currentRoom;
    if (r && rooms[r]) {
      rooms[r].users = rooms[r].users.filter(u => u !== socket.username);
      io.to(r).emit("UPDATE_USER_LIST", rooms[r].users);
      
      if (rooms[r].users.length === 0) {
        delete rooms[r];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sunucu ${PORT} portunda başlatıldı.`);
});
