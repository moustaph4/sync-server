const http = require("http");
const { Server } = require("socket.io");
const express = require("express");
const app = express();
const httpServer = http.createServer(app);
app.get("/", (req, res) => res.send("✅ SYNC FHAMS SUNUCU AKTİF!!"));
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  // 👇 Bağlantı kopmalarını önlemek için hem WebSocket hem Polling açtık
  transports: ['websocket', 'polling'], 
  pingTimeout: 60000, // 60 sn
  pingInterval: 25000 // 25 sn
});
const rooms = {}; 
console.log("🚀 Sunucu Başlatıldı...");
io.on("connection", (socket) => {
  socket.currentRoom = null;
  socket.username = null;
  // --- ODA OLUŞTURMA ---
  socket.on("CREATE_ROOM", ({ roomName, password, username }) => {
    if (rooms[roomName]) {
      // Hata mesajını kısa ve net tuttuk
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
  // --- VİDEO EYLEMLERİ (SADE) ---
  socket.on("ACTION", (data) => {
    if (socket.currentRoom) {
      // Veriyi değiştirmeden olduğu gibi iletiyoruz (İsim ekleme yok)
      socket.to(socket.currentRoom).emit("SYNC_ACTION", data);
    }
  });

  // 🆕🆕🆕 CHAT MESAJLAŞMA 🆕🆕🆕
  socket.on("CHAT_MESSAGE", (data) => {
    if (socket.currentRoom) {
      // Aynı odadaki HERKESE (gönderen dahil) mesajı ilet
      io.to(socket.currentRoom).emit("CHAT_MESSAGE", {
        username: data.username,
        message: data.message,
        timestamp: data.timestamp || Date.now()
      });
      
      console.log(`💬 [${socket.currentRoom}] ${data.username}: ${data.message}`);
    }
  });
  // 🆕🆕🆕 CHAT BİTİŞ 🆕🆕🆕

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

  // 🆕 KEEPALİVE (Bağlantı canlı tutma)
  socket.on("ping_keepalive", () => {
    socket.emit("pong_keepalive");
  });
});
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sunucu ${PORT} portunda başlatıldı.`);
});
