const http = require("http");
const { Server } = require("socket.io");
const express = require("express");

const app = express();
const httpServer = http.createServer(app);

app.get("/", (req, res) => res.send("✅ SYNC FHAMS SUNUCU AKTİF!"));

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  // 👇 Bağlantıyı canlı tutan ayarların (Aynen korundu)
  pingTimeout: 60000, 
  pingInterval: 10000 
});

// Odaları Tutan Hafıza
const rooms = {}; 

console.log("🚀 Sunucu Başlatıldı...");

io.on("connection", (socket) => {
  socket.currentRoom = null;
  socket.username = null;

  // --- ODA OLUŞTURMA ---
  socket.on("CREATE_ROOM", ({ roomName, password, username }) => {
    if (rooms[roomName]) {
      // 👇 İSTEDİĞİN KISA MESAJ BURAYA EKLENDİ
      socket.emit("JOIN_ERROR", "⚠️ BU ODA İSMİ KULLANILIYOR");
    } else {
      rooms[roomName] = { pass: password, users: [] };
      joinLogic(socket, roomName, username);
      socket.emit("JOIN_SUCCESS", "Oda Başarıyla Oluşturuldu!");
    }
  });

  // --- ODAYA KATILMA ---
  socket.on("JOIN_ROOM", ({ roomName, password, username }) => {
    if (!rooms[roomName]) {
      socket.emit("JOIN_ERROR", "❌ Böyle bir oda bulunamadı.");
    } else if (rooms[roomName].pass !== password) {
      socket.emit("JOIN_ERROR", "🔒 Şifre Hatalı!");
    } else {
      joinLogic(socket, roomName, username);
      socket.emit("JOIN_SUCCESS", "Odaya Giriş Yapıldı!");
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
    // Herkese güncel listeyi at
    io.to(room).emit("UPDATE_USER_LIST", rooms[room].users);
  }

  // --- VİDEO EYLEMLERİ (ÖNEMLİ GÜNCELLEME) ---
  socket.on("ACTION", (data) => {
    if (socket.currentRoom) {
      // 👇 BURASI DEĞİŞTİ: Veriye 'username' ekliyoruz ki kimin bastığı görünsün
      const payload = { 
        ...data, 
        username: socket.username 
      };
      
      socket.to(socket.currentRoom).emit("SYNC_ACTION", payload);
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

// '0.0.0.0' ayarın aynen korundu
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sunucu ${PORT} portunda başlatıldı.`);
});