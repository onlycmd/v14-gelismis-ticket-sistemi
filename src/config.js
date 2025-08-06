require('dotenv').config({ path: './config.env' });

module.exports = {
    // Bot Ayarları
    token: process.env.BOT_TOKEN,
    clientId: process.env.CLIENT_ID,
    prefix: process.env.PREFIX || '.',
    ownerId: process.env.OWNER_ID,

    // MongoDB
    mongoUri: process.env.MONGODB_URI,

    // Ticket Ayarları
    ticketCategoryId: process.env.TICKET_CATEGORY_ID,
    closedTicketCategoryId: process.env.CLOSED_TICKET_CATEGORY_ID,
    incomingCategoryId: process.env.INCOMING_CATEGORY_ID,
    logChannelId: process.env.LOG_CHANNEL_ID,
    supportRoleId: process.env.SUPPORT_ROLE_ID,
    adminRoleId: process.env.ADMIN_ROLE_ID,

    // Güvenlik
    maxTicketsPerUser: parseInt(process.env.MAX_TICKETS_PER_USER) || 1,
    ticketCooldown: parseInt(process.env.TICKET_COOLDOWN) || 30000,

    // Ticket Tipleri
    ticketTypes: {
        'satın-alma': {
            name: 'Satın Alma Desteği',
            description: 'Satın alma ile ilgili sorunlarınız için',
            emoji: '🛒',
            color: 0x36393F
        },
        'şikayet': {
            name: 'Şikayet',
            description: 'Şikayet ve geri bildirimleriniz için',
            emoji: '⚠️',
            color: 0x36393F
        },
        'teknik-destek': {
            name: 'Teknik Destek',
            description: 'Teknik sorunlarınız için',
            emoji: '🔧',
            color: 0x36393F
        },
        'genel-soru': {
            name: 'Genel Soru',
            description: 'Genel sorularınız için',
            emoji: '❓',
            color: 0x36393F
        }
    },

    // Ön Tanımlı Mesajlar
    welcomeMessages: {
        'satın-alma': 'Merhaba! Satın alma desteği için ticket\'ınız açıldı. Lütfen sipariş numaranızı ve sorununuzu detaylı bir şekilde açıklayın.',
        'şikayet': 'Merhaba! Şikayetiniz için ticket\'ınız açıldı. Lütfen şikayetinizi detaylı bir şekilde açıklayın.',
        'teknik-destek': 'Merhaba! Teknik destek için ticket\'ınız açıldı. Lütfen yaşadığınız teknik sorunu detaylı bir şekilde açıklayın.',
        'genel-soru': 'Merhaba! Genel sorunuz için ticket\'ınız açıldı. Lütfen sorunuzu detaylı bir şekilde açıklayın.'
    }
}; 