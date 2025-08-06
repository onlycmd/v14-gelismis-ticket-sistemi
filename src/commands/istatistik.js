const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const TicketManager = require('../utils/ticketManager');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('istatistik')
        .setDescription('Detaylı ticket istatistiklerini göster'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            
        const ticketManager = new TicketManager(interaction.client);
            const stats = await ticketManager.getDetailedStats();

            // Çözülme oranını hesapla
            const resolutionRate = stats.basic.totalTickets > 0 
                ? ((stats.basic.resolvedTickets / stats.basic.totalTickets) * 100).toFixed(1)
                : '0.0';

            // Ana istatistikler
            let mainStatsText = `📊 **GENEL İSTATİSTİKLER**\n`;
            mainStatsText += `\`\`\`\n`;
            mainStatsText += `📈 Toplam Ticket: ${stats.basic.totalTickets}\n`;
            mainStatsText += `🟢 Açık Ticket: ${stats.basic.openTickets}\n`;
            mainStatsText += `🔴 Kapalı Ticket: ${stats.basic.closedTickets}\n`;
            mainStatsText += `✅ Çözülen Ticket: ${stats.basic.resolvedTickets}\n`;
            mainStatsText += `📊 Çözülme Oranı: %${resolutionRate}\n`;
            mainStatsText += `⏱️ Ortalama Kapatma Süresi: ${stats.avgCloseTime.toFixed(1)} saat\n`;
            mainStatsText += `\`\`\``;

            // En çok ticket açan kullanıcılar
            let topOpenersText = `🏆 **EN ÇOK TICKET AÇAN KULLANICILAR**\n`;
            topOpenersText += `\`\`\`\n`;
            if (stats.topOpeners.length > 0) {
                stats.topOpeners.forEach((opener, index) => {
                    const user = interaction.client.users.cache.get(opener._id);
                    const username = user ? user.username : `Kullanıcı ${opener._id}`;
                    topOpenersText += `${index + 1}. ${username} - ${opener.count} ticket\n`;
                });
            } else {
                topOpenersText += `Veri yok\n`;
            }
            topOpenersText += `\`\`\``;

            // En çok ticket çözen yetkililer
            let topResolversText = `👨‍💼 **EN ÇOK TICKET ÇÖZEN YETKİLİLER**\n`;
            topResolversText += `\`\`\`\n`;
            if (stats.topResolvers.length > 0) {
                stats.topResolvers.forEach((resolver, index) => {
                    const user = interaction.client.users.cache.get(resolver._id);
                    const username = user ? user.username : `Yetkili ${resolver._id}`;
                    topResolversText += `${index + 1}. ${username} - ${resolver.count} ticket\n`;
                });
            } else {
                topResolversText += `Veri yok\n`;
            }
            topResolversText += `\`\`\``;

            // Son çözülen ticket'lar
            let resolvedTicketsText = `✅ **SON ÇÖZÜLEN TICKETLAR**\n`;
            resolvedTicketsText += `\`\`\`\n`;
            if (stats.resolvedTickets && stats.resolvedTickets.length > 0) {
                stats.resolvedTickets.forEach((ticket, index) => {
                    const user = interaction.client.users.cache.get(ticket.userId);
                    const resolver = interaction.client.users.cache.get(ticket.resolvedBy);
                    const username = user ? user.username : `Kullanıcı ${ticket.userId}`;
                    const resolverName = resolver ? resolver.username : `Yetkili ${ticket.resolvedBy}`;
                    const typeName = config.ticketTypes[ticket.type]?.name || ticket.type;
                    const date = new Date(ticket.resolvedAt).toLocaleDateString('tr-TR');
                    resolvedTicketsText += `${index + 1}. ${username} - ${typeName}\n   Çözen: ${resolverName} (${date})\n\n`;
                });
            } else {
                resolvedTicketsText += `Veri yok\n`;
            }
            resolvedTicketsText += `\`\`\``;

            // Ticket türlerine göre dağılım
            let ticketsByTypeText = `📋 **TICKET TÜRLERİNE GÖRE DAĞILIM**\n`;
            ticketsByTypeText += `\`\`\`\n`;
            if (stats.ticketsByType.length > 0) {
                stats.ticketsByType.forEach((type, index) => {
                    const typeName = config.ticketTypes[type._id]?.name || type._id;
                    const percentage = ((type.count / stats.basic.totalTickets) * 100).toFixed(1);
                    ticketsByTypeText += `${index + 1}. ${typeName} - ${type.count} ticket (%${percentage})\n`;
                });
            } else {
                ticketsByTypeText += `Veri yok\n`;
            }
            ticketsByTypeText += `\`\`\``;

            // Son açılan ticket'lar
            let recentTicketsText = `🕒 **SON AÇILAN TICKETLAR**\n`;
            recentTicketsText += `\`\`\`\n`;
            if (stats.recentTickets.length > 0) {
                stats.recentTickets.forEach((ticket, index) => {
                    const user = interaction.client.users.cache.get(ticket.userId);
                    const username = user ? user.username : `Kullanıcı ${ticket.userId}`;
                    const typeName = config.ticketTypes[ticket.type]?.name || ticket.type;
                    const date = new Date(ticket.createdAt).toLocaleDateString('tr-TR');
                    const statusEmoji = ticket.status === 'açık' ? '🟢' : ticket.status === 'kapalı' ? '🔴' : '✅';
                    recentTicketsText += `${index + 1}. ${username} - ${typeName} (${date}) ${statusEmoji}\n`;
                });
            } else {
                recentTicketsText += `Veri yok\n`;
            }
            recentTicketsText += `\`\`\``;

            // Günlük istatistikler
            let dailyStatsText = `📅 **SON 7 GÜNLÜK İSTATİSTİKLER**\n`;
            dailyStatsText += `\`\`\`\n`;
            if (stats.dailyStats.length > 0) {
                stats.dailyStats.forEach((day, index) => {
                    const date = new Date(day._id).toLocaleDateString('tr-TR');
                    dailyStatsText += `${index + 1}. ${date} - ${day.count} ticket\n`;
                });
            } else {
                dailyStatsText += `Veri yok\n`;
            }
            dailyStatsText += `\`\`\``;

            // Tüm bilgileri birleştir
            const fullDescription = [
                mainStatsText,
                topOpenersText,
                topResolversText,
                resolvedTicketsText,
                ticketsByTypeText,
                recentTicketsText,
                dailyStatsText
            ].join('\n');

            // Tek embed oluştur
            const statsEmbed = new EmbedBuilder()
                .setTitle('📊 Ticket Sistemi İstatistikleri')
                .setDescription(fullDescription)
            .setColor(0x36393F)
            .setTimestamp()
            .setFooter({ text: 'Ticket Sistemi İstatistikleri' });

            await interaction.editReply({ embeds: [statsEmbed] });

        } catch (error) {
            console.error('İstatistik komutu hatası:', error);
            await interaction.editReply({
                content: '❌ İstatistikler alınırken bir hata oluştu!'
            });
        }
    }
}; 