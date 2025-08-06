# 🎫 Discord Ticket Bot

Modern Discord.js (v14+) ile geliştirilmiş, MongoDB destekli gelişmiş ticket (destek talebi) yönetim sistemi. Otomatik yetkili atama, akıllı yönetim ve kapsamlı istatistikler ile profesyonel destek deneyimi sunar.

## ✨ Özellikler

### 🚀 **Temel Özellikler**
- **Slash Komutları**: Modern Discord.js v14 slash komut sistemi
- **MongoDB Entegrasyonu**: Kalıcı veri saklama ve istatistikler
- **Otomatik Kurulum**: `/setup` komutu ile tek tıkta kanal ve rol kurulumu
- **Panel Sistemi**: Kullanıcı dostu ticket açma paneli

### 🤖 **Akıllı Atama Sistemi**
- **Online Durum Takibi**: Sadece online/idle/dnd durumundaki yetkililer atanır
- **Öncelik Sistemi**: Admin > Support > Normal yetkili sıralaması
- **İş Yükü Dengeleme**: En az açık ticket'ı olan yetkiliye öncelik
- **Otomatik Atama**: Online yetkili yoksa bekler, biri online olunca otomatik atanır
- **Dinamik Güncelleme**: Embed'da atanan yetkili bilgisi otomatik güncellenir

### 🎯 **Ticket Yönetimi**
- **Çoklu Ticket Türü**: Satın alma, şikayet, teknik destek, genel soru
- **Güvenli Yazma**: Kullanıcı sadece yetkili atandıktan sonra yazabilir
- **Yetki Kontrolü**: Sadece atanan yetkili veya admin yönetebilir
- **Transfer Sistemi**: Ticket'ı başka yetkiliye aktarma
- **Çözüldü İşaretleme**: Sadece ticket'ı kapatan kişi çözüldü işaretleyebilir

### 📁 **Arşiv ve Transkript**
- **Otomatik Arşivleme**: Kapatılan ticket'lar "📁 Kapalı Ticketlar" kategorisine taşınır
- **Transkript Sistemi**: Tüm konuşma geçmişi dosya olarak kaydedilir
- **Yeniden Açma**: Kapalı ticket'ları yeniden açabilme
- **Çözüldü Takibi**: Çözülen ticket'lar için özel durum ve istatistikler

### 📊 **İstatistik ve Analiz**
- **Detaylı İstatistikler**: Toplam, açık, kapalı, çözülen ticket sayıları
- **Çözülme Oranı**: Yüzdelik başarı oranı
- **En Aktif Kullanıcılar**: En çok ticket açan kullanıcılar
- **En İyi Yetkililer**: En çok ticket çözen yetkililer
- **Tür Dağılımı**: Ticket türlerine göre analiz
- **Günlük İstatistikler**: Son 7 günlük aktivite

### 🔧 **Gelişmiş Özellikler**
- **Kanal Kurulumu**: Otomatik kategori ve kanal oluşturma
- **Rol Yönetimi**: Support ve Admin rolleri otomatik kurulum
- **Cooldown Sistemi**: Spam koruması
- **Log Sistemi**: Tüm işlemler log kanalında kaydedilir
- **Hata Yönetimi**: Kapsamlı hata yakalama ve kullanıcı bildirimleri

## 🛠️ Kurulum

### 1. **Gereksinimler**
- Node.js 16.9.0 veya üzeri
- MongoDB veritabanı
- Discord Bot Token

### 2. **Projeyi İndir**
   ```bash
git clone https://github.com/onlycmd/v14-gelismis-ticket-sistemi.git
   cd ticket-bot
   npm install
   ```

### 3. **Yapılandırma**
```bash
# config.env dosyasını oluştur
cp config.example.env config.env

# Gerekli bilgileri doldur
DISCORD_TOKEN=your_bot_token_here
MONGODB_URI=your_mongodb_connection_string
```

### 4. **Discord Developer Portal Ayarları**
- **Privileged Gateway Intents** > **Presence Intent** aktif olmalı
- **Bot Permissions**:
  - Manage Channels
  - Manage Roles
  - Send Messages
  - Embed Links
  - Attach Files
  - Read Message History

### 5. **Botu Başlat**
   ```bash
   npm start
   ```

## 📋 Komutlar

### 🔧 **Yönetim Komutları**
- `/setup` - Bot kurulumu (sadece admin)
- `/panel` - Ticket açma paneli oluştur (sadece admin)
- `/istatistik` - Detaylı ticket istatistikleri

