const http = require("http");
const { Server } = require("socket.io");
const express = require("express");

const app = express();
const httpServer = http.createServer(app);

app.get("/", (req, res) => res.send("✅ SyncFhams SERVER AKTİF (User System)"));

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ODA HAFIZASI
// Yapı: { "odaAdi": { pass: "123", users: [] } }
const rooms = {}; 

console.log("🚀 Sunucu Başlatıldı...");

io.on("connection", (socket) => {
  socket.currentRoom = null;
  socket.username = null;

  // --- 1. ODA OLUŞTURMA ---
  socket.on("CREATE_ROOM", ({ roomName, password, username }) => {
    // Oda zaten var mı kontrol et
    if (rooms[roomName]) {
      // Eğer oda varsa hata gönder
      socket.emit("JOIN_ERROR", "⚠️ Bu isimde bir oda zaten var! Giriş yapmayı dene.");
    } else {
      // Odayı oluştur
      rooms[roomName] = { pass: password, users: [] };
      console.log(`[YENİ ODA] ${roomName} (Kurucu: ${username})`);
      
      // Kullanıcıyı içeri al
      joinUserToRoom(socket, roomName, username);
      socket.emit("JOIN_SUCCESS", "Oda başarıyla kuruldu.");
    }
  });

  // --- 2. ODAYA GİRİŞ ---
  socket.on("JOIN_ROOM", ({ roomName, password, username }) => {
    // Oda var mı?
    if (!rooms[roomName]) {
      socket.emit("JOIN_ERROR", "❌ Böyle bir oda bulunamadı.");
    } 
    // Şifre doğru mu?
    else if (rooms[roomName].pass !== password) {
      socket.emit("JOIN_ERROR", "🔒 Şifre hatalı!");
    } 
    // Her şey tamamsa içeri al
    else {
      joinUserToRoom(socket, roomName, username);
      socket.emit("JOIN_SUCCESS", "Giriş başarılı.");
    }
  });

  // Ortak Giriş Fonksiyonu
  function joinUserToRoom(socket, room, user) {
    socket.join(room);
    socket.currentRoom = room;
    socket.username = user;

    // Kullanıcı listesine ekle (Aynı isimde varsa ekleme)
    if (!rooms[room].users.includes(user)) {
      rooms[room].users.push(user);
    }

    // Odadaki herkese güncel listeyi gönder
    io.to(room).emit("UPDATE_USER_LIST", rooms[room].users);
  }

  // --- VİDEO EYLEMLERİ ---
  socket.on("ACTION", (data) => {
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit("SYNC_ACTION", data);
    }
  });

  // --- ÇIKIŞ VE TEMİZLİK ---
  socket.on("disconnect", () => {
    const r = socket.currentRoom;
    const u = socket.username;

    if (r && rooms[r]) {
      // Kullanıcıyı listeden sil
      rooms[r].users = rooms[r].users.filter(user => user !== u);
      
      // Kalanlara yeni listeyi yolla
      io.to(r).emit("UPDATE_USER_LIST", rooms[r].users);

      // Oda tamamen boşaldıysa odayı sil
      if (rooms[r].users.length === 0) {
        delete rooms[r];
        console.log(`🗑️ Oda Silindi: ${r}`);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Sunucu ${PORT} portunda.`));