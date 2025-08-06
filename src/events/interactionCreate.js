const { Events, Collection, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const TicketManager = require('../utils/ticketManager');
const configEnvPath = path.join(__dirname, '../../config.env');
const config = require('../config');
const GuildConfig = require('../models/GuildConfig');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Slash komut işleme
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`${interaction.commandName} komutu bulunamadı.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: '❌ Komut çalıştırılırken bir hata oluştu!', ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ Komut çalıştırılırken bir hata oluştu!', ephemeral: true });
                }
            }
        }

        // SETUP BUTON AKIŞI
        if (interaction.isButton() && interaction.customId.startsWith('setup_')) {
            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: '❌ Bu işlemi sadece sunucu yöneticileri yapabilir!', ephemeral: true });
            }

            if (interaction.customId === 'setup_create_channels') {
                // Kanal kurulumu başlat
                try {
                    await interaction.deferUpdate();
                    
                    // Gelen Ticketlar kategorisi oluştur
                    const incomingCategory = await interaction.guild.channels.create({
                        name: '📨 Gelen Ticketlar',
                        type: 4, // Kategori
                        reason: 'Gelen ticketlar için ana kategori'
                    });

                    // Ticket kategorisi oluştur
                    const ticketCategory = await interaction.guild.channels.create({
                        name: '🎫 Ticket Sistemi',
                        type: 4, // Kategori
                        reason: 'Ticket sistemi kurulumu'
                    });

                    // Kapalı ticket kategorisi oluştur
                    const closedCategory = await interaction.guild.channels.create({
                        name: '📁 Kapalı Ticketlar',
                        type: 4, // Kategori
                        reason: 'Kapalı ticket sistemi kurulumu'
                    });

                    // Log kanalı oluştur
                    const logChannel = await interaction.guild.channels.create({
                        name: '📋 ticket-log',
                        type: 0, // Text kanal
                        parent: ticketCategory.id,
                        reason: 'Ticket log sistemi kurulumu',
                        permissionOverwrites: [
                            {
                                id: interaction.guild.id,
                                deny: [PermissionFlagsBits.ViewChannel]
                            },
                            {
                                id: interaction.client.user.id,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
                            }
                        ]
                    });

                    // Ticket panel kanalı oluştur
                    const panelChannel = await interaction.guild.channels.create({
                        name: '🎫 ticket-panel',
                        type: 0, // Text kanal
                        parent: ticketCategory.id,
                        reason: 'Ticket panel sistemi kurulumu',
                        permissionOverwrites: [
                            {
                                id: interaction.guild.id,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                            }
                        ]
                    });

                    // Support rolü oluştur
                    const supportRole = await interaction.guild.roles.create({
                        name: '🎫 Support',
                        color: 0x00ff00,
                        reason: 'Ticket support sistemi kurulumu',
                        permissions: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    });

                    // Admin rolü oluştur
                    const adminRole = await interaction.guild.roles.create({
                        name: '🔧 Ticket Admin',
                        color: 0xff0000,
                        reason: 'Ticket admin sistemi kurulumu',
                        permissions: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.ManageMessages
                        ]
                    });

                    // Kategori izinlerini ayarla
                    await ticketCategory.permissionOverwrites.set([
                        {
                            id: interaction.guild.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        {
                            id: supportRole.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory]
                        },
                        {
                            id: adminRole.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages]
                        }
                    ]);

                    await closedCategory.permissionOverwrites.set([
                        {
                            id: interaction.guild.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        {
                            id: supportRole.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory]
                        },
                        {
                            id: adminRole.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages]
                        }
                    ]);

                    // MongoDB'ye kaydet
                    await GuildConfig.setConfig(interaction.guild.id, {
                        ticketCategoryId: ticketCategory.id,
                        closedCategoryId: closedCategory.id,
                        logChannelId: logChannel.id,
                        supportRoleId: supportRole.id,
                        adminRoleId: adminRole.id,
                        incomingCategoryId: incomingCategory.id
                    });

                    // Başarı mesajı
                    const embed = new EmbedBuilder()
                        .setTitle('✅ Kanal Kurulumu Tamamlandı!')
                        .setDescription('Ticket sistemi için gerekli tüm kanallar ve roller başarıyla oluşturuldu.')
                        .addFields(
                            { name: '📨 Gelen Ticketlar', value: `<#${incomingCategory.id}>`, inline: true },
                            { name: '🎫 Ticket Kategorisi', value: `<#${ticketCategory.id}>`, inline: true },
                            { name: '📁 Kapalı Ticket Kategorisi', value: `<#${closedCategory.id}>`, inline: true },
                            { name: '📋 Log Kanalı', value: `<#${logChannel.id}>`, inline: true },
                            { name: '🎫 Panel Kanalı', value: `<#${panelChannel.id}>`, inline: true },
                            { name: '🎫 Support Rolü', value: `<@&${supportRole.id}>`, inline: true },
                            { name: '🔧 Admin Rolü', value: `<@&${adminRole.id}>`, inline: true }
                        )
                        .setColor(0x00ff00)
                        .setFooter({ text: 'Artık /panel komutu ile ticket panelini oluşturabilirsiniz!' });

                    await interaction.editReply({
                        content: 'Kanal kurulumu başarıyla tamamlandı!',
                        embeds: [embed],
                        components: []
                    });

                } catch (error) {
                    console.error('Kanal kurulumu hatası:', error);
                    await interaction.editReply({
                        content: '❌ Kanal kurulumu sırasında bir hata oluştu: ' + error.message,
                        embeds: [],
                        components: []
                    });
                }
            }
            else if (interaction.customId === 'setup_category_modal') {
                // Kategori ID modal'ı
                const modal = new ModalBuilder()
                    .setCustomId('setup_category_modal_submit')
                    .setTitle('Özel Kategori ID Gir');

                const categoryInput = new TextInputBuilder()
                    .setCustomId('category_id')
                    .setLabel('Kategori ID')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Örnek: 1234567890123456789')
                    .setRequired(true)
                    .setMinLength(17)
                    .setMaxLength(20);

                const firstActionRow = new ActionRowBuilder().addComponents(categoryInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
            }
            else if (interaction.customId === 'setup_skip_category') {
                // Varsayılan kategori kullan
                const categories = interaction.guild.channels.cache.filter(c => c.type === 4);
                const closedCategoryOptions = categories.map(cat => ({ label: cat.name, value: cat.id }));
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('setup_closed_category')
                        .setPlaceholder('Kapalı ticket kategorisini seçin')
                        .addOptions(closedCategoryOptions.slice(0, 25))
                );
                
                // Varsayılan olarak ilk kategoriyi kullan
                const defaultCategory = categories.first();
                interaction.message.setupData = { 
                    ticketCategoryId: defaultCategory ? defaultCategory.id : null,
                    useDefault: true
                };
                
                await interaction.update({
                    content: `Varsayılan kategori kullanılıyor: **${defaultCategory ? defaultCategory.name : 'Kategori bulunamadı'}**\n\nŞimdi kapalı ticket kategorisini seçin:`,
                    components: [row],
                    embeds: []
                });
            }
            else if (interaction.customId === 'setup_closed_category_modal') {
                // Kapalı kategori ID modal'ı
                const modal = new ModalBuilder()
                    .setCustomId('setup_closed_category_modal_submit')
                    .setTitle('Özel Kapalı Kategori ID Gir');

                const categoryInput = new TextInputBuilder()
                    .setCustomId('closed_category_id')
                    .setLabel('Kapalı Kategori ID')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Örnek: 1234567890123456789')
                    .setRequired(true)
                    .setMinLength(17)
                    .setMaxLength(20);

                const firstActionRow = new ActionRowBuilder().addComponents(categoryInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
            }
            else if (interaction.customId === 'setup_skip_closed_category') {
                // Varsayılan kapalı kategori kullan
                const categories = interaction.guild.channels.cache.filter(c => c.type === 4);
                const textChannels = interaction.guild.channels.cache.filter(c => c.type === 0);
                const logChannelOptions = textChannels.map(ch => ({ label: ch.name, value: ch.id }));
                
                const row1 = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('setup_log_channel')
                        .setPlaceholder('Log kanalını seçin')
                        .addOptions(logChannelOptions.slice(0, 25))
                );

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('setup_log_channel_modal')
                        .setLabel('Özel Kanal ID Gir')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✏️'),
                    new ButtonBuilder()
                        .setCustomId('setup_skip_log_channel')
                        .setLabel('Varsayılan Kullan')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚙️')
                );
                
                // Varsayılan olarak ikinci kategoriyi kullan (eğer varsa)
                const defaultClosedCategory = categories.size > 1 ? categories.at(1) : categories.first();
                const setupData = interaction.message.setupData || {};
                setupData.closedCategoryId = defaultClosedCategory ? defaultClosedCategory.id : null;
                setupData.useDefaultClosed = true;
                interaction.message.setupData = setupData;
                
                await interaction.update({
                    content: `Varsayılan kapalı kategori kullanılıyor: **${defaultClosedCategory ? defaultClosedCategory.name : 'Kategori bulunamadı'}**\n\nŞimdi log kanalını seçin:`,
                    components: [row1, row2],
                    embeds: []
                });
            }
            else if (interaction.customId === 'setup_log_channel_modal') {
                // Log kanalı ID modal'ı
                const modal = new ModalBuilder()
                    .setCustomId('setup_log_channel_modal_submit')
                    .setTitle('Özel Log Kanalı ID Gir');

                const channelInput = new TextInputBuilder()
                    .setCustomId('log_channel_id')
                    .setLabel('Log Kanalı ID')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Örnek: 1234567890123456789')
                    .setRequired(true)
                    .setMinLength(17)
                    .setMaxLength(20);

                const firstActionRow = new ActionRowBuilder().addComponents(channelInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
            }
            else if (interaction.customId === 'setup_skip_log_channel') {
                // Varsayılan log kanalı kullan
                const textChannels = interaction.guild.channels.cache.filter(c => c.type === 0);
                const roles = interaction.guild.roles.cache.filter(r => r.id !== interaction.guild.id);
                const roleOptions = roles.map(role => ({ label: role.name, value: role.id }));
                
                const row1 = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('setup_support_role')
                        .setPlaceholder('Support rolünü seçin')
                        .addOptions(roleOptions.slice(0, 25))
                );

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('setup_support_role_modal')
                        .setLabel('Özel Rol ID Gir')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✏️'),
                    new ButtonBuilder()
                        .setCustomId('setup_skip_support_role')
                        .setLabel('Varsayılan Kullan')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚙️')
                );
                
                // Varsayılan olarak "log" veya "logs" kanalını bul
                const defaultLogChannel = textChannels.find(ch => 
                    ch.name.toLowerCase().includes('log') || 
                    ch.name.toLowerCase().includes('ticket')
                ) || textChannels.first();
                
                const setupData = interaction.message.setupData || {};
                setupData.logChannelId = defaultLogChannel ? defaultLogChannel.id : null;
                setupData.useDefaultLog = true;
                interaction.message.setupData = setupData;
                
                await interaction.update({
                    content: `Varsayılan log kanalı kullanılıyor: **${defaultLogChannel ? defaultLogChannel.name : 'Kanal bulunamadı'}**\n\nŞimdi support rolünü seçin:`,
                    components: [row1, row2],
                    embeds: []
                });
            }
            else if (interaction.customId === 'setup_support_role_modal') {
                // Support rolü ID modal'ı
                const modal = new ModalBuilder()
                    .setCustomId('setup_support_role_modal_submit')
                    .setTitle('Özel Support Rolü ID Gir');

                const roleInput = new TextInputBuilder()
                    .setCustomId('support_role_id')
                    .setLabel('Support Rolü ID')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Örnek: 1234567890123456789')
                    .setRequired(true)
                    .setMinLength(17)
                    .setMaxLength(20);

                const firstActionRow = new ActionRowBuilder().addComponents(roleInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
            }
            else if (interaction.customId === 'setup_skip_support_role') {
                // Varsayılan support rolü kullan
                const roles = interaction.guild.roles.cache.filter(r => r.id !== interaction.guild.id);
                const roleOptions = roles.map(role => ({ label: role.name, value: role.id }));
                
                const row1 = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('setup_admin_role')
                        .setPlaceholder('Admin rolünü seçin')
                        .addOptions(roleOptions.slice(0, 25))
                );

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('setup_admin_role_modal')
                        .setLabel('Özel Rol ID Gir')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✏️'),
                    new ButtonBuilder()
                        .setCustomId('setup_skip_admin_role')
                        .setLabel('Varsayılan Kullan')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚙️')
                );
                
                // Varsayılan olarak "support" rolünü bul
                const defaultSupportRole = roles.find(role => 
                    role.name.toLowerCase().includes('support') || 
                    role.name.toLowerCase().includes('moderator') ||
                    role.name.toLowerCase().includes('helper')
                ) || roles.first();
                
                const setupData = interaction.message.setupData || {};
                setupData.supportRoleId = defaultSupportRole ? defaultSupportRole.id : null;
                setupData.useDefaultSupport = true;
                interaction.message.setupData = setupData;
                
                await interaction.update({
                    content: `Varsayılan support rolü kullanılıyor: **${defaultSupportRole ? defaultSupportRole.name : 'Rol bulunamadı'}**\n\nŞimdi admin rolünü seçin:`,
                    components: [row1, row2],
                    embeds: []
                });
            }
            else if (interaction.customId === 'setup_admin_role_modal') {
                // Admin rolü ID modal'ı
                const modal = new ModalBuilder()
                    .setCustomId('setup_admin_role_modal_submit')
                    .setTitle('Özel Admin Rolü ID Gir');

                const roleInput = new TextInputBuilder()
                    .setCustomId('admin_role_id')
                    .setLabel('Admin Rolü ID')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Örnek: 1234567890123456789')
                    .setRequired(true)
                    .setMinLength(17)
                    .setMaxLength(20);

                const firstActionRow = new ActionRowBuilder().addComponents(roleInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
            }
            else if (interaction.customId === 'setup_skip_admin_role') {
                // Varsayılan admin rolü kullan ve kurulumu tamamla
                const roles = interaction.guild.roles.cache.filter(r => r.id !== interaction.guild.id);
                
                // Varsayılan olarak "admin" rolünü bul
                const defaultAdminRole = roles.find(role => 
                    role.name.toLowerCase().includes('admin') || 
                    role.name.toLowerCase().includes('owner') ||
                    role.name.toLowerCase().includes('manager')
                ) || roles.first();
                
                const setupData = interaction.message.setupData || {};
                setupData.adminRoleId = defaultAdminRole ? defaultAdminRole.id : null;
                setupData.useDefaultAdmin = true;

                // MongoDB'ye kaydet
                await GuildConfig.setConfig(interaction.guild.id, {
                    ticketCategoryId: setupData.ticketCategoryId,
                    closedCategoryId: setupData.closedCategoryId,
                    logChannelId: setupData.logChannelId,
                    supportRoleId: setupData.supportRoleId,
                    adminRoleId: setupData.adminRoleId
                });

                // Son embed
                const embed = new EmbedBuilder()
                    .setTitle('✅ Kurulum Tamamlandı!')
                    .setDescription('Ayarlar başarıyla kaydedildi. Botu yeniden başlatmanız önerilir.')
                    .addFields(
                        { name: 'Ticket Kategorisi', value: `<#${setupData.ticketCategoryId}>`, inline: true },
                        { name: 'Kapalı Ticket Kategorisi', value: `<#${setupData.closedCategoryId}>`, inline: true },
                        { name: 'Log Kanalı', value: `<#${setupData.logChannelId}>`, inline: true },
                        { name: 'Support Rolü', value: `<@&${setupData.supportRoleId}>`, inline: true },
                        { name: 'Admin Rolü', value: `<@&${setupData.adminRoleId}>`, inline: true }
                    )
                    .setColor(0x36393F)
                    .setFooter({ text: 'Ayarlar MongoDB veritabanına kaydedildi.' });

                await interaction.update({
                    content: 'Kurulum tamamlandı! Ayarlar MongoDB veritabanına kaydedildi. Botu yeniden başlatmanız önerilir.',
                    embeds: [embed],
                    components: []
                });
            }
        }

        // SETUP MODAL AKIŞI
        if (interaction.isModalSubmit() && interaction.customId.startsWith('setup_')) {
            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: '❌ Bu işlemi sadece sunucu yöneticileri yapabilir!', ephemeral: true });
            }

            if (interaction.customId === 'setup_category_modal_submit') {
                const categoryId = interaction.fields.getTextInputValue('category_id');
                
                // Kategori ID'sini doğrula
                const category = interaction.guild.channels.cache.get(categoryId);
                if (!category || category.type !== 4) {
                    return interaction.reply({
                        content: '❌ Geçersiz kategori ID! Lütfen geçerli bir kategori ID\'si girin.',
                        ephemeral: true
                    });
                }

                const categories = interaction.guild.channels.cache.filter(c => c.type === 4);
                const closedCategoryOptions = categories.map(cat => ({ label: cat.name, value: cat.id }));
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('setup_closed_category')
                        .setPlaceholder('Kapalı ticket kategorisini seçin')
                        .addOptions(closedCategoryOptions.slice(0, 25))
                );
                
                interaction.message.setupData = { ticketCategoryId: categoryId };
                await interaction.update({
                    content: `Kategori seçildi: **${category.name}**\n\nŞimdi kapalı ticket kategorisini seçin:`,
                    components: [row],
                    embeds: []
                });
            }
            else if (interaction.customId === 'setup_closed_category_modal_submit') {
                const closedCategoryId = interaction.fields.getTextInputValue('closed_category_id');
                
                // Kapalı kategori ID'sini doğrula
                const closedCategory = interaction.guild.channels.cache.get(closedCategoryId);
                if (!closedCategory || closedCategory.type !== 4) {
                    return interaction.reply({
                        content: '❌ Geçersiz kapalı kategori ID! Lütfen geçerli bir kapalı kategori ID\'si girin.',
                        ephemeral: true
                    });
                }

                const textChannels = interaction.guild.channels.cache.filter(c => c.type === 0);
                const logChannelOptions = textChannels.map(ch => ({ label: ch.name, value: ch.id }));
                
                const row1 = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('setup_log_channel')
                        .setPlaceholder('Log kanalını seçin')
                        .addOptions(logChannelOptions.slice(0, 25))
                );

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('setup_log_channel_modal')
                        .setLabel('Özel Kanal ID Gir')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✏️'),
                    new ButtonBuilder()
                        .setCustomId('setup_skip_log_channel')
                        .setLabel('Varsayılan Kullan')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚙️')
                );
                
                const setupData = interaction.message.setupData || {};
                setupData.closedCategoryId = closedCategoryId;
                interaction.message.setupData = setupData;
                
                await interaction.update({
                    content: `Kapalı kategori seçildi: **${closedCategory.name}**\n\nŞimdi log kanalını seçin:`,
                    components: [row1, row2],
                    embeds: []
                });
            }
            else if (interaction.customId === 'setup_log_channel_modal_submit') {
                const logChannelId = interaction.fields.getTextInputValue('log_channel_id');
                
                // Log kanalı ID'sini doğrula
                const logChannel = interaction.guild.channels.cache.get(logChannelId);
                if (!logChannel || logChannel.type !== 0) {
                    return interaction.reply({
                        content: '❌ Geçersiz log kanalı ID! Lütfen geçerli bir log kanalı ID\'si girin.',
                        ephemeral: true
                    });
                }

                const roles = interaction.guild.roles.cache.filter(r => r.id !== interaction.guild.id);
                const roleOptions = roles.map(role => ({ label: role.name, value: role.id }));
                
                const row1 = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('setup_support_role')
                        .setPlaceholder('Support rolünü seçin')
                        .addOptions(roleOptions.slice(0, 25))
                );

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('setup_support_role_modal')
                        .setLabel('Özel Rol ID Gir')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✏️'),
                    new ButtonBuilder()
                        .setCustomId('setup_skip_support_role')
                        .setLabel('Varsayılan Kullan')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚙️')
                );
                
                const setupData = interaction.message.setupData || {};
                setupData.logChannelId = logChannelId;
                interaction.message.setupData = setupData;
                
                await interaction.update({
                    content: `Log kanalı seçildi: **${logChannel.name}**\n\nŞimdi support rolünü seçin:`,
                    components: [row1, row2],
                    embeds: []
                });
            }
            else if (interaction.customId === 'setup_support_role_modal_submit') {
                const supportRoleId = interaction.fields.getTextInputValue('support_role_id');
                
                // Support rolü ID'sini doğrula
                const supportRole = interaction.guild.roles.cache.get(supportRoleId);
                if (!supportRole) {
                    return interaction.reply({
                        content: '❌ Geçersiz support rolü ID! Lütfen geçerli bir support rolü ID\'si girin.',
                        ephemeral: true
                    });
                }

                const roles = interaction.guild.roles.cache.filter(r => r.id !== interaction.guild.id);
                const roleOptions = roles.map(role => ({ label: role.name, value: role.id }));
                
                const row1 = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('setup_admin_role')
                        .setPlaceholder('Admin rolünü seçin')
                        .addOptions(roleOptions.slice(0, 25))
                );

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('setup_admin_role_modal')
                        .setLabel('Özel Rol ID Gir')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✏️'),
                    new ButtonBuilder()
                        .setCustomId('setup_skip_admin_role')
                        .setLabel('Varsayılan Kullan')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚙️')
                );
                
                const setupData = interaction.message.setupData || {};
                setupData.supportRoleId = supportRoleId;
                interaction.message.setupData = setupData;
                
                await interaction.update({
                    content: `Support rolü seçildi: **${supportRole.name}**\n\nŞimdi admin rolünü seçin:`,
                    components: [row1, row2],
                    embeds: []
                });
            }
            else if (interaction.customId === 'setup_admin_role_modal_submit') {
                const adminRoleId = interaction.fields.getTextInputValue('admin_role_id');
                
                // Admin rolü ID'sini doğrula
                const adminRole = interaction.guild.roles.cache.get(adminRoleId);
                if (!adminRole) {
                    return interaction.reply({
                        content: '❌ Geçersiz admin rolü ID! Lütfen geçerli bir admin rolü ID\'si girin.',
                        ephemeral: true
                    });
                }
                
                const setupData = interaction.message.setupData || {};
                setupData.adminRoleId = adminRoleId;

                // MongoDB'ye kaydet
                await GuildConfig.setConfig(interaction.guild.id, {
                    ticketCategoryId: setupData.ticketCategoryId,
                    closedCategoryId: setupData.closedCategoryId,
                    logChannelId: setupData.logChannelId,
                    supportRoleId: setupData.supportRoleId,
                    adminRoleId: setupData.adminRoleId
                });

                // Son embed
                const embed = new EmbedBuilder()
                    .setTitle('✅ Kurulum Tamamlandı!')
                    .setDescription('Ayarlar başarıyla kaydedildi. Botu yeniden başlatmanız önerilir.')
                    .addFields(
                        { name: 'Ticket Kategorisi', value: `<#${setupData.ticketCategoryId}>`, inline: true },
                        { name: 'Kapalı Ticket Kategorisi', value: `<#${setupData.closedCategoryId}>`, inline: true },
                        { name: 'Log Kanalı', value: `<#${setupData.logChannelId}>`, inline: true },
                        { name: 'Support Rolü', value: `<@&${setupData.supportRoleId}>`, inline: true },
                        { name: 'Admin Rolü', value: `<@&${setupData.adminRoleId}>`, inline: true }
                    )
                    .setColor(0x36393F)
                    .setFooter({ text: 'Ayarlar MongoDB veritabanına kaydedildi.' });

                await interaction.update({
                    content: 'Kurulum tamamlandı! Ayarlar MongoDB veritabanına kaydedildi. Botu yeniden başlatmanız önerilir.',
                    embeds: [embed],
                    components: []
                });
            }
        }

        // SETUP SELECT MENU AKIŞI (sadece setup_ ile başlayanlar için admin kontrolü)
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('setup_')) {
            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: '❌ Bu işlemi sadece sunucu yöneticileri yapabilir!', ephemeral: true });
            }

            // Geçici olarak seçimleri interaction.customId ile ayırt ediyoruz
            if (interaction.customId === 'setup_category') {
                const selectedCategory = interaction.values[0];
                const categories = interaction.guild.channels.cache.filter(c => c.type === 4);
                const closedCategoryOptions = categories.map(cat => ({ label: cat.name, value: cat.id }));
                
                const row1 = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('setup_closed_category')
                        .setPlaceholder('Kapalı ticket kategorisini seçin')
                        .addOptions(closedCategoryOptions.slice(0, 25))
                );

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('setup_closed_category_modal')
                        .setLabel('Özel Kategori ID Gir')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✏️'),
                    new ButtonBuilder()
                        .setCustomId('setup_skip_closed_category')
                        .setLabel('Varsayılan Kullan')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚙️')
                );

                interaction.message.setupData = { ticketCategoryId: selectedCategory };
                await interaction.update({
                    content: 'Ticket kategorisi seçildi. Şimdi kapalı ticket kategorisini seçin:',
                    components: [row1, row2],
                    embeds: []
                });
            }
            else if (interaction.customId === 'setup_closed_category') {
                const selectedClosedCategory = interaction.values[0];
                const textChannels = interaction.guild.channels.cache.filter(c => c.type === 0);
                const logChannelOptions = textChannels.map(ch => ({ label: ch.name, value: ch.id }));
                
                const row1 = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('setup_log_channel')
                        .setPlaceholder('Log kanalını seçin')
                        .addOptions(logChannelOptions.slice(0, 25))
                );

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('setup_log_channel_modal')
                        .setLabel('Özel Kanal ID Gir')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✏️'),
                    new ButtonBuilder()
                        .setCustomId('setup_skip_log_channel')
                        .setLabel('Varsayılan Kullan')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚙️')
                );

                const setupData = interaction.message.setupData || {};
                setupData.closedCategoryId = selectedClosedCategory;
                interaction.message.setupData = setupData;
                await interaction.update({
                    content: 'Kapalı ticket kategorisi seçildi. Şimdi log kanalını seçin:',
                    components: [row1, row2],
                    embeds: []
                });
            }
            else if (interaction.customId === 'setup_log_channel') {
                const selectedLogChannel = interaction.values[0];
                const roles = interaction.guild.roles.cache.filter(r => r.id !== interaction.guild.id);
                const roleOptions = roles.map(role => ({ label: role.name, value: role.id }));
                
                const row1 = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('setup_support_role')
                        .setPlaceholder('Support rolünü seçin')
                        .addOptions(roleOptions.slice(0, 25))
                );

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('setup_support_role_modal')
                        .setLabel('Özel Rol ID Gir')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✏️'),
                    new ButtonBuilder()
                        .setCustomId('setup_skip_support_role')
                        .setLabel('Varsayılan Kullan')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚙️')
                );

                const setupData = interaction.message.setupData || {};
                setupData.logChannelId = selectedLogChannel;
                interaction.message.setupData = setupData;
                await interaction.update({
                    content: 'Log kanalı seçildi. Şimdi support rolünü seçin:',
                    components: [row1, row2],
                    embeds: []
                });
            }
            else if (interaction.customId === 'setup_support_role') {
                const selectedSupportRole = interaction.values[0];
                const roles = interaction.guild.roles.cache.filter(r => r.id !== interaction.guild.id);
                const roleOptions = roles.map(role => ({ label: role.name, value: role.id }));
                
                const row1 = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('setup_admin_role')
                        .setPlaceholder('Admin rolünü seçin')
                        .addOptions(roleOptions.slice(0, 25))
                );

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('setup_admin_role_modal')
                        .setLabel('Özel Rol ID Gir')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✏️'),
                    new ButtonBuilder()
                        .setCustomId('setup_skip_admin_role')
                        .setLabel('Varsayılan Kullan')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚙️')
                );

                const setupData = interaction.message.setupData || {};
                setupData.supportRoleId = selectedSupportRole;
                interaction.message.setupData = setupData;
                await interaction.update({
                    content: 'Support rolü seçildi. Şimdi admin rolünü seçin:',
                    components: [row1, row2],
                    embeds: []
                });
            }
            else if (interaction.customId === 'setup_admin_role') {
                const selectedAdminRole = interaction.values[0];
                const setupData = interaction.message.setupData || {};
                setupData.adminRoleId = selectedAdminRole;

                // MongoDB'ye kaydet
                await GuildConfig.setConfig(interaction.guild.id, {
                    ticketCategoryId: setupData.ticketCategoryId,
                    closedCategoryId: setupData.closedCategoryId,
                    logChannelId: setupData.logChannelId,
                    supportRoleId: setupData.supportRoleId,
                    adminRoleId: setupData.adminRoleId
                });

                // Son embed
                const embed = new EmbedBuilder()
                    .setTitle('✅ Kurulum Tamamlandı!')
                    .setDescription('Ayarlar başarıyla kaydedildi. Botu yeniden başlatmanız önerilir.')
                    .addFields(
                        { name: 'Ticket Kategorisi', value: `<#${setupData.ticketCategoryId}>`, inline: true },
                        { name: 'Kapalı Ticket Kategorisi', value: `<#${setupData.closedCategoryId}>`, inline: true },
                        { name: 'Log Kanalı', value: `<#${setupData.logChannelId}>`, inline: true },
                        { name: 'Support Rolü', value: `<@&${setupData.supportRoleId}>`, inline: true },
                        { name: 'Admin Rolü', value: `<@&${setupData.adminRoleId}>`, inline: true }
                    )
                    .setColor(0x36393F)
                    .setFooter({ text: 'Ayarlar MongoDB veritabanına kaydedildi.' });

                await interaction.update({
                    content: 'Kurulum tamamlandı! Ayarlar MongoDB veritabanına kaydedildi. Botu yeniden başlatmanız önerilir.',
                    embeds: [embed],
                    components: []
                });
            }
        }

        // Select menu ile ticket açma (herkes açabilir)
        if (interaction.isStringSelectMenu() && interaction.customId === 'create_ticket_select') {
            const ticketType = interaction.values[0];
            
            try {
                // Önce hızlı bir yanıt gönder
                await interaction.deferReply({ ephemeral: true });
                
            // TicketManager'a özel bir flag ile yazma kapalı ticket açtır
            const result = await TicketManager.createTicketWithLockedChannel(interaction, ticketType);
                
                await interaction.editReply({
                    content: result.message
                });
            } catch (error) {
                console.error('Ticket açma hatası:', error);
                
                // Eğer interaction hala geçerliyse yanıt ver
                try {
                    if (interaction.deferred) {
                        await interaction.editReply({
                            content: '❌ Ticket açılırken bir hata oluştu! Lütfen tekrar deneyin.'
                        });
                    } else {
            await interaction.reply({
                            content: '❌ Ticket açılırken bir hata oluştu! Lütfen tekrar deneyin.',
                ephemeral: true
            });
                    }
                } catch (replyError) {
                    console.error('Yanıt gönderme hatası:', replyError);
                }
            }
            return;
        }

        // Buton etkileşimi işleme
        if (interaction.isButton()) {
            const ticketManager = new TicketManager(interaction.client);

            // Ticket yönetim butonları için yetki kontrolü
            const ticketButtonIds = [
                'close_ticket',
                'transfer_ticket',
                'transcript_ticket',
                'resolve_ticket'
            ];
            if (ticketButtonIds.includes(interaction.customId)) {
                // Ticket modelini al
                const Ticket = require('../models/Ticket');
                let ticket = await Ticket.findOne({ channelId: interaction.channel.id });

                // Eğer ticket bulunamazsa embed'den ticketId çekip tekrar ara
                if (!ticket) {
                    let embed = interaction.message && interaction.message.embeds && interaction.message.embeds[0] ? interaction.message.embeds[0] : null;
                    if (!embed) {
                        const messages = await interaction.channel.messages.fetch({ limit: 10 });
                        const ticketMsg = messages.find(msg =>
                            msg.embeds.length > 0 &&
                            msg.embeds[0].title &&
                            msg.embeds[0].title.includes('Ticket')
                        );
                        if (ticketMsg) embed = ticketMsg.embeds[0];
                    }
                    let ticketId = null;
                    if (embed) {
                        const ticketIdMatch1 = embed.title.match(/#([A-Za-z0-9\-]+)/);
                        if (ticketIdMatch1) {
                            ticketId = ticketIdMatch1[1];
                        } else {
                            const parts = embed.title.split(' - ');
                            if (parts.length > 1) {
                                const lastPart = parts[parts.length - 1];
                                if (lastPart.startsWith('TICKET-')) {
                                    ticketId = lastPart;
                                }
                            }
                        }
                    }
                    if (ticketId) {
                        // Önce açık ticket'ı ara, bulamazsa tüm ticket'ları ara
                        ticket = await Ticket.findOne({ ticketId, status: 'açık' });
                        if (!ticket) {
                            ticket = await Ticket.findOne({ ticketId });
                        }
                    }
                }

                if (!ticket) {
                    return interaction.reply({ content: '❌ Bu kanal bir ticket değil!', ephemeral: true });
                }
                
                // Sadece atanan yetkili kontrolü
                const isAssignedUser = ticket.assignedTo === interaction.user.id;
                const isAdmin = interaction.member.permissions.has('Administrator');
                
                if (!isAssignedUser && !isAdmin) {
                    return interaction.reply({ 
                        content: '❌ Bu işlemi sadece bu ticket\'a atanan yetkili yapabilir!', 
                        ephemeral: true 
                    });
                }
            }

            // Ticket açma butonları
            if (interaction.customId.startsWith('create_ticket_')) {
                const ticketType = interaction.customId.replace('create_ticket_', '');
                
                try {
                    await interaction.deferReply({ ephemeral: true });
                    const result = await ticketManager.createTicket(interaction, ticketType);
                    
                    await interaction.editReply({
                        content: result.message
                    });
                } catch (error) {
                    console.error('Ticket açma hatası:', error);
                    try {
                        if (interaction.deferred) {
                            await interaction.editReply({
                                content: '❌ Ticket açılırken bir hata oluştu! Lütfen tekrar deneyin.'
                            });
                        } else {
                await interaction.reply({
                                content: '❌ Ticket açılırken bir hata oluştu! Lütfen tekrar deneyin.',
                    ephemeral: true
                });
                        }
                    } catch (replyError) {
                        console.error('Yanıt gönderme hatası:', replyError);
                    }
                }
                return;
            }

            // Ticket yönetim butonları
            switch (interaction.customId) {
                case 'close_ticket':
                    try {
                        await interaction.deferReply({ ephemeral: true });
                        const closeResult = await ticketManager.closeTicket(interaction);
                        
                        // Eğer başarılıysa yanıt ver, değilse hata mesajı
                        if (closeResult.success) {
                            await interaction.editReply({
                                content: closeResult.message
                            });
                        } else {
                            await interaction.editReply({
                                content: closeResult.message
                            });
                        }
                    } catch (error) {
                        console.error('Ticket kapatma hatası:', error);
                        try {
                            if (interaction.deferred) {
                                await interaction.editReply({
                                    content: '❌ Ticket kapatılırken bir hata oluştu!'
                            });
                        } else {
                            await interaction.reply({
                                content: '❌ Ticket kapatılırken bir hata oluştu!',
                                ephemeral: true
                            });
                            }
                        } catch (replyError) {
                            console.error('Yanıt gönderme hatası:', replyError);
                        }
                    }
                    break;

                case 'assign_ticket':
                    // Atama modal'ı göster
                    const assignModal = new ModalBuilder()
                        .setCustomId('assign_modal')
                        .setTitle('Ticket Atama');

                    const userInput = new TextInputBuilder()
                        .setCustomId('user_id')
                        .setLabel('Kullanıcı ID veya @mention')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Örnek: 123456789 veya @kullanıcı')
                        .setRequired(true);

                    const firstActionRow = new ActionRowBuilder().addComponents(userInput);
                    assignModal.addComponents(firstActionRow);

                    await interaction.showModal(assignModal);
                    break;

                case 'transfer_ticket':
                    // Transfer modal'ı göster - sadece admin yetkisi
                    const ticketManagerForTransfer = new TicketManager(interaction.client);
                    const guildConfigForTransfer = await ticketManagerForTransfer.getGuildConfig(interaction.guild.id);
                    
                    const hasTransferPermission = interaction.member.roles.cache.has(guildConfigForTransfer.adminRoleId) ||
                                               interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

                    if (!hasTransferPermission) {
                        return interaction.reply({
                            content: '❌ Bu butonu sadece admin yetkisine sahip kişiler kullanabilir!',
                            ephemeral: true
                        });
                    }

                    const transferModal = new ModalBuilder()
                        .setCustomId('transfer_modal')
                        .setTitle('Ticket Transfer');

                    const transferUserInput = new TextInputBuilder()
                        .setCustomId('transfer_user_id')
                        .setLabel('Transfer Edilecek Kullanıcı ID veya @mention')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Örnek: 123456789 veya @kullanıcı')
                        .setRequired(true);

                    const transferActionRow = new ActionRowBuilder().addComponents(transferUserInput);
                    transferModal.addComponents(transferActionRow);

                    await interaction.showModal(transferModal);
                    break;

                case 'transcript_ticket':
                    try {
                        await interaction.deferReply({ ephemeral: true });
                        // Transkript oluştur
                        const channel = interaction.channel;
                        const ticket = await require('../models/Ticket').findOne({ channelId: channel.id });
                        
                        if (!ticket) {
                            await interaction.editReply({
                                content: '❌ Bu kanal bir ticket değil!'
                            });
                            return;
                    }

                    const transcript = await ticketManager.createTranscript(channel, ticket);
                    
                    // Transkript'i dosya olarak gönder
                    const transcriptPath = `./transcript-${ticket.ticketId}.txt`;
                    fs.writeFileSync(transcriptPath, transcript);
                    
                        await interaction.editReply({
                        content: '📄 Transkript oluşturuldu!',
                            files: [transcriptPath]
                    });
                    
                    // Dosyayı sil
                    fs.unlinkSync(transcriptPath);
                    } catch (error) {
                        console.error('Transkript hatası:', error);
                        try {
                            if (interaction.deferred) {
                                await interaction.editReply({
                                    content: '❌ Transkript oluşturulurken bir hata oluştu!'
                                });
                            } else {
                    await interaction.reply({
                                    content: '❌ Transkript oluşturulurken bir hata oluştu!',
                        ephemeral: true
                    });
                            }
                        } catch (replyError) {
                            console.error('Yanıt gönderme hatası:', replyError);
                        }
                    }
                    break;

                case 'resolve_ticket':
                    try {
                        await interaction.deferReply({ ephemeral: true });
                        
                        // Önce interaction.message.embeds[0] ile embed bul
                        let embed = interaction.message && interaction.message.embeds && interaction.message.embeds[0] ? interaction.message.embeds[0] : null;
                        
                        // Eğer embed yoksa kanaldaki son 10 mesajı tara
                        if (!embed) {
                            const messages = await interaction.channel.messages.fetch({ limit: 10 });
                            const ticketMsg = messages.find(msg =>
                                msg.embeds.length > 0 &&
                                msg.embeds[0].title &&
                                msg.embeds[0].title.includes('Ticket Transkripti')
                            );
                            if (ticketMsg) {
                                embed = ticketMsg.embeds[0];
                            }
                        }
                        
                        if (!embed) {
                            await interaction.editReply({ content: '❌ Ticket bilgisi bulunamadı! (Embed yok)' });
                            return;
                        }

                        // Transkript embed'inin başlığından ticket ID'sini çıkar
                        let ticketId = null;
                        const ticketIdMatch1 = embed.title.match(/#([A-Za-z0-9\-]+)/);
                        if (ticketIdMatch1) {
                            ticketId = ticketIdMatch1[1];
                        } else {
                            const parts = embed.title.split(' - ');
                            if (parts.length > 1) {
                                const lastPart = parts[parts.length - 1];
                                if (lastPart.startsWith('TICKET-')) {
                                    ticketId = lastPart;
                                }
                            }
                        }
                        
                        if (!ticketId) {
                            await interaction.editReply({ content: '❌ Ticket ID bulunamadı! (Embed başlığı hatalı)' });
                            return;
                        }
                        
                        // Ticket modelini ticketId ile bul
                        const Ticket = require('../models/Ticket');
                        const ticket = await Ticket.findOne({ ticketId });
                        
                        if (!ticket) {
                            await interaction.editReply({ content: '❌ Ticket verisi bulunamadı!' });
                            return;
                        }
                        
                        // Ticket zaten çözülmüş mü kontrol et
                        if (ticket.status === 'çözüldü') {
                            await interaction.editReply({ content: '❌ Bu ticket zaten çözüldü olarak işaretlenmiş!' });
                            return;
                        }
                        
                        // Sadece ticket'ı atanan kişi çözebilir
                        if (ticket.assignedTo !== interaction.user.id) {
                            await interaction.editReply({ content: '❌ Bu butonu sadece ticket\'ı atanan yetkili kullanabilir!' });
                            return;
                        }
                        
                        // Ticket'ı çözüldü olarak işaretle
                        ticket.status = 'çözüldü';
                        ticket.resolvedAt = new Date();
                        ticket.resolvedBy = interaction.user.id;
                        await ticket.save();
                        
                        // Çözüldü mesajını gönder
                        const resolvedEmbed = new EmbedBuilder()
                            .setTitle('✅ Ticket Çözüldü')
                            .setDescription(`Bu ticket ${interaction.user} tarafından çözüldü olarak işaretlendi.\n\n**Ticket Detayları:**\n• **Ticket ID:** ${ticket.ticketId}\n• **Kullanıcı:** <@${ticket.userId}>\n• **Çözen:** <@${interaction.user.id}>\n• **Çözülme Tarihi:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                            .setColor(0x00FF00)
                            .setTimestamp()
                            .setFooter({ text: 'Ticket başarıyla çözüldü' });
                        
                        await interaction.channel.send({ embeds: [resolvedEmbed] });
                        
                        // Log mesajı gönder
                        const ticketManagerForResolve = new TicketManager(interaction.client);
                        await ticketManagerForResolve.sendLogMessage(interaction.guild, {
                            action: 'TICKET_RESOLVED',
                            ticketId: ticket.ticketId,
                            userId: ticket.userId,
                            resolvedBy: interaction.user.id
                        }, await ticketManagerForResolve.getGuildConfig(interaction.guild.id));
                        
                        await interaction.editReply({ content: `✅ Ticket #${ticket.ticketId} başarıyla çözüldü olarak işaretlendi!` });
                        
                    } catch (error) {
                        console.error('Çözme hatası:', error);
                        try {
                            await interaction.editReply({ content: '❌ Ticket çözülürken bir hata oluştu!' });
                        } catch (e) {
                            await interaction.followUp({ content: '❌ Ticket çözülürken bir hata oluştu!', ephemeral: true });
                        }
                    }
                    break;

                case 'reopen_ticket':
                    try {
                        // Hemen defer et
                        await interaction.deferReply({ ephemeral: true });
                        
                        // Önce interaction.message.embeds[0] ile embed bul
                        let embed = interaction.message && interaction.message.embeds && interaction.message.embeds[0] ? interaction.message.embeds[0] : null;
                        
                        // Eğer embed yoksa kanaldaki son 10 mesajı tara
                        if (!embed) {
                            const messages = await interaction.channel.messages.fetch({ limit: 10 });
                            const ticketMsg = messages.find(msg =>
                                msg.embeds.length > 0 &&
                                msg.embeds[0].title &&
                                msg.embeds[0].title.includes('Ticket')
                            );
                            if (ticketMsg) {
                                embed = ticketMsg.embeds[0];
                            }
                        }
                        
                        if (!embed) {
                            await interaction.editReply({ content: '❌ Ticket bilgisi bulunamadı! (Embed yok)' });
                            return;
                        }
                        
                        // Transkript embed'inin başlığından ticket ID'sini çıkar
                        let ticketId = null;
                        const ticketIdMatch1 = embed.title.match(/#([A-Za-z0-9\-]+)/);
                        if (ticketIdMatch1) {
                            ticketId = ticketIdMatch1[1];
                        } else {
                            const parts = embed.title.split(' - ');
                            if (parts.length > 1) {
                                const lastPart = parts[parts.length - 1];
                                if (lastPart.startsWith('TICKET-')) {
                                    ticketId = lastPart;
                                }
                            }
                        }
                        
                        if (!ticketId) {
                            await interaction.editReply({ content: '❌ Ticket ID bulunamadı! (Embed başlığı hatalı)' });
                            return;
                        }
                        
                        // Ticket modelini ticketId ile bul
                        const Ticket = require('../models/Ticket');
                        let ticket = await Ticket.findOne({ ticketId });
                        
                        if (!ticket) {
                            await interaction.editReply({ content: '❌ Ticket verisi bulunamadı!' });
                            return;
                        }
                        
                        // Yetkili kontrolü (support, admin, manage channels)
                        const ticketManagerForReopen = new TicketManager(interaction.client);
                        const guildConfigForReopen = await ticketManagerForReopen.getGuildConfig(interaction.guild.id);
                        const isSupport = interaction.member.roles.cache.has(guildConfigForReopen.supportRoleId);
                        const isAdmin = interaction.member.roles.cache.has(guildConfigForReopen.adminRoleId);
                        const isManager = interaction.member.permissions.has('ManageChannels');
                        
                        if (!isSupport && !isAdmin && !isManager) {
                            await interaction.editReply({ content: '❌ Bu butonu sadece yetkililer kullanabilir!' });
                            return;
                        }
                        
                        // Orijinal ticket kanal adını bul
                        let originalChannelName = `ticket-${ticket.ticketId}-reopen`;
                        // Eğer ticket.channelId hâlâ sunucuda varsa, onun adını kullan
                        const oldChannel = interaction.guild.channels.cache.get(ticket.channelId);
                        if (oldChannel) {
                            originalChannelName = `${oldChannel.name}-reopen`;
                        } else if (ticket.type && ticket.type.length > 0) {
                            // Eğer tip varsa, ticket-type-reopen gibi isimlendir
                            originalChannelName = `ticket-${ticket.type}-reopen`;
                        }
                        
                        // Yeni ticket kanalı oluştur
                        const incomingCategory = interaction.guild.channels.cache.find(c => c.name.includes('Gelen Ticketlar') && c.type === 4);
                        if (!incomingCategory) {
                            await interaction.editReply({ content: '❌ Gelen Ticketlar kategorisi bulunamadı!' });
                            return;
                    }

                        // Aynı ticket ID'si ile zaten bir kanal var mı kontrol et (sadece Gelen Ticketlar kategorisinde)
                        let existingChannel = null;
                        const channels = interaction.guild.channels.cache.filter(ch => 
                            ch.type === 0 && 
                            ch.parentId === incomingCategory.id &&
                            ch.name === originalChannelName
                        );
                        
                        if (channels.size > 0) {
                            // Mevcut kanalı kullan
                            existingChannel = channels.first();
                        }
                        
                        // Eğer Gelen Ticketlar'da kanal yoksa, TÜM KANALLARDA aynı ticket ID'sine sahip kanal ara
                        if (!existingChannel) {
                            // Önce transkript- ile başlayan kanalları ara (case-insensitive)
                            let transcriptChannels = interaction.guild.channels.cache.filter(ch => 
                                ch.type === 0 && 
                                ch.name.toLowerCase().startsWith('transkript-') &&
                                ch.name.toLowerCase().includes(ticket.ticketId.toLowerCase())
                            );
                            
                            // Eğer bulunamazsa, sadece ticket ID'sini ara (case-insensitive)
                            if (transcriptChannels.size === 0) {
                                transcriptChannels = interaction.guild.channels.cache.filter(ch => 
                                    ch.type === 0 && 
                                    ch.name.toLowerCase().includes(ticket.ticketId.toLowerCase()) &&
                                    ch.name.toLowerCase().includes('transkript')
                                );
                            }
                            
                            if (transcriptChannels.size > 0) {
                                // Transkript kanalını Gelen Ticketlar'a taşı
                                const transcriptChannel = transcriptChannels.first();
                                
                                await transcriptChannel.setParent(incomingCategory.id);
                                
                                // Kanal adını değiştir
                                const newName = originalChannelName;
                                await transcriptChannel.setName(newName);
                                
                                // İzinleri güncelle
                                await transcriptChannel.permissionOverwrites.set([
                                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                                    { id: ticket.userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                                    { id: guildConfigForReopen.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                                    { id: guildConfigForReopen.adminRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                                ]);
                                
                                existingChannel = transcriptChannel;
                            }
                        }
                        
                        let newChannel;
                        if (existingChannel) {
                            // Mevcut kanalı kullan
                            newChannel = existingChannel;
                        } else {
                            // Yeni kanal oluştur
                            newChannel = await interaction.guild.channels.create({
                                name: originalChannelName,
                                type: 0,
                                parent: incomingCategory.id,
                                permissionOverwrites: [
                                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                                    { id: ticket.userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                                    { id: guildConfigForReopen.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                                    { id: guildConfigForReopen.adminRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                                ]
                            });
                        }
                        
                        // Ticket kaydındaki channelId'yi ve status'u güncelle
                        ticket.channelId = newChannel.id;
                        ticket.status = 'açık';
                        ticket.closedAt = null;
                        ticket.closedBy = null;
                        await ticket.save();
                        
                        // Orijinal ticket embed'ını oluştur
                        const config = require('../config');
                        const ticketType = config.ticketTypes[ticket.type] || { name: ticket.type, emoji: '' };
                        const ticketEmbed = new EmbedBuilder()
                            .setTitle(existingChannel ? '🔄 Ticket Yeniden Açıldı (Mevcut Kanal)' : '🔄 Ticket Yeniden Açıldı')
                            .setDescription(`${ticketType.emoji || ''} Ticket yeniden açıldı! <@${ticket.userId}> tekrar çağrıldı.`)
                            .addFields(
                                { name: '👤 Kullanıcı', value: `<@${ticket.userId}>`, inline: true },
                                { name: '📋 Tip', value: ticketType.name, inline: true },
                                { name: '📅 Oluşturulma', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                                { name: '👨‍💼 Atanan Yetkili', value: ticket.assignedTo ? `<@${ticket.assignedTo}>` : 'Şu anda atama bekleniyor.', inline: true }
                            )
                            .setColor(0x36393F)
                            .setTimestamp();
                        
                        // Yönetim butonları (Kapat ve Başka Birine Aktar)
                        const managementButtons = new ActionRowBuilder()
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
                        
                        await newChannel.send({ content: `<@${ticket.userId}>`, embeds: [ticketEmbed], components: [managementButtons] });
                        
                        await interaction.editReply({ content: `✅ Ticket yeniden açıldı! <#${newChannel.id}>` });
                        
                    } catch (error) {
                        console.error('Yeniden açma hatası:', error);
                        
                        // Interaction hala geçerli mi kontrol et
                        try {
                            if (interaction.deferred) {
                                await interaction.editReply({ content: '❌ Ticket yeniden açılırken bir hata oluştu!' });
                            } else {
                                await interaction.reply({ content: '❌ Ticket yeniden açılırken bir hata oluştu!', ephemeral: true });
                            }
                        } catch (replyError) {
                            console.error('Yanıt gönderme hatası:', replyError);
                            if (replyError.code === 10062) {
                                try {
                                    const channel = interaction.channel;
                                    await channel.send({ content: '❌ Ticket yeniden açılırken bir hata oluştu! (Interaction süresi doldu)' });
                                } catch (sendError) {
                                    console.error('Mesaj gönderme hatası:', sendError);
                                }
                            }
                        }
                    }
                    break;
            }
        }

        // Modal etkileşimi işleme
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'assign_modal') {
                const userId = interaction.fields.getTextInputValue('user_id');
                const ticketManager = new TicketManager(interaction.client);

                try {
                    // Kullanıcı ID'sini temizle (@ işaretini kaldır)
                    const cleanUserId = userId.replace(/[<@!>]/g, '');
                    
                    // Kullanıcıyı bul
                    const targetUser = await interaction.client.users.fetch(cleanUserId);
                    
                    if (!targetUser) {
                        return interaction.reply({
                            content: '❌ Kullanıcı bulunamadı!',
                            ephemeral: true
                        });
                    }

                    const result = await ticketManager.assignTicket(interaction, targetUser);
                    await interaction.reply({
                        content: result.message,
                        ephemeral: true
                    });

                } catch (error) {
                    console.error('Atama hatası:', error);
                    await interaction.reply({
                        content: '❌ Geçersiz kullanıcı ID\'si! Lütfen doğru kullanıcı ID\'sini girin.',
                        ephemeral: true
                    });
                }
            }
            else if (interaction.customId === 'transfer_modal') {
                const userId = interaction.fields.getTextInputValue('transfer_user_id');
                const ticketManager = new TicketManager(interaction.client);

                try {
                    // Kullanıcı ID'sini temizle (@ işaretini kaldır)
                    const cleanUserId = userId.replace(/[<@!>]/g, '');
                    
                    // Kullanıcıyı bul
                    const targetUser = await interaction.client.users.fetch(cleanUserId);
                    
                    if (!targetUser) {
                        return interaction.reply({
                            content: '❌ Kullanıcı bulunamadı!',
                            ephemeral: true
                        });
                    }

                    const result = await ticketManager.assignTicket(interaction, targetUser);
                    await interaction.reply({
                        content: result.message,
                        ephemeral: true
                    });

                } catch (error) {
                    console.error('Transfer hatası:', error);
                    await interaction.reply({
                        content: '❌ Geçersiz kullanıcı ID\'si! Lütfen doğru kullanıcı ID\'sini girin.',
                        ephemeral: true
                    });
                }
            }
        }
    },
}; 