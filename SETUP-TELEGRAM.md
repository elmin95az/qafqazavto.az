# Подключение формы заявки к Telegram-группе

Форма на сайте (`#booking-form`) отправляет данные не напрямую в Telegram
(так токен бота был бы виден любому в исходном коде страницы), а через
маленький прокси-сервер — Cloudflare Worker (`worker/telegram-proxy.js`).
Он хранит токен в секрете и пересылает сообщение в группу.

## 1. Узнайте chat_id вашей группы

1. Добавьте вашего бота в нужную Telegram-группу (как обычного участника).
2. Отправьте в группе любое сообщение (например «привет»).
3. Откройте в браузере (замените `<ТОКЕН>` на токен бота):
   `https://api.telegram.org/bot<ТОКЕН>/getUpdates`
4. В JSON-ответе найдите `"chat":{"id": -1001234567890, ...}` —
   это и есть `chat_id`. У групп он отрицательный.

## 2. Установите Wrangler (CLI для Cloudflare Workers)

```bash
npm install -g wrangler
wrangler login
```

Откроется браузер — войдите в аккаунт Cloudflare (или зарегистрируйте
бесплатный на cloudflare.com, если его ещё нет).

## 3. Разверните воркер

```bash
cd worker
wrangler deploy
```

После этого Wrangler покажет адрес воркера, например:
`https://qafqaz-avto-booking.ваш-логин.workers.dev`

## 4. Задайте секреты (токен и chat_id) — НЕ в коде

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
```
Вставьте токен бота, когда попросит, и нажмите Enter.

```bash
wrangler secret put TELEGRAM_CHAT_ID
```
Вставьте `chat_id` группы из шага 1.

Секреты хранятся у Cloudflare, а не в репозитории — токен нигде в
файлах проекта не фигурирует.

## 5. Подключите адрес воркера к сайту

Откройте `js/main.js`, в самом начале файла замените:

```js
var BOOKING_ENDPOINT = 'https://qafqaz-avto-booking.YOUR-SUBDOMAIN.workers.dev';
```

на реальный адрес из шага 3.

## 6. Проверьте

Откройте сайт, заполните и отправьте форму — сообщение должно прийти
в Telegram-группу в течение секунды.

---

### Если позже сайт переедет на домен qafqazavto.az

В `worker/wrangler.toml` раскомментируйте и укажите:

```toml
[vars]
ALLOWED_ORIGIN = "https://qafqazavto.az"
```

и выполните `wrangler deploy` ещё раз — так форму нельзя будет
дёргать с чужих сайтов (CORS-ограничение по домену).
