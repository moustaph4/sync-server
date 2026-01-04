const http = require("http");
const { Server } = require("socket.io");
const express = require("express");

const app = express();
const httpServer = http.createServer(app);

app.get("/", (req, res) => res.send("✅ SyncFhams PRO SUNUCU AKTİF!"));

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
    if (rooms[roomName]) {
      // Oda zaten varsa hata ver
      socket.emit("JOIN_ERROR", "⚠️ Bu isimde bir oda zaten var! Katılmayı deneyin.");
    } else {
      // Yeni oda oluştur
      rooms[roomName] = password;
      socket.join(roomName);
      socket.currentRoom = roomName;
      socket.emit("JOIN_SUCCESS", "Oda başarıyla oluşturuldu! Arkadaşlarını davet et.");
      console.log(`[OLUŞTURULDU] ${roomName}`);
    }
  });

  // --- 2. ODAYA KATILMA İSTEĞİ ---
  socket.on("JOIN_ROOM", ({ roomName, password }) => {
    if (!rooms[roomName]) {
      // Oda yoksa hata ver
      socket.emit("JOIN_ERROR", "❌ Böyle bir oda bulunamadı!");
    } else if (rooms[roomName] !== password) {
      // Şifre yanlışsa hata ver
      socket.emit("JOIN_ERROR", "🔒 Yanlış Şifre!");
    } else {
      // Başarılı giriş
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

  socket.on("disconnect", () => {
    // İsteğe bağlı: Oda boşalınca silinebilir ama şimdilik kalsın.
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Sunucu ${PORT} portunda.`));