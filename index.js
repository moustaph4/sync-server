const http = require("http");
const { Server } = require("socket.io");
const express = require("express");

const app = express();
const httpServer = http.createServer(app);

app.get("/", (req, res) => res.send("✅ SyncFhams PRO SERVER (V2) AKTİF"));

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000, // Bağlantı koparsa çabuk anla
});

// Odaları Hafızada Tut
const rooms = {}; 

console.log("🚀 Sunucu Başlatıldı...");

io.on("connection", (socket) => {
  console.log(`➕ Yeni Bağlantı: ${socket.id}`);
  socket.currentRoom = null;

  // --- ODA OLUŞTUR ---
  socket.on("CREATE_ROOM", ({ roomName, password }) => {
    // Oda temizlenmemişse ve hala doluysa hata ver
    const roomCheck = io.sockets.adapter.rooms.get(roomName);
    
    if (rooms[roomName] && roomCheck && roomCheck.size > 0) {
      socket.emit("JOIN_ERROR", "⚠️ Bu oda şu an dolu! Katılmayı deneyin.");
    } else {
      // Oda boşsa veya yoksa üzerine yaz (Resetle)
      rooms[roomName] = password;
      socket.join(roomName);
      socket.currentRoom = roomName;
      socket.emit("JOIN_SUCCESS", "Oda kuruldu! Arkadaşlarını bekle.");
      console.log(`[OLUŞTURULDU] ${roomName}`);
    }
  });

  // --- ODAYA KATIL ---
  socket.on("JOIN_ROOM", ({ roomName, password }) => {
    if (!rooms[roomName]) {
      socket.emit("JOIN_ERROR", "❌ Böyle bir oda yok!");
    } else if (rooms[roomName] !== password) {
      socket.emit("JOIN_ERROR", "🔒 Yanlış Şifre!");
    } else {
      socket.join(roomName);
      socket.currentRoom = roomName;
      socket.emit("JOIN_SUCCESS", "Odaya girildi!");
      console.log(`[KATILIM] ${socket.id} -> ${roomName}`);
    }
  });

  // --- PLAY/PAUSE ---
  socket.on("ACTION", (data) => {
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit("SYNC_ACTION", data);
    }
  });

  // --- KOPMA VE TEMİZLİK ---
  socket.on("disconnect", () => {
    const roomName = socket.currentRoom;
    console.log(`➖ Ayrıldı: ${socket.id}`);

    if (roomName) {
      // Socket.IO odadan düşmesi biraz zaman alabilir, manuel kontrol
      setTimeout(() => {
        const room = io.sockets.adapter.rooms.get(roomName);
        if (!room || room.size === 0) {
          delete rooms[roomName];
          console.log(`🗑️ [SİLİNDİ] ${roomName} (Oda boşaldı)`);
        }
      }, 1000);
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Sunucu ${PORT} portunda.`));