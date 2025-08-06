const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Botun temel ayarlarını yap (kategori, log kanalı, roller vs)'),

    async execute(interaction) {
        // Sadece adminler kullanabilsin
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Bu komutu sadece sunucu yöneticileri kullanabilir!',
                ephemeral: true
            });
        }

        // Kategorileri, kanalları ve rolleri çek
        const categories = interaction.guild.channels.cache.filter(c => c.type === 4);
        const textChannels = interaction.guild.channels.cache.filter(c => c.type === 0);
        const roles = interaction.guild.roles.cache.filter(r => r.id !== interaction.guild.id);

        // Kategori select menu - en az 1 seçenek olmalı
        const categoryOptions = categories.size > 0 
            ? categories.map(cat => ({
                label: cat.name,
                value: cat.id
            })).slice(0, 25)
            : [{
                label: 'Kategori bulunamadı - Özel ID kullanın',
                value: 'no_category',
                description: 'Kanal Kurulumu butonunu kullanın veya özel ID girin'
            }];

        // Log kanalı select menu - en az 1 seçenek olmalı
        const logChannelOptions = textChannels.size > 0
            ? textChannels.map(ch => ({
                label: ch.name,
                value: ch.id
            })).slice(0, 25)
            : [{
                label: 'Kanal bulunamadı - Özel ID kullanın',
                value: 'no_channel',
                description: 'Kanal Kurulumu butonunu kullanın veya özel ID girin'
            }];

        // Support/Admin rol select menu - en az 1 seçenek olmalı
        const roleOptions = roles.size > 0
            ? roles.map(role => ({
                label: role.name,
                value: role.id
            })).slice(0, 25)
            : [{
                label: 'Rol bulunamadı - Özel ID kullanın',
                value: 'no_role',
                description: 'Kanal Kurulumu butonunu kullanın veya özel ID girin'
            }];

        const embed = new EmbedBuilder()
            .setTitle('🎛️ Bot Kurulum Paneli')
            .setDescription('Aşağıdan botun temel ayarlarını seçin. Her seçimden sonra yeni bir menü açılacaktır.\n\n**Seçenekler:**\n• 📋 Mevcut öğelerden seçim (Select Menu)\n• ✏️ Özel değer girme (Modal)\n• 🏗️ Kanal Kurulumu (Otomatik kanal oluşturma)')
            .setColor(0x36393F)
            .setFooter({ text: 'Kurulum tamamlandığında MongoDB veritabanına kaydedilecek.' });

        const row1 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('setup_category')
                .setPlaceholder('Ticket kategorisini seçin')
                .addOptions(categoryOptions)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('setup_category_modal')
                .setLabel('Özel Kategori ID Gir')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('✏️'),
            new ButtonBuilder()
                .setCustomId('setup_skip_category')
                .setLabel('Varsayılan Kullan')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⚙️'),
            new ButtonBuilder()
                .setCustomId('setup_create_channels')
                .setLabel('Kanal Kurulumu')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🏗️')
        );

        await interaction.reply({
            embeds: [embed],
            components: [row1, row2],
            ephemeral: true
        });
    }
}; 