### 🎫 **Ticket İşlemleri**
- **Panelden Ticket Açma**: Kullanıcılar panelden ticket türü seçerek açar
- **Otomatik Atama**: Online yetkili otomatik atanır
- **Yönetim Butonları**:
  - 🔒 **Kapat**: Ticket'ı kapat ve arşivle
  - 🔄 **Başka Birine Aktar**: Ticket'ı transfer et
  - ✅ **Çözüldü**: Ticket'ı çözüldü olarak işaretle (sadece kapatan kişi)
  - 🔄 **Yeniden Aç**: Kapalı ticket'ı yeniden aç

## 🏗️ Sistem Mimarisi

### **Veritabanı Yapısı**
```javascript
// Ticket Modeli
{
  ticketId: String,        // Benzersiz ticket ID
  channelId: String,       // Discord kanal ID
  userId: String,          // Ticket açan kullanıcı
  assignedTo: String,      // Atanan yetkili
  type: String,            // Ticket türü
  status: String,          // açık/kapalı/çözüldü
  createdAt: Date,         // Oluşturulma tarihi
  closedAt: Date,          // Kapatılma tarihi
  closedBy: String,        // Kapatan kişi
  resolvedAt: Date,        // Çözülme tarihi
  resolvedBy: String       // Çözen kişi
}
```

### **Kanal Yapısı**
- **🎫 Ticket Sistemi**: Ana ticket kategorisi
- **📨 Gelen Ticketlar**: Yeni açılan ticket'lar
- **📁 Kapalı Ticketlar**: Kapatılan ticket'lar
- **📋 ticket-log**: Log mesajları
- **🎫 ticket-panel**: Ticket açma paneli

### **Rol Yapısı**
- **🎫 Support**: Destek yetkilisi
- **🔧 Ticket Admin**: Yönetici yetkilisi

## 🔄 İş Akışı

### **1. Ticket Açma**
```
Kullanıcı Panel → Ticket Türü Seç → Otomatik Atama → Yetkili Bildirimi
```

### **2. Ticket Yönetimi**
```
Yetkili Atama → Kullanıcı Yazma Yetkisi → Yönetim Butonları → Çözüm
```

### **3. Ticket Kapatma**
```
Kapat Butonu → Transkript Oluştur → Arşiv Kanalına Taşı → Çözüldü İşaretleme
```

### **4. Yeniden Açma**
```
Yeniden Aç Butonu → Yeni Kanal Oluştur → Orijinal Embed → Kullanıcı Bildirimi
```

## 📊 İstatistik Sistemi

### **Temel Metrikler**
- Toplam ticket sayısı
- Açık/kapalı/çözülen oranları
- Çözülme yüzdesi
- Ortalama kapatma süresi

### **Detaylı Analiz**
- En çok ticket açan kullanıcılar (Top 3)
- En çok ticket çözen yetkililer (Top 3)
- Ticket türlerine göre dağılım
- Son çözülen ticket'lar
- Günlük aktivite grafiği

## 🔒 Güvenlik Özellikleri

- **Yetki Kontrolü**: Sadece yetkili kişiler işlem yapabilir
- **Tek Seferlik Çözme**: Her ticket sadece bir kez çözülebilir
- **Sahip Kontrolü**: Çözüldü butonu sadece kapatan kişi tarafından kullanılabilir
- **Cooldown**: Spam koruması
- **Hata Yönetimi**: Güvenli hata yakalama

## 🚀 Performans

- **Hızlı Yanıt**: Optimize edilmiş MongoDB sorguları
- **Düşük Kaynak Kullanımı**: Verimli kod yapısı
- **Ölçeklenebilir**: Büyük sunucular için uygun
- **Güvenilir**: Kapsamlı hata yönetimi

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Harika'`)
4. Branch'inizi push edin (`git push origin feature/AmazingFeature`)
5. Pull Request oluşturun

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için `LICENSE` dosyasına bakın.

## 📞 İletişim

- **Geliştirici**: [Nazmi](https://github.com/onlycmd)
- **Discord**: [Sunucu Daveti](https://discord.gg/devcode)

---

⭐ **Bu projeyi beğendiyseniz yıldız vermeyi ve forklamayı unutmayın!**

> Bu bot, Discord toplulukları için profesyonel ve güvenli bir ticket yönetimi sunar. Her türlü öneri ve katkı için iletişime geçebilirsiniz!

