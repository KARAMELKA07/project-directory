const express = require('express'); //Фреймворк для создания веб-приложений
const mongoose = require('mongoose'); //Модуль для обработки данных из форм
const bodyParser = require('body-parser');

const User = require('./models/User');
const Pass = require('./models/Pass');
const Log = require('./models/Log');


const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Подключение к MongoDB
const MONGO_URI = 'mongodb://192.168.198.219:27017/passSystem';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err));

// Главная страница
app.get('/', (req, res) => {
    res.render('index');
});

// Страница управления пользователями
app.get('/users', async (req, res) => {
    const users = await User.find();
    res.render('user', { users });
});

app.post('/users', async (req, res) => {
    await User.create(req.body);
    res.redirect('/users');
});

app.post('/users/edit/:id', async (req, res) => {
    await User.findByIdAndUpdate(req.params.id, req.body);
    res.redirect('/users');
});

// Удаление пользователя
app.post('/users/delete/:id', async (req, res) => {
    try {
        await User.findOneAndDelete({ _id: req.params.id });
        res.redirect('/users'); // Перенаправление на список пользователей
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка при удалении пользователя');
    }
});


// Страница управления пропусками
app.get('/passes', async (req, res) => {
    try {
        const users = await User.find(); // Получаем всех пользователей
        const passes = await Pass.find().populate('userId'); // Получаем все пропуска и заполняем данные пользователей
        
        res.render('passes', { 
            users, 
            passes,
            errorMessage: null // Передаем пустое сообщение об ошибке по умолчанию
        });
    } catch (error) {
        console.error('Ошибка при получении данных:', error);
        res.status(500).send('Ошибка при получении данных');
    }
});


app.post('/passes', async (req, res) => {
    const { userId, type, startDate, endDate } = req.body;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Проверка на корректность даты
    if (isNaN(start) || isNaN(end)) {
        return res.render('passes', { 
            users: await User.find(), 
            passes: await Pass.find().populate('userId'),
            errorMessage: 'Пожалуйста, введите корректные даты' 
        });
    }

    // Проверка на корректность интервала
    if (end < start) {
        return res.render('passes', { 
            users: await User.find(), 
            passes: await Pass.find().populate('userId'),
            errorMessage: 'Дата окончания не может быть раньше даты начала' 
        });
    }

    try {
        // Создание нового пропуска
        const newPass = new Pass({
            userId,
            type,
            startDate: start,
            endDate: end,
        });

        await newPass.save();
        res.redirect('/passes'); // Перенаправление на страницу пропусков
    } catch (error) {
        console.error('Ошибка при добавлении пропуска:', error);
        res.status(500).send('Ошибка при добавлении пропуска');
    }
});





app.post('/passes/edit/:id', async (req, res) => {
    const passId = req.params.id;
    const { type, startDate, endDate } = req.body;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Если даты некорректны
    if (isNaN(start) || isNaN(end)) {
        return res.render('passes', { 
            users, 
            errorMessage: 'Пожалуйста, введите корректные даты' 
        });
    }

    // Проверка на то, что дата окончания не может быть раньше даты начала
    if (end < start) {
        return res.render('passes', { 
            users, 
            errorMessage: 'Дата окончания не может быть раньше даты начала' 
        });
    }

    try {
        const pass = await Pass.findById(passId);
        if (!pass) {
            return res.status(404).send('Пропуск не найден');
        }

        pass.type = type;
        pass.startDate = start;
        pass.endDate = end;

        await pass.save();

        res.redirect('/passes');
    } catch (error) {
        console.error('Ошибка при редактировании пропуска:', error);
        res.status(500).send('Ошибка при редактировании пропуска');
    }
});




app.post('/passes/delete/:id', async (req, res) => {
    try {
        const passId = req.params.id;

        // Удалить все логи с этим passId
        await Log.deleteMany({ passId: passId });

        // Удалить пропуск по ID
        const pass = await Pass.findByIdAndDelete(passId);
        if (!pass) {
            return res.status(404).send('Пропуск не найден');
        }

        res.redirect('/passes');
    } catch (error) {
        console.error('Ошибка при удалении пропуска:', error);
        res.status(500).send('Ошибка при удалении пропуска');
    }
});



app.get('/logs', async (req, res) => {
    const { userId, action, startDate, endDate } = req.query;

    try {
        // Фильтрация
        const filter = {};
        if (userId) filter.userId = userId;
        if (action) filter.action = action;
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) filter.timestamp.$gte = new Date(startDate);
            if (endDate) filter.timestamp.$lte = new Date(endDate);
        }

        // Загрузка логов с пользователями и пропусками
        const logs = await Log.find(filter).populate('userId').populate('passId');

        // Загрузка всех пропусков для формы
        const passes = await Pass.find().populate('userId');

        // Загрузка всех пользователей для фильтрации
        const users = await User.find();

        res.render('log', { logs, passes, users }); // Передача пользователей в шаблон
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка при загрузке логов');
    }
});



// Добавление нового лога
app.post('/logs/add', async (req, res) => {
    const { passId, action } = req.body;

    try {
        // Ищем пропуск по passId
        const pass = await Pass.findById(passId);

        // Проверяем, не просрочен ли пропуск
        const currentDate = new Date();
        if (new Date(pass.endDate) < currentDate) {
            return res.status(400).send('Пропуск просрочен. Лог не может быть добавлен.');
        }

        // Добавление лога
        const newLog = new Log({
            userId: pass.userId,  // Устанавливаем ID пользователя из пропуска
            passId: pass._id,     // Привязываем лог к пропуску
            action: action,
            timestamp: currentDate,
        });

        await newLog.save();
        res.redirect('/logs'); // Перенаправляем обратно на страницу логов
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка при добавлении лога');
    }
});

// Отчёты
app.get('/reports', async (req, res) => {
    try {
        // Получаем список пользователей из базы данных
        const users = await User.find(); // или используйте свою модель для поиска пользователей

        // Выборка отчетных данных с применением агрегации
        const data = await User.aggregate([
            {
                $lookup: {
                    from: 'passes',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'passes',
                },
            },
            {
                $lookup: {
                    from: 'logs',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'logs',
                },
            },
        ]);

        // Отправка данных в шаблон report.ejs
        res.render('report', { data, users });
    } catch (error) {
        console.error("Ошибка при получении данных:", error);
        res.status(500).send('Ошибка при загрузке отчетов');
    }
});


app.get('/reports/export-txt', async (req, res) => {
    try {
        const data = await User.aggregate([
            {
                $lookup: {
                    from: 'passes',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'passes',
                },
            },
            {
                $lookup: {
                    from: 'logs',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'logs',
                },
            },
        ]);

        // Генерация текстового отчета
        let report = 'Отчет о пользователях:\n\n';

        data.forEach(user => {
            report += `Имя: ${user.name}\n`;
            report += `Email: ${user.email}\n`;
            report += `Пропуски:\n`;
            user.passes.forEach(p => {
                report += `  - ${p.type}: ${p.startDate.toISOString().split('T')[0]} - ${p.endDate.toISOString().split('T')[0]}\n`;
            });
            report += `Логи:\n`;
            user.logs.forEach(l => {
                report += `  - ${l.action}: ${l.timestamp.toISOString()}\n`;
            });
            report += '\n';
        });

        // Установка заголовков для загрузки
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', 'attachment; filename=report.txt');
        res.send(report);
    } catch (error) {
        console.error('Ошибка при экспорте отчета в TXT:', error);
        res.status(500).send('Ошибка при экспорте отчета.');
    }
});




// Запуск сервера
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
