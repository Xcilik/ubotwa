const { WAConnection } = require('@adiwajshing/baileys');
const { MessageType } = require('@adiwajshing/baileys/lib/Constants');
const { readdirSync, existsSync, writeFileSync } = require('fs');
const { join } = require('path');
const { Collection } = require('@discordjs/collection');

// Utils
const { sleep } = require('./util/time.js');
const { prefix, groupWhiteList } = require('./util/config.js');
const { pesan } = require('./util/pesan.js');
const { color } = require('./util/functions.js');

async function automaticStatus() {
    const wa = new WAConnection();
    wa.cmd = new Collection();

    // Create sessions file
    if (existsSync('./sessions-krypton.json')) {
        await wa.loadAuthInfo('./sessions-krypton.json');
        await wa.connect();
    } else {
        await wa.connect();
        await writeFileSync('./sessions-krypton.json', JSON.stringify(wa.base64EncodedAuthInfo(), null, '\t'));
    }

    /*
     * Import all commands
     */
    const commandFiles = readdirSync(join(__dirname, 'command')).filter((file) => file.endsWith('.js'));
    for (const file of commandFiles) {
        // eslint-disable-next-line global-require
        const command = require(join(__dirname, 'command', `${file}`));
        wa.cmd.set(command.name, command);
    }

    // Handler message
    wa.on('chat-update', async (chat) => {
        try {
            // Don't run if not match this requirement
            if (!chat.hasNewMessage) return;

            // Initial change data
            chat = chat.messages.all()[0];

            if (!chat.message) return;
            if (chat.key.remoteJid === 'status@broadcast') return;

            // Data for bot running

            // Type message
            const type = Object.keys(chat.message)[0];
            // Body message
            wa.body = type === 'conversation' ? chat.message.conversation : (type === 'imageMessage') ? chat.message.imageMessage.caption : (type === 'videoMessage') ? chat.message.videoMessage.caption : (type === 'extendedTextMessage') ? chat.message.extendedTextMessage.text : '';
            // Command message detections
            const isCmd = wa.body.startsWith(prefix);
            // Argument command regex
            const args = wa.body.trim().split(/ +/).slice(1);
            // Command name detections
            const commandName = wa.body.slice(1).trim().split(/ +/).shift().toLowerCase();
            // Check content message
            const content = JSON.stringify(chat.message);
            // Id from message
            wa.from = chat.key.remoteJid;
            // Check is group or not
            wa.isGroup = wa.from.endsWith('@g.us');
            // Metadata group
            const groupMetadata = wa.isGroup ? await wa.groupMetadata(wa.from) : '';
            // Get Id user from sender
            wa.sender = wa.isGroup ? chat.participant : chat.key.remoteJid;
            // Get group Id
            wa.groupId = wa.isGroup ? groupMetadata.id : '';

            /*
             * Only user or self user/bot and user command
             * This is userbot
             * And allow Group on whitelist
             *
             * If you want all group or user allow to use command
             * Remove this line
             */
            if (wa.isGroup) {
                if (!chat.key.fromMe && !groupWhiteList.includes(wa.groupId)) return;
            } else {
                if (!chat.key.fromMe) return;
            }

            // Multimedia Detection
            wa.isMedia = (type === 'imageMessage' || type === 'videoMessage');
            wa.isQuotedImage = type === 'extendedTextMessage' && content.includes('imageMessage');
            wa.isQuotedVideo = type === 'extendedTextMessage' && content.includes('videoMessage');
            wa.isQuotedSticker = type === 'extendedTextMessage' && content.includes('stickerMessage');
            // wa.quotedId = type === 'extendedTextMessage' ? chat.message.extendedTextMessage.contextInfo.participant : ''
            // wa.mentioned = type === 'extendedTextMessage' ? chat.message.extendedTextMessage.contextInfo.mentionedJid : ''

            // Id self/user
            const user = wa.user.jid;

            // Validations message/command will execute or not
            if (!isCmd) return;
            const command = wa.cmd.get(commandName) || wa.cmd.find((cmd) => cmd.aliases && cmd.aliases.includes(commandName));
            if (!command) return;

            // Execution command
            command.execute(wa, chat, pesan, args);
        } catch (error) {
            console.log('[INFO] : %s', color(error, 'red'));
            wa.sendMessage(wa.from, 'Telah terjadi error setelah menggunakan command ini.', MessageType.text);
        }
    });

    // while(true) {
    //     const date = new Date()
    //     const time = date.getHours()
    //     if (time = 3) {
    //         const respon = await wa.sendMessage('status@broadcast', storyMessage, MessageType.text)
    //         if (!storyId == "") {
    //             await wa.deleteMessage('status@broadcast', {id: storyId, remoteJid: 'status@broadcast', fromMe: true})
    //         }
    //         storyId = respon.key.id
    //     }
    //     await sleep(360000)
    // }
}

// Run main code
automaticStatus().catch(err => console.error('Unexpected error: ' + err));
