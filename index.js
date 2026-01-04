const http = require("http");
const { Server } = require("socket.io");
const express = require("express");

const app = express();
const httpServer = http.createServer(app);

// Web Arayüzü
app.get("/", (req, res) => {
  res.send("✅ SyncFhams ODA SİSTEMLİ SUNUCU AKTİF!");
});

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Odaları Hafızada Tutalım
// Örnek yapı: { "sinema1": "1234", "korku_gecesi": "sifre" }
const rooms = {}; 

console.log("🚀 Sunucu Başlatıldı...");

io.on("connection", (socket) => {
  console.log("👤 Bağlantı:", socket.id);
  
  // Kullanıcının hangi odada olduğunu takip etmek için
  socket.currentRoom = null;

  // ODAYA KATILMA İSTEĞİ
  socket.on("JOIN_ROOM", ({ roomName, password }) => {
    // 1. Oda yoksa oluştur
    if (!rooms[roomName]) {
      rooms[roomName] = password;
      socket.join(roomName);
      socket.currentRoom = roomName;
      socket.emit("JOIN_SUCCESS", "Oda oluşturuldu ve girildi!");
      console.log(`[YENİ ODA] ${roomName} (Şifre: ${password})`);
    } 
    // 2. Oda varsa şifreyi kontrol et
    else if (rooms[roomName] === password) {
      socket.join(roomName);
      socket.currentRoom = roomName;
      socket.emit("JOIN_SUCCESS", "Odaya başarıyla katılındı!");
      console.log(`[KATILIM] ${socket.id} -> ${roomName}`);
    } 
    // 3. Şifre yanlışsa
    else {
      socket.emit("JOIN_ERROR", "❌ Hatalı Oda Şifresi!");
    }
  });

  // AKSİYON (Play/Pause)
  socket.on("ACTION", (data) => {
    // Sadece kullanıcının olduğu odaya yayın yap
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit("SYNC_ACTION", data);
      console.log(`⚡ Eylem (${data.type}) -> Oda: ${socket.currentRoom}`);
    }
  });

  socket.on("disconnect", () => {
    // Oda temizliği yapılabilir (Gerekirse)
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Sunucu ${PORT} portunda.`));