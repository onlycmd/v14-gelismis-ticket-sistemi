const { Events, ActivityType } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        // Config'i client'a ekle
        client.config = require('../config');
        
        console.log(`✅ ${client.user.tag} olarak giriş yapıldı!`);
        console.log(`🎫 Ticket sistemi aktif!`);
        
        // Bot durumunu Twitch.tv yayın yapıyor olarak ayarla
        client.user.setActivity('🎫 Ticket Sistemi | onlycmd', { type: ActivityType.Streaming, url: 'https://twitch.tv/onlycmd' });

        // Slash komutları kaydet
        try {
            console.log('🔄 Slash komutları kaydediliyor...');
            
            const commands = [];
            client.commands.forEach(command => {
                commands.push(command.data.toJSON());
            });

            // Global olarak kaydet (tüm sunucularda görünür)
            await client.application.commands.set(commands);
            console.log(`✅ ${commands.length} slash komutu başarıyla kaydedildi!`);
            
            // Kaydedilen komutları listele
            commands.forEach(cmd => {
                console.log(`  - /${cmd.name}: ${cmd.description}`);
            });
            
        } catch (error) {
            console.error('❌ Slash komutları kaydedilirken hata:', error);
        }
    },
}; 