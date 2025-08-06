const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const Ticket = require('../models/Ticket');
const GuildConfig = require('../models/GuildConfig');
const config = require('../config');

class TicketManager {
    constructor(client) {
        this.client = client;
        this.cooldowns = new Map();
    }

    // MongoDB'den config verilerini al
    async getGuildConfig(guildId) {
        try {
            const guildConfig = await GuildConfig.getConfig(guildId);
            if (guildConfig) {
                return {
                    ticketCategoryId: guildConfig.ticketCategoryId,
                    closedCategoryId: guildConfig.closedCategoryId,
                    logChannelId: guildConfig.logChannelId,
                    supportRoleId: guildConfig.supportRoleId,
                    adminRoleId: guildConfig.adminRoleId,
                    incomingCategoryId: guildConfig.incomingCategoryId
                };
            }
            // Eğer MongoDB'de config yoksa, varsayılan config'i kullan
            return {
                ticketCategoryId: config.ticketCategoryId,
                closedCategoryId: config.closedTicketCategoryId,
                logChannelId: config.logChannelId,
                supportRoleId: config.supportRoleId,
                adminRoleId: config.adminRoleId,
                incomingCategoryId: config.incomingCategoryId
            };
        } catch (error) {
            console.error('Config alma hatası:', error);
            // Hata durumunda varsayılan config'i kullan
            return {
                ticketCategoryId: config.ticketCategoryId,
                closedCategoryId: config.closedTicketCategoryId,
                logChannelId: config.logChannelId,
                supportRoleId: config.supportRoleId,
                adminRoleId: config.adminRoleId,
                incomingCategoryId: config.incomingCategoryId
            };
        }
    }

