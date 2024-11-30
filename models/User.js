const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
});

// Middleware для удаления связанных записей (промежуточное ПО) - это функции, которые выполняются между запросом клиента и отправкой ответа сервером. 
userSchema.pre('findOneAndDelete', async function (next) {
    const userId = this.getQuery()._id;

    try {
        // Удаление связанных пропусков
        await mongoose.model('Pass').deleteMany({ userId });

        // Удаление связанных логов
        await mongoose.model('Log').deleteMany({ userId });

        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('User', userSchema);
