const mongoose = require('mongoose');

const guildConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    ticketCategoryId: { type: String, required: true },
    closedCategoryId: { type: String, required: true },
    incomingCategoryId: { type: String },
    logChannelId: { type: String, required: true },
    supportRoleId: { type: String, required: true },
    adminRoleId: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now }
});

guildConfigSchema.statics.getConfig = async function(guildId) {
    return this.findOne({ guildId });
};

guildConfigSchema.statics.setConfig = async function(guildId, data) {
    return this.findOneAndUpdate(
        { guildId },
        { ...data, guildId, updatedAt: new Date() },
        { upsert: true, new: true }
    );
};

module.exports = mongoose.model('GuildConfig', guildConfigSchema); 