    // Ticket ID oluşturma
    generateTicketId() {
        return `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    }

    // Cooldown kontrolü
    isOnCooldown(userId) {
        const cooldown = this.cooldowns.get(userId);
        if (!cooldown) return false;
        
        if (Date.now() - cooldown < config.ticketCooldown) {
            return true;
        }
        
        this.cooldowns.delete(userId);
        return false;
    }

    // Cooldown ekleme
    addCooldown(userId) {
        this.cooldowns.set(userId, Date.now());
    }

    // Otomatik atama - önce support ve admin, sonra aktif olanları bul
    async findAvailableSupport(guild, guildConfig) {
        try {
            const supportRole = guild.roles.cache.get(guildConfig.supportRoleId);
            const adminRole = guild.roles.cache.get(guildConfig.adminRoleId);
            
            if (!supportRole && !adminRole) return null;

            // Önce support ve admin rollerini kontrol et
            const supportMembers = supportRole ? supportRole.members : new Map();
            const adminMembers = adminRole ? adminRole.members : new Map();
            
            // Hem support hem admin rolüne sahip olanları bul
            const availableMembers = [];
            
            // Support üyelerini ekle (sadece online olanlar)
            for (const [memberId, member] of supportMembers) {
                // Online durumunu kontrol et
                const presence = guild.presences.cache.get(memberId);
                const isOnline = presence && (presence.status === 'online' || presence.status === 'idle' || presence.status === 'dnd');
                
                if (!isOnline) continue; // Offline olanları atla
                
                const isAdmin = adminMembers.has(memberId);
                const openTickets = await Ticket.countDocuments({ 
                    assignedTo: memberId, 
                    status: 'açık' 
                });
                
                availableMembers.push({
                    member,
                    workload: openTickets,
                    isAdmin: isAdmin,
                    priority: isAdmin ? 1 : 2 // Admin'ler öncelikli
                });
            }
            
            // Sadece admin rolüne sahip olanları ekle (support yoksa, sadece online olanlar)
            for (const [memberId, member] of adminMembers) {
                if (!supportMembers.has(memberId)) {
                    // Online durumunu kontrol et
                    const presence = guild.presences.cache.get(memberId);
                    const isOnline = presence && (presence.status === 'online' || presence.status === 'idle' || presence.status === 'dnd');
                    
                    if (!isOnline) continue; // Offline olanları atla
                    
                    const openTickets = await Ticket.countDocuments({ 
                        assignedTo: memberId, 
                        status: 'açık' 
                    });
                    
                    availableMembers.push({
                        member,
                        workload: openTickets,
                        isAdmin: true,
                        priority: 1
                    });
                }
            }

            if (availableMembers.length === 0) return null;

            // Önce önceliğe göre, sonra iş yüküne göre sırala
            availableMembers.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority; // Admin'ler önce
                }
                return a.workload - b.workload; // Sonra iş yükü
            });

            return availableMembers[0].member;

        } catch (error) {
            console.error('Otomatik atama hatası:', error);
            return null;
        }
    }

    // Ticket açma
    async createTicket(interaction, type) {
        const userId = interaction.user.id;
        const guild = interaction.guild;

        // MongoDB'den config verilerini al
        const guildConfig = await this.getGuildConfig(guild.id);

        // Cooldown kontrolü
        if (this.isOnCooldown(userId)) {
            const remaining = Math.ceil((config.ticketCooldown - (Date.now() - this.cooldowns.get(userId))) / 1000);
            return {
                success: false,
                message: `⏰ Lütfen ${remaining} saniye bekleyin!`
            };
        }

        // Açık ticket kontrolü
        const openTickets = await Ticket.getOpenTicketsByUser(userId);
        if (openTickets.length >= config.maxTicketsPerUser) {
            return {
                success: false,
                message: `❌ Zaten ${config.maxTicketsPerUser} açık ticket'ınız var!`
            };
        }

        try {
            const ticketId = this.generateTicketId();
            const channelName = `ticket-${interaction.user.username}`;
            
            // Kategori kontrolü - önce incomingCategoryId'yi dene, yoksa ticketCategoryId'yi kullan
            let category = null;
            if (guildConfig.incomingCategoryId) {
                category = guild.channels.cache.get(guildConfig.incomingCategoryId);
            }
            if (!category && guildConfig.ticketCategoryId) {
                category = guild.channels.cache.get(guildConfig.ticketCategoryId);
            }
            if (!category) {
                return {
                    success: false,
                    message: '❌ Ticket kategorisi bulunamadı! Lütfen önce `/setup` komutunu kullanın.'
                };
            }

            // Otomatik atama yap
            const assignedSupport = await this.findAvailableSupport(guild, guildConfig);
            let assignedUserId = null;
            let assignedUser = null;
            
            if (assignedSupport) {
                assignedUserId = assignedSupport.id;
                assignedUser = assignedSupport;
            }

            // Kanal oluşturma
            const channel = await guild.channels.create({
                name: channelName,
                type: 0, // Text channel
                parent: category,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: userId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                        deny: [PermissionFlagsBits.SendMessages] // Ticket açan kullanıcı yazamaz
                    },
                    {
                        id: guildConfig.supportRoleId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: guildConfig.adminRoleId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels]
                    }
                ]
            });

            // Ticket veritabanına kaydetme
            const ticket = new Ticket({
                ticketId,
                channelId: channel.id,
                userId,
                type,
                assignedTo: assignedUserId
            });
            await ticket.save();

            // Hoş geldin embed'ı
            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`🎫 Ticket #${ticketId}`)
                .setDescription(`${config.welcomeMessages[type]}

**Ticket Detayları:**
• **Kullanıcı:** <@${userId}>
• **Tip:** ${config.ticketTypes[type].name}
• **Oluşturulma:** <t:${Math.floor(Date.now() / 1000)}:F>
${assignedUser ? `• **Atanan Yetkili:** <@${assignedUser.id}>` : '• **Atanan Yetkili:** Şu anda atama bekleniyor.'}

Ticket'ınız başarıyla oluşturuldu! Support ekibimiz en kısa sürede size yardımcı olacaktır.`)
                .setColor(0x36393F)
                .setFooter({ text: 'Ticket Sistemi' });

            welcomeEmbed.setFooter({ text: 'Ticket yönetimi için aşağıdaki butonları kullanın' });

            // Tüm yönetim butonları
            const managementButtons1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Kapat')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒'),
                    new ButtonBuilder()
                        .setCustomId('transfer_ticket')
                        .setLabel('Başka Birine Aktar')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄')
                );

            const managementButtons2 = new ActionRowBuilder()
                .addComponents(); // Artık ikinci satırda buton yok

            await channel.send({ 
                embeds: [welcomeEmbed], 
                components: [managementButtons1, managementButtons2] 
            });

            // Eğer otomatik atama yapıldıysa bildirim gönder ve yazma yetkisi aç
            if (assignedUser) {
                // Atama bildirimi
                const assignmentEmbed = new EmbedBuilder()
                    .setTitle('👨‍💼 Yetkili Atandı')
                    .setDescription(`Tarafımızca **${assignedUser.user.username}** yetkilisi atandı. Artık mesaj gönderebilirsiniz.`)
                    .setColor(0x36393F)
                    .setTimestamp();

                await channel.send({ embeds: [assignmentEmbed] });

                // Kullanıcıya yazma yetkisi aç
                await channel.permissionOverwrites.edit(userId, { 
                    ViewChannel: true, 
                    SendMessages: true, 
                    ReadMessageHistory: true 
                });

                console.log(`✅ Yazma yetkisi açıldı: ${interaction.user.tag}`);
            } else {
                // Atanmamış ticket bildirimi
                const waitingEmbed = new EmbedBuilder()
                    .setTitle('⏳ Yetkili Bekleniyor')
                    .setDescription('Şu anda online olan yetkili bulunamadı. En kısa sürede size yardımcı olacağız.')
                    .setColor(0x36393F)
                    .setTimestamp();

                await channel.send({ embeds: [waitingEmbed] });

                console.log(`⏳ Atanmamış ticket oluşturuldu: ${interaction.user.tag}`);
            }

            // Log mesajı
            await this.sendLogMessage(guild, {
                action: 'TICKET_OPENED',
                ticketId,
                userId,
                type,
                channelId: channel.id,
                assignedTo: assignedUserId
            }, guildConfig);

            this.addCooldown(userId);

            return {
                success: true,
                message: `✅ Ticket başarıyla oluşturuldu! <#${channel.id}>${assignedUserId ? `\n👨‍💼 Otomatik olarak <@${assignedUserId}> atandı.` : ''}`,
                channelId: channel.id
            };

        } catch (error) {
            console.error('Ticket oluşturma hatası:', error);
            return {
                success: false,
                message: '❌ Ticket oluşturulurken bir hata oluştu!'
            };
        }
    }

    // Select menu ile ticket açarken: ilk başta yazma kapalı ticket aç
    static async createTicketWithLockedChannel(interaction, type) {
        const userId = interaction.user.id;
        const guild = interaction.guild;
        const config = require('../config');
        const Ticket = require('../models/Ticket');
        const GuildConfig = require('../models/GuildConfig');
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

        // MongoDB'den config verilerini al
        let guildConfig;
        try {
            const guildConfigData = await GuildConfig.getConfig(guild.id);
            if (guildConfigData) {
                guildConfig = {
                    ticketCategoryId: guildConfigData.ticketCategoryId,
                    closedCategoryId: guildConfigData.closedCategoryId,
                    logChannelId: guildConfigData.logChannelId,
                    supportRoleId: guildConfigData.supportRoleId,
                    adminRoleId: guildConfigData.adminRoleId,
                    incomingCategoryId: guildConfigData.incomingCategoryId
                };
            } else {
                guildConfig = {
                    ticketCategoryId: config.ticketCategoryId,
                    closedCategoryId: config.closedTicketCategoryId,
                    logChannelId: config.logChannelId,
                    supportRoleId: config.supportRoleId,
                    adminRoleId: config.adminRoleId,
                    incomingCategoryId: config.incomingCategoryId
                };
            }
        } catch (error) {
            console.error('Config alma hatası:', error);
            guildConfig = {
                ticketCategoryId: config.ticketCategoryId,
                closedCategoryId: config.closedTicketCategoryId,
                logChannelId: config.logChannelId,
                supportRoleId: config.supportRoleId,
                adminRoleId: config.adminRoleId,
                incomingCategoryId: config.incomingCategoryId
            };
        }

        // Cooldown ve açık ticket kontrolü
        const openTickets = await Ticket.getOpenTicketsByUser(userId);
        if (openTickets.length >= config.maxTicketsPerUser) {
            return {
                success: false,
                message: `❌ Zaten ${config.maxTicketsPerUser} açık ticket'ınız var!`
            };
        }

        try {
            // Kategori kontrolü - önce incomingCategoryId'yi dene, yoksa ticketCategoryId'yi kullan
            let category = null;
            if (guildConfig.incomingCategoryId) {
                category = guild.channels.cache.get(guildConfig.incomingCategoryId);
            }
            if (!category && guildConfig.ticketCategoryId) {
                category = guild.channels.cache.get(guildConfig.ticketCategoryId);
            }
            if (!category) {
                return { success: false, message: '❌ Ticket kategorisi bulunamadı! Lütfen önce `/setup` komutunu kullanın.' };
            }

            // Otomatik atama yapılana kadar yazma kapalı
            const channel = await guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: 0,
                parent: category,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] }, // Ticket açan kullanıcı yazamaz
                    { id: guildConfig.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: guildConfig.adminRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                ]
            });

            // Ticket veritabanına kaydet
            const ticketId = `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            const ticket = new Ticket({
                ticketId,
                channelId: channel.id,
                userId,
                type
            });
            await ticket.save();

            // Otomatik atama (en az yüklü support)
            const supportRole = guild.roles.cache.get(guildConfig.supportRoleId);
            const adminRole = guild.roles.cache.get(guildConfig.adminRoleId);
            let assignedUser = null;
            
            if ((supportRole && supportRole.members.size > 0) || (adminRole && adminRole.members.size > 0)) {
                // Önce support ve admin rollerini kontrol et
                const supportMembers = supportRole ? supportRole.members : new Map();
                const adminMembers = adminRole ? adminRole.members : new Map();
                
                const availableMembers = [];
                
                // Support üyelerini ekle (sadece online olanlar)
                for (const [id, member] of supportMembers) {
                    // Online durumunu kontrol et
                    const presence = guild.presences.cache.get(id);
                    const isOnline = presence && (presence.status === 'online' || presence.status === 'idle' || presence.status === 'dnd');
                    
                    if (!isOnline) continue; // Offline olanları atla
                    
                    const isAdmin = adminMembers.has(id);
                    const count = await Ticket.countDocuments({ assignedTo: id, status: 'açık' });
                    availableMembers.push({
                        member,
                        workload: count,
                        isAdmin: isAdmin,
                        priority: isAdmin ? 1 : 2
                    });
                }
                
                // Sadece admin rolüne sahip olanları ekle (sadece online olanlar)
                for (const [id, member] of adminMembers) {
                    if (!supportMembers.has(id)) {
                        // Online durumunu kontrol et
                        const presence = guild.presences.cache.get(id);
                        const isOnline = presence && (presence.status === 'online' || presence.status === 'idle' || presence.status === 'dnd');
                        
                        if (!isOnline) continue; // Offline olanları atla
                        
                        const count = await Ticket.countDocuments({ assignedTo: id, status: 'açık' });
                        availableMembers.push({
                            member,
                            workload: count,
                            isAdmin: true,
                            priority: 1
                        });
                    }
                }
                
                if (availableMembers.length > 0) {
                    // Önce önceliğe göre, sonra iş yüküne göre sırala
                    availableMembers.sort((a, b) => {
                        if (a.priority !== b.priority) {
                            return a.priority - b.priority;
                        }
                        return a.workload - b.workload;
                    });
                    
                    assignedUser = availableMembers[0].member;
                }
            }

            // Embed mesajı (mesajlar kapalı)
            const embedFields = [
                { name: '👤 Kullanıcı', value: `<@${userId}>`, inline: true },
                { name: '📋 Tip', value: config.ticketTypes[type].name, inline: true },
                { name: '📅 Oluşturulma', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: '👨‍💼 Atanan Yetkili', value: assignedUser ? `<@${assignedUser.id}>` : 'Şu anda atama bekleniyor.', inline: true }
            ];
            const embed = new EmbedBuilder()
                .setTitle(`🎫 Ticket #${ticketId}`)
                .setDescription(`${config.welcomeMessages[type]}

⚠️ **Mesajlar kapalıdır, otomatik atama bekleniyor.**`)
                .setColor(0x36393F)
                .addFields(embedFields)
                .setFooter({ text: 'Atama yapılana kadar mesaj gönderemezsiniz.' });

            // Yönetim butonları
            const managementButtons1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Kapat')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒'),
                    new ButtonBuilder()
                        .setCustomId('transfer_ticket')
                        .setLabel('Başka Birine Aktar')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄')
                );

            await channel.send({ 
                embeds: [embed], 
                components: [managementButtons1] 
            });

            if (assignedUser) {
                // Ticket'a atananı kaydet
                ticket.assignedTo = assignedUser.id;
                await ticket.save();

                // Kanal izinlerini güncelle: kullanıcı ve atanan yetkili yazabilir
                await channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }); // Ticket açan kullanıcıya yazma yetkisi ver
                await channel.permissionOverwrites.edit(assignedUser.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                await channel.permissionOverwrites.edit(guildConfig.supportRoleId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }); // Support rolü yazabilir
                await channel.permissionOverwrites.edit(guildConfig.adminRoleId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }); // Admin rolü yazabilir

                // Kanalda son 10 mesajı kontrol et, ilk bulduğu '🎫 Ticket #' başlıklı embed'i güncellesin
                const messages = await channel.messages.fetch({ limit: 10 });
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
                            ? { name: f.name, value: `<@${assignedUser.id}>`, inline: true }
                            : f
                    );
                    const newEmbed = EmbedBuilder.from(oldEmbed).setFields(newFields);
                    await ticketMsg.edit({ embeds: [newEmbed] });
                }

                // Atama bildirimi
                const assignedEmbed = new EmbedBuilder()
                    .setTitle('👨‍💼 Yetkili Atandı')
                    .setDescription(`Tarafımızca **${assignedUser.user.username}** yetkilisi atandı. Artık mesaj gönderebilirsiniz.`)
                    .setColor(0x36393F)
                    .setTimestamp();
                
                console.log(`📨 "Yetkili Atandı" mesajı gönderiliyor...`);
                await channel.send({ embeds: [assignedEmbed] });
                console.log(`✅ "Yetkili Atandı" mesajı başarıyla gönderildi!`);
            } else {
                // Atanmamış ticket bildirimi - ticket kanalındaki embed'ın altına ekle
                const waitingEmbed = new EmbedBuilder()
                    .setTitle('⏳ Yetkili Bekleniyor')
                    .setDescription(`Merhaba <@${userId}>! Ticket'ınız başarıyla oluşturuldu.\n\n**Durum:** Şu anda online olan yetkili bulunamadı.\n**Tahmini Süre:** En kısa sürede size yardımcı olacağız.\n\n**Lütfen bekleyiniz...**`)
                    .setColor(0x36393F)
                    .setTimestamp()
                    .setFooter({ text: 'Destek ekibimiz en kısa sürede sizinle ilgilenecek' });

                // Ticket kanalına gönder (embed'ın altına eklenir)
                await channel.send({ embeds: [waitingEmbed] });
            }

            return {
                success: true,
                message: `✅ Ticket başarıyla açıldı! <#${channel.id}>`
            };
        } catch (error) {
            console.error('Ticket açılırken hata:', error);
            return { success: false, message: '❌ Ticket açılırken bir hata oluştu!' };
        }
    }

    // Ticket kapatma - sadece atanan kişi veya admin kapatabilir
    async closeTicket(interaction) {
        const channel = interaction.channel;
        const ticket = await Ticket.findOne({ channelId: channel.id });

        if (!ticket) {
            return {
                success: false,
                message: '❌ Bu kanal bir ticket değil!'
            };
        }

        if (ticket.status === 'kapalı') {
            return {
                success: false,
                message: '❌ Bu ticket zaten kapalı!'
            };
        }

        // MongoDB'den config verilerini al
        const guildConfig = await this.getGuildConfig(interaction.guild.id);

        // Yetki kontrolü - sadece atanan kişi veya admin kapatabilir
        const isAdmin = interaction.member.roles.cache.has(guildConfig.adminRoleId) ||
                       interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
        
        const isAssigned = ticket.assignedTo === interaction.user.id;
        const isTicketCreator = ticket.userId === interaction.user.id;

        if (!isAdmin && !isAssigned && !isTicketCreator) {
            return {
                success: false,
                message: '❌ Bu ticket\'ı sadece atanan yetkili, ticket sahibi veya admin kapatabilir!'
            };
        }

        try {
            // Ticket durumunu güncelle
            ticket.status = 'kapalı';
            ticket.closedAt = new Date();
            ticket.closedBy = interaction.user.id;
            await ticket.save();

            // Transkript oluştur
            const transcript = await this.createTranscript(channel, ticket);

            // "📁 Kapalı Ticketlar" kategorisini al
            const closedCategory = interaction.guild.channels.cache.get(guildConfig.closedCategoryId);
            if (closedCategory) {
                try {
                    // TÜM KANALLARDA aynı ticket ID'sine sahip transkript kanalı ara (case-insensitive)
                    let existingTranscriptChannel = null;
                    
                    // Önce transkript- ile başlayan kanalları ara
                    const allChannels = interaction.guild.channels.cache.filter(ch => 
                        ch.type === 0 && 
                        ch.name.toLowerCase().startsWith('transkript-') &&
                        ch.name.toLowerCase().includes(ticket.ticketId.toLowerCase())
                    );
                    
                    if (allChannels.size > 0) {
                        existingTranscriptChannel = allChannels.first();
                        console.log(`✅ Mevcut transkript kanalı bulundu: #${existingTranscriptChannel.name}`);
                    }
                    
                    // Eğer transkript- ile başlayan bulunamazsa, sadece ticket ID'sini ara
                    if (!existingTranscriptChannel) {
                        const ticketIdChannels = interaction.guild.channels.cache.filter(ch => 
                            ch.type === 0 && 
                            ch.name.toLowerCase().includes(ticket.ticketId.toLowerCase()) &&
                            ch.name.toLowerCase().includes('transkript')
                        );
                        
                        if (ticketIdChannels.size > 0) {
                            existingTranscriptChannel = ticketIdChannels.first();
                            console.log(`✅ Ticket ID ile transkript kanalı bulundu: #${existingTranscriptChannel.name}`);
                        }
                    }
                    
                    let transcriptChannel;
                    if (existingTranscriptChannel) {
                        // Mevcut kanalı kullan
                        transcriptChannel = existingTranscriptChannel;
                        console.log(`✅ Mevcut transkript kanalı kullanılıyor: #${transcriptChannel.name}`);
                    } else {
                        // Yeni transkript kanalı oluştur
                        transcriptChannel = await interaction.guild.channels.create({
                            name: `transkript-${ticket.ticketId}`,
                        type: 0, // Text channel
                            parent: closedCategory.id,
                        permissionOverwrites: [
                            {
                                id: interaction.guild.id,
                                deny: [PermissionFlagsBits.ViewChannel]
                            },
                            {
                                    id: guildConfig.supportRoleId,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                                    deny: [PermissionFlagsBits.SendMessages]
                            },
                            {
                                    id: guildConfig.adminRoleId,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                                    deny: [PermissionFlagsBits.SendMessages]
                            }
                        ]
                    });
                        console.log(`✅ Yeni transkript kanalı oluşturuldu: #${transcriptChannel.name}`);
                    }

                    // Transkript embed'i yeni kanalda gönder
                    const transcriptEmbed = new EmbedBuilder()
                        .setTitle(`📄 Ticket Transkripti - #${ticket.ticketId}`)
                        .setDescription(`Bu ticket ${interaction.user} tarafından kapatıldı.`)
                        .addFields(
                            { name: '👤 Kullanıcı', value: `<@${ticket.userId}>`, inline: true },
                            { name: '📋 Tip', value: config.ticketTypes[ticket.type].name, inline: true },
                            { name: '👨‍💼 Atanan', value: ticket.assignedTo ? `<@${ticket.assignedTo}>` : 'Atanmamış', inline: true },
                            { name: '📅 Oluşturulma', value: `<t:${Math.floor(ticket.createdAt.getTime() / 1000)}:F>`, inline: true },
                            { name: '🔒 Kapatılma', value: `<t:${Math.floor(ticket.closedAt.getTime() / 1000)}:F>`, inline: true },
                            { name: '🔧 Kapatan', value: `<@${ticket.closedBy}>`, inline: true }
                        )
                        .setColor(0x36393F)
                        .setTimestamp();

                    // Çözüldü ve Yeniden Aç butonları
                    const actionRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('resolve_ticket')
                            .setLabel('Çözüldü')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅'),
                        new ButtonBuilder()
                            .setCustomId('reopen_ticket')
                            .setLabel('Yeniden Aç')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🔄')
                    );

                    // Transkript'i dosya olarak gönder
                    const transcriptPath = `./transcript-${ticket.ticketId}.txt`;
                    fs.writeFileSync(transcriptPath, transcript);
                    
                    await transcriptChannel.send({ 
                        embeds: [transcriptEmbed], 
                        files: [transcriptPath],
                        components: [actionRow]
                    });

                    // Dosyayı sil
                    fs.unlinkSync(transcriptPath);

                    console.log(`✅ Transkript kanalı oluşturuldu: #${transcriptChannel.name}`);

                    // Eski ticket kanalını sil
                    await channel.delete();
                    console.log(`🗑️ Eski ticket kanalı silindi: #${channel.name}`);

                } catch (error) {
                    console.error('Transkript kanalı oluşturma hatası:', error);
                    // Hata durumunda eski kanalı silmeye devam et
                    await channel.delete();
                }
            } else {
                console.log('⚠️ Kapalı ticket kategorisi bulunamadı, sadece kanal siliniyor.');
                await channel.delete();
            }

            // MongoDB'den ticket verisini sil
            // Ticket verisi silinmiyor, status 'kapalı' olarak kalıyor
            console.log(`ℹ️ Ticket verisi arşivde tutuluyor: ${ticket.ticketId}`);

            // Başarı mesajını döndür
            const result = {
                success: true,
                message: `✅ Ticket #${ticket.ticketId} başarıyla kapatıldı!`
            };

            return result;

        } catch (error) {
            console.error('Ticket kapatma hatası:', error);
            return {
                success: false,
                message: '❌ Ticket kapatılırken bir hata oluştu!'
            };
        }
    }

    // Ticket atama
    async assignTicket(interaction, targetUser) {
        const channel = interaction.channel;
        const ticket = await Ticket.findOne({ channelId: channel.id });

        if (!ticket) {
            return {
                success: false,
                message: '❌ Bu kanal bir ticket değil!'
            };
        }

        // Eğer kendine atıyorsa "devre alma", başkasına atıyorsa "transfer" mesajı
        const isSelfAssignment = targetUser.id === interaction.user.id;
        const actionType = isSelfAssignment ? 'devre alındı' : 'transfer edildi';

        try {
            ticket.assignedTo = targetUser.id;
            await ticket.save();

            // Kanalda son 10 mesajı kontrol et, ilk bulduğu "🎫 Ticket #..." başlıklı embed'i güncellesin
            const messages = await channel.messages.fetch({ limit: 10 });
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
                        ? { name: f.name, value: `<@${targetUser.id}>`, inline: true }
                        : f
                );
                const newEmbed = EmbedBuilder.from(oldEmbed).setFields(newFields);
                await ticketMsg.edit({ embeds: [newEmbed] });
            }

            return {
                success: true,
                message: `✅ Ticket başarıyla ${actionType}!`
            };

        } catch (error) {
            console.error('Ticket atama hatası:', error);
            return {
                success: false,
                message: `❌ Ticket ${actionType} sırasında bir hata oluştu!`
            };
        }
    }

    // Ticket çözüldü olarak işaretleme
    async resolveTicket(interaction) {
        const channel = interaction.channel;
        const ticket = await Ticket.findOne({ channelId: channel.id });

        if (!ticket) {
            return {
                success: false,
                message: '❌ Bu kanal bir ticket değil!'
            };
        }

        if (ticket.status === 'çözüldü') {
            return {
                success: false,
                message: '❌ Bu ticket zaten çözüldü olarak işaretlenmiş!'
            };
        }

        // Sadece ticket'ı atanan kişi çözebilir
        if (ticket.assignedTo !== interaction.user.id) {
            return {
                success: false,
                message: '❌ Bu butonu sadece ticket\'ı atanan yetkili kullanabilir!'
            };
        }

        // MongoDB'den config verilerini al
        const guildConfig = await this.getGuildConfig(interaction.guild.id);

        try {
            ticket.status = 'çözüldü';
            ticket.resolvedAt = new Date();
            ticket.resolvedBy = interaction.user.id;
            await ticket.save();

            const embed = new EmbedBuilder()
                .setTitle('✅ Ticket Çözüldü')
                .setDescription(`Bu ticket ${interaction.user} tarafından çözüldü olarak işaretlendi.\n\n**Ticket Detayları:**\n• **Ticket ID:** ${ticket.ticketId}\n• **Kullanıcı:** <@${ticket.userId}>\n• **Çözen:** <@${interaction.user.id}>\n• **Çözülme Tarihi:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                .setColor(0x00FF00)
                .setTimestamp()
                .setFooter({ text: 'Ticket başarıyla çözüldü' });

            await channel.send({ embeds: [embed] });

            // Log mesajı
            await this.sendLogMessage(interaction.guild, {
                action: 'TICKET_RESOLVED',
                ticketId: ticket.ticketId,
                userId: ticket.userId,
                resolvedBy: interaction.user.id
            }, guildConfig);

            return {
                success: true,
                message: `✅ Ticket #${ticket.ticketId} başarıyla çözüldü olarak işaretlendi!`
            };

        } catch (error) {
            console.error('Ticket çözme hatası:', error);
            return {
                success: false,
                message: '❌ Ticket çözülürken bir hata oluştu!'
            };
        }
    }

    // Ticket yeniden açma
    async reopenTicket(interaction) {
        const channel = interaction.channel;
        const ticket = await Ticket.findOne({ channelId: channel.id });

        if (!ticket) {
            return {
                success: false,
                message: '❌ Bu kanal bir ticket değil!'
            };
        }

        if (ticket.status === 'açık') {
            return {
                success: false,
                message: '❌ Bu ticket zaten açık!'
            };
        }

        // MongoDB'den config verilerini al
        const guildConfig = await this.getGuildConfig(interaction.guild.id);

        try {
            ticket.status = 'açık';
            ticket.closedAt = null;
            ticket.closedBy = null;
            await ticket.save();

            const embed = new EmbedBuilder()
                .setTitle('🔄 Ticket Yeniden Açıldı')
                .setDescription(`Bu ticket ${interaction.user} tarafından yeniden açıldı.`)
                .setColor(0x36393F)
                .setTimestamp();

            await channel.send({ embeds: [embed] });

            // Log mesajı
            await this.sendLogMessage(interaction.guild, {
                action: 'TICKET_REOPENED',
                ticketId: ticket.ticketId,
                userId: ticket.userId,
                reopenedBy: interaction.user.id
            }, guildConfig);

            return {
                success: true,
                message: `✅ Ticket #${ticket.ticketId} yeniden açıldı!`
            };

        } catch (error) {
            console.error('Ticket yeniden açma hatası:', error);
            return {
                success: false,
                message: '❌ Ticket yeniden açılırken bir hata oluştu!'
            };
        }
    }

    // Transkript oluşturma
    async createTranscript(channel, ticket) {
        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            let transcript = `=== TICKET TRANSCRIPT ===\n`;
            transcript += `Ticket ID: ${ticket.ticketId}\n`;
            transcript += `Kullanıcı: ${ticket.userId}\n`;
            transcript += `Tip: ${ticket.type}\n`;
            transcript += `Atanan: ${ticket.assignedTo || 'Atanmamış'}\n`;
            transcript += `Oluşturulma: ${ticket.createdAt}\n`;
            transcript += `Kapatılma: ${ticket.closedAt}\n`;
            transcript += `Kapatan: ${ticket.closedBy}\n`;
            transcript += `========================\n\n`;

            messages.reverse().forEach(msg => {
                const timestamp = new Date(msg.createdTimestamp).toLocaleString('tr-TR');
                transcript += `[${timestamp}] ${msg.author.username}: ${msg.content}\n`;
            });

            return transcript;

        } catch (error) {
            console.error('Transkript oluşturma hatası:', error);
            return 'Transkript oluşturulamadı.';
        }
    }

    // Log mesajı gönderme
    async sendLogMessage(guild, data, guildConfig) {
        try {
            // Log kanalı ID kontrolü
            if (!guildConfig.logChannelId) {
                console.log('⚠️ Log kanalı ID tanımlanmamış, log mesajı gönderilmedi.');
                return;
            }

            const logChannel = guild.channels.cache.get(guildConfig.logChannelId);
            if (!logChannel) {
                console.log(`⚠️ Log kanalı bulunamadı (ID: ${guildConfig.logChannelId}), log mesajı gönderilmedi.`);
                return;
            }

            // Kanal tipi kontrolü
            if (!logChannel.isTextBased()) {
                console.log('⚠️ Log kanalı metin kanalı değil, log mesajı gönderilmedi.');
                return;
            }

            const embed = new EmbedBuilder()
                .setTimestamp();

            switch (data.action) {
                case 'TICKET_OPENED':
                    embed.setTitle('🎫 Yeni Ticket Açıldı')
                        .setColor(0x36393F)
                        .setDescription(`**Ticket ID:** ${data.ticketId}\n**Kullanıcı:** <@${data.userId}>\n**Tip:** ${config.ticketTypes[data.type].name}\n**Kanal:** <#${data.channelId}>`);
                    
                    if (data.assignedTo) {
                        embed.addFields({ name: '👨‍💼 Atanan Yetkili', value: `<@${data.assignedTo}>`, inline: true });
                    }
                    break;

                case 'TICKET_CLOSED':
                    embed.setTitle('🔒 Ticket Kapatıldı')
                        .setColor(0x36393F)
                        .setDescription(`**Ticket ID:** ${data.ticketId}\n**Kullanıcı:** <@${data.userId}>\n**Kapatan:** <@${data.closedBy}>${data.transcriptChannelId ? `\n\n📄 **Transkript kanalı:** <#${data.transcriptChannelId}>` : ''}`);
                    break;

                case 'TICKET_RESOLVED':
                    embed.setTitle('✅ Ticket Çözüldü')
                        .setColor(0x00FF00)
                        .setDescription(`**Ticket ID:** ${data.ticketId}\n**Kullanıcı:** <@${data.userId}>\n**Çözen:** <@${data.resolvedBy}>\n**Durum:** ✅ Başarıyla çözüldü`);
                    break;

                case 'TICKET_REOPENED':
                    embed.setTitle('🔄 Ticket Yeniden Açıldı')
                        .setColor(0x36393F)
                        .setDescription(`**Ticket ID:** ${data.ticketId}\n**Kullanıcı:** <@${data.userId}>\n**Yeniden Açan:** <@${data.reopenedBy}>`);
                    break;
            }

            await logChannel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Log mesajı gönderme hatası:', error);
            // Log hatası bot'u durdurmaz, sadece konsola yazdır
        }
    }

    // İstatistik alma
    async getStats() {
        try {
            const stats = await Ticket.getTicketStats();
            return stats[0] || { totalTickets: 0, openTickets: 0, closedTickets: 0, resolvedTickets: 0 };
        } catch (error) {
            console.error('İstatistik alma hatası:', error);
            return { totalTickets: 0, openTickets: 0, closedTickets: 0, resolvedTickets: 0 };
        }
    }

    // Detaylı istatistik alma
    async getDetailedStats() {
        try {
            // Temel istatistikler
            const basicStats = await this.getStats();
            
            // En çok ticket açan kullanıcılar (Top 3)
            const topOpeners = await Ticket.aggregate([
                { $group: { _id: '$userId', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 3 }
            ]);

            // En çok ticket çözen yetkililer (Top 3) - resolvedBy alanını kullan
            const topResolvers = await Ticket.aggregate([
                { $match: { status: 'çözüldü', resolvedBy: { $exists: true, $ne: null } } },
                { $group: { _id: '$resolvedBy', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 3 }
            ]);

            // Ticket türlerine göre dağılım
            const ticketsByType = await Ticket.aggregate([
                { $group: { _id: '$type', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);

            // Ortalama kapatma süresi (saat cinsinden)
            const avgCloseTime = await Ticket.aggregate([
                { $match: { closedAt: { $exists: true } } },
                { 
                    $addFields: { 
                        closeTimeHours: { 
                            $divide: [
                                { $subtract: ['$closedAt', '$createdAt'] },
                                3600000 // milisaniye -> saat
                            ]
                        }
                    }
                },
                { $group: { _id: null, avgHours: { $avg: '$closeTimeHours' } } }
            ]);

            // Son 3 açılan ticket
            const recentTickets = await Ticket.find()
                .sort({ createdAt: -1 })
                .limit(3)
                .populate('userId', 'username');

            // Son 3 çözülen ticket
            const resolvedTickets = await Ticket.find({ 
                status: 'çözüldü', 
                resolvedBy: { $exists: true, $ne: null } 
            })
                .sort({ resolvedAt: -1 })
                .limit(3);

            // Günlük istatistikler (son 7 gün)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            const dailyStats = await Ticket.aggregate([
                { $match: { createdAt: { $gte: sevenDaysAgo } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: -1 } }
            ]);

            return {
                basic: basicStats,
                topOpeners,
                topResolvers,
                ticketsByType,
                avgCloseTime: avgCloseTime[0]?.avgHours || 0,
                recentTickets,
                resolvedTickets,
                dailyStats
            };

        } catch (error) {
            console.error('Detaylı istatistik alma hatası:', error);
            return {
                basic: { totalTickets: 0, openTickets: 0, closedTickets: 0, resolvedTickets: 0 },
                topOpeners: [],
                topResolvers: [],
                ticketsByType: [],
                avgCloseTime: 0,
                recentTickets: [],
                resolvedTickets: [],
                dailyStats: []
            };
        }
    }
}

module.exports = TicketManager; 