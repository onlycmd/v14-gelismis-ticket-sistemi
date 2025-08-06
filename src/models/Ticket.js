const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    ticketId: {
        type: String,
        required: true,
        unique: true
    },
    channelId: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: String,
        required: true
    },
    assignedTo: {
        type: String,
        default: null
    },
    type: {
        type: String,
        required: true,
        enum: ['satın-alma', 'şikayet', 'teknik-destek', 'genel-soru']
    },
    status: {
        type: String,
        required: true,
        enum: ['açık', 'kapalı', 'çözüldü'],
        default: 'açık'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    closedAt: {
        type: Date,
        default: null
    },
    closedBy: {
        type: String,
        default: null
    },
    resolvedAt: {
        type: Date,
        default: null
    },
    resolvedBy: {
        type: String,
        default: null
    },
    messages: [{
        userId: String,
        username: String,
        content: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null
    },
    feedback: {
        type: String,
        default: null
    }
});

// İndeksler
ticketSchema.index({ userId: 1, status: 1 });
ticketSchema.index({ assignedTo: 1 });
ticketSchema.index({ createdAt: -1 });

// Virtual fields
ticketSchema.virtual('duration').get(function() {
    if (this.closedAt) {
        return this.closedAt - this.createdAt;
    }
    return Date.now() - this.createdAt;
});

// Statik metodlar
ticketSchema.statics.getOpenTicketsByUser = function(userId) {
    return this.find({ userId, status: 'açık' });
};

ticketSchema.statics.getTicketsByAssignee = function(assigneeId) {
    return this.find({ assignedTo: assigneeId });
};

ticketSchema.statics.getTicketStats = function() {
    return this.aggregate([
        {
            $group: {
                _id: null,
                totalTickets: { $sum: 1 },
                openTickets: {
                    $sum: { $cond: [{ $eq: ['$status', 'açık'] }, 1, 0] }
                },
                closedTickets: {
                    $sum: { $cond: [{ $eq: ['$status', 'kapalı'] }, 1, 0] }
                },
                resolvedTickets: {
                    $sum: { $cond: [{ $eq: ['$status', 'çözüldü'] }, 1, 0] }
                }
            }
        }
    ]);
};

module.exports = mongoose.model('Ticket', ticketSchema); 