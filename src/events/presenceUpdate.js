const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.PresenceUpdate,
    async execute(oldPresence, newPresence) {
        // Herhangi bir offline dışı duruma geçişte otomatik atama
        if (
            oldPresence &&
            newPresence &&
            oldPresence.status !== newPresence.status &&
            newPresence.status !== 'offline'
        ) {
            const guild = newPresence.guild;
            if (!guild) return;

            try {
                const GuildConfig = require('../models/GuildConfig');
                const Ticket = require('../models/Ticket');
                const config = require('../config');

                let guildConfigData = await GuildConfig.getConfig(guild.id);
                let guildConfig = guildConfigData
                    ? {
                        ticketCategoryId: guildConfigData.ticketCategoryId,
                        closedCategoryId: guildConfigData.closedCategoryId,
                        logChannelId: guildConfigData.logChannelId,
                        supportRoleId: guildConfigData.supportRoleId,
                        adminRoleId: guildConfigData.adminRoleId
                    }
                    : {
                        ticketCategoryId: config.ticketCategoryId,
                        closedCategoryId: config.closedTicketCategoryId,
                        logChannelId: config.logChannelId,
                        supportRoleId: config.supportRoleId,
                        adminRoleId: config.adminRoleId
                    };

                const member = newPresence.member;
                const supportRole = guild.roles.cache.get(guildConfig.supportRoleId);
                const adminRole = guild.roles.cache.get(guildConfig.adminRoleId);

                const isSupport = supportRole && member.roles.cache.has(supportRole.id);
                const isAdmin = adminRole && member.roles.cache.has(adminRole.id);

                if (!isSupport && !isAdmin) return;

                const unassignedTickets = await Ticket.find({
                    status: 'açık',
                    assignedTo: null
                });

                if (unassignedTickets.length === 0) return;

                const oldestTicket = unassignedTickets.sort((a, b) => a.createdAt - b.createdAt)[0];
                const ticketChannel = guild.channels.cache.get(oldestTicket.channelId);
                if (!ticketChannel) return;

                oldestTicket.assignedTo = member.id;
                await oldestTicket.save();

                await ticketChannel.permissionOverwrites.edit(oldestTicket.userId, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });

                // Kanalda son 10 mesajı kontrol et, ilk bulduğu '🎫 Ticket #' başlıklı embed'i güncellesin
                const messages = await ticketChannel.messages.fetch({ limit: 10 });
                const ticketMsg = messages.find(msg =>
                    msg.embeds.length > 0 &&
                    msg.embeds[0].title &&
                    msg.embeds[0].title.startsWith('🎫 Ticket #')
                );
                if (ticketMsg) {
                    const oldEmbed = ticketMsg.embeds[0];
                    // Fields'ı güncelle
                    const newFields = oldEmbed.fields.map(f =>
                        f.name === '👨‍💼 Atanan Yetkili'
                            ? { name: f.name, value: `<@${member.id}>`, inline: true }
                            : f
                    );
                    const newEmbed = EmbedBuilder.from(oldEmbed).setFields(newFields);
                    await ticketMsg.edit({ embeds: [newEmbed] });
                }

                const assignmentEmbed = new EmbedBuilder()
                    .setTitle('👨‍💼 Yetkili Atandı')
                    .setDescription(`Tarafımızca **${member.user.username}** yetkilisi atandı. Artık mesaj gönderebilirsiniz.`)
                    .setColor(0x36393F)
                    .setTimestamp();

                await ticketChannel.send({ embeds: [assignmentEmbed] });

                console.log(`🤖 Otomatik atama (presence update): ${member.user.tag} -> Ticket #${oldestTicket.ticketId}`);
            } catch (error) {
                console.error('Presence update atama hatası:', error);
            }
        }
    }
};
