const http = require("http");
const { Server } = require("socket.io");
const express = require("express");

const app = express();
const httpServer = http.createServer(app);

app.get("/", (req, res) => res.send("✅ SyncFhams PRO SUNUCU (TEMİZLİK MODU) AKTİF!"));

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Odaları Hafızada Tut
const rooms = {}; 

console.log("🚀 Sunucu Başlatıldı...");

io.on("connection", (socket) => {
  console.log("👤 Bağlantı:", socket.id);
  socket.currentRoom = null;

  // --- 1. ODA OLUŞTURMA İSTEĞİ ---
  socket.on("CREATE_ROOM", ({ roomName, password }) => {
    // Eğer oda zaten varsa ve içi doluysa hata ver
    if (rooms[roomName]) {
      socket.emit("JOIN_ERROR", "⚠️ Bu isimde bir oda zaten var! 'Odaya Katıl' sekmesini kullanın.");
    } else {
      // Yeni oda oluştur
      rooms[roomName] = password;
      socket.join(roomName);
      socket.currentRoom = roomName;
      socket.emit("JOIN_SUCCESS", "Oda oluşturuldu! Arkadaşlarını bekle.");
      console.log(`[OLUŞTURULDU] ${roomName} (Şifre: ${password})`);
    }
  });

  // --- 2. ODAYA KATILMA İSTEĞİ ---
  socket.on("JOIN_ROOM", ({ roomName, password }) => {
    if (!rooms[roomName]) {
      socket.emit("JOIN_ERROR", "❌ Böyle bir oda yok! Önce oluşturmalısın.");
    } else if (rooms[roomName] !== password) {
      socket.emit("JOIN_ERROR", "🔒 Yanlış Şifre!");
    } else {
      socket.join(roomName);
      socket.currentRoom = roomName;
      socket.emit("JOIN_SUCCESS", "Odaya giriş yapıldı!");
      console.log(`[KATILIM] ${socket.id} -> ${roomName}`);
    }
  });

  // --- AKSİYONLAR ---
  socket.on("ACTION", (data) => {
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit("SYNC_ACTION", data);
    }
  });

  // --- 🧹 OTOMATİK TEMİZLİK SİSTEMİ ---
  socket.on("disconnect", () => {
    const roomName = socket.currentRoom;
    
    if (roomName) {
      console.log(`[AYRILDI] ${socket.id} -> ${roomName}`);
      
      // Odada kimse kaldı mı diye kontrol et
      const room = io.sockets.adapter.rooms.get(roomName);
      
      if (!room || room.size === 0) {
        // Kimse kalmadıysa odayı sil
        delete rooms[roomName];
        console.log(`[SİLİNDİ] ${roomName} odası boşaldığı için silindi.`);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Sunucu ${PORT} portunda.`));