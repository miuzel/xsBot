import notifier from 'mail-notifier';
import bunyan from 'bunyan';
const moduleName = 'ytmailnotify';
var log = bunyan.createLogger({name: moduleName});
var discordClient;
var discordChannels;
var keyv;
var processMail = async mail => {
    if (mail.from.length == 0 || mail.from[0].address !== 'noreply@youtube.com') {
        log.info(`non-youtube mail received. ${mail.subject}`)
        return
    }
    log.info(`received mail ${mail.subject}`)
    var url = mail.text.match(/(http:\/\/www\.youtube\.com\/watch\?v=)([^\&\\\s]+)/);
    if (url) {
        let videoId = url[2];
        let videoKey = "notified#"+videoId;
        let notified = await keyv.get(videoKey)
        if (!notified && discordClient && discordChannels){
            let msg = `@everyone ${mail.subject} 不要忘记点赞哦。 ${url[1]}${videoId}`;
            for (var discordChannel of discordChannels){
                log.info('This video\'s ID is %s.', videoId);
                const [guildName,channelName]  = discordChannel.split('#');
                let channel = discordClient
                .guilds.find(guild => guild.name === guildName)
                .channels.find(ch => ch.name === channelName)
                channel.send(msg);
            }
            await keyv.set(videoKey,true)
        }
    }
}

var task = {
    name: moduleName,
    start: (settings,discord,kv) => {
        const imap = {
            user: settings.email,
            password: settings.password,
            host: settings.imapserver,
            port: 993, // imap port
            tls: true,// use secure connection
            tlsOptions: { rejectUnauthorized: false }
        };
        keyv = kv;
        discordChannels = settings.discordChannels;
        discordClient = discord;
        notifier(imap)
            .on('mail', processMail)
            .start();
    }
};
module.exports = task;