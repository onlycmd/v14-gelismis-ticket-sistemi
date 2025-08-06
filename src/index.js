const { Client, GatewayIntentBits, Collection } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Client oluştur
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences // <-- Presence intenti eklendi
    ]
});

// Komutlar koleksiyonu
client.commands = new Collection();

// MongoDB bağlantısı
async function connectDatabase() {
    try {
        await mongoose.connect(config.mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ MongoDB bağlantısı başarılı!');
    } catch (error) {
        console.error('❌ MongoDB bağlantı hatası:', error);
        process.exit(1);
    }
}

// Komutları yükle
async function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        
        // Klasör mü dosya mı kontrol et
        const stats = fs.statSync(folderPath);
        
        if (stats.isDirectory()) {
            // Klasör ise içindeki .js dosyalarını yükle
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
            
            for (const file of commandFiles) {
                const filePath = path.join(folderPath, file);
                const command = require(filePath);
                
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    console.log(`📝 Komut yüklendi: ${command.data.name}`);
                } else {
                    console.log(`⚠️ ${filePath} komut dosyasında gerekli özellikler eksik.`);
                }
            }
        } else if (stats.isFile() && folder.endsWith('.js')) {
            // Dosya ise ve .js uzantılı ise yükle
            const command = require(folderPath);
            
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`📝 Komut yüklendi: ${command.data.name}`);
            } else {
                console.log(`⚠️ ${folderPath} komut dosyasında gerekli özellikler eksik.`);
            }
        }
    }
}

// Event'leri yükle
async function loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
        console.log(`🎯 Event yüklendi: ${event.name}`);
    }
}

// Slash komutları kaydet
async function deployCommands() {
    try {
        console.log('🔄 Slash komutları kaydediliyor...');
        
        const commands = [];
        client.commands.forEach(command => {
            commands.push(command.data.toJSON());
        });

        // Global olarak kaydet (tüm sunucularda görünür)
        await client.application.commands.set(commands);
        console.log(`✅ ${commands.length} slash komutu başarıyla kaydedildi!`);
        
    } catch (error) {
        console.error('❌ Slash komutları kaydedilirken hata:', error);
    }
}

// Bot başlatma
async function startBot() {
    try {
        // Veritabanı bağlantısı
        await connectDatabase();
        
        // Komutları ve event'leri yükle
        await loadCommands();
        await loadEvents();
        
        // Bot'a giriş yap
        await client.login(config.token);
        
    } catch (error) {
        console.error('❌ Bot başlatılırken hata:', error);
        process.exit(1);
    }
}

client.on('ready', async () => {
    for (const [guildId, guild] of client.guilds.cache) {
        await guild.members.fetch();
    }
    console.log('Tüm üyeler fetch edildi!');
});

// Hata yakalama
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

// Bot'u başlat
startBot(); 