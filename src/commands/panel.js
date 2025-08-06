const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Ticket açma panelini oluştur (herkes ticket açabilir)'),

    async execute(interaction) {
        // MongoDB'den config verilerini al
        let guildConfig;
        try {
            const guildConfigData = await GuildConfig.getConfig(interaction.guild.id);
            if (guildConfigData) {
                guildConfig = {
                    ticketCategoryId: guildConfigData.ticketCategoryId,
                    closedCategoryId: guildConfigData.closedCategoryId,
                    logChannelId: guildConfigData.logChannelId,
                    supportRoleId: guildConfigData.supportRoleId,
                    adminRoleId: guildConfigData.adminRoleId
                };
            } else {
                guildConfig = {
                    ticketCategoryId: config.ticketCategoryId,
                    closedCategoryId: config.closedTicketCategoryId,
                    logChannelId: config.logChannelId,
                    supportRoleId: config.supportRoleId,
                    adminRoleId: config.adminRoleId
                };
            }
        } catch (error) {
            console.error('Config alma hatası:', error);
            guildConfig = {
                ticketCategoryId: config.ticketCategoryId,
                closedCategoryId: config.closedTicketCategoryId,
                logChannelId: config.logChannelId,
                supportRoleId: config.supportRoleId,
                adminRoleId: config.adminRoleId
            };
        }

        // Ticket türleri select menu
        const ticketTypes = config.ticketTypes;
        const options = Object.keys(ticketTypes).map(key => ({
            label: ticketTypes[key].name,
            value: key,
            description: ticketTypes[key].description,
            emoji: ticketTypes[key].emoji
        }));

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('create_ticket_select')
                .setPlaceholder('Bir ticket türü seçin...')
                .addOptions(options)
        );

        await interaction.reply({
            content: 'Aşağıdan bir ticket türü seçin:',
            components: [row],
            ephemeral: false
        });
    }
}; 