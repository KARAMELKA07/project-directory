const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: ['вход', 'выход'], required: true },
    timestamp: { type: Date, default: Date.now },
    passId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pass', required: true },  // Добавляем ссылку на пропуск
});

const Log = mongoose.model('Log', logSchema);

module.exports = Log;
