import notifier from 'mail-notifier';
import bunyan from 'bunyan';
import moment from 'moment';
const moduleName = 'ytmailnotify';
var log = bunyan.createLogger({name: moduleName});
const Discord = require('discord.js');
var discordClient;
var discordChannels;
var keyv;
var config;
var lastNotified = 0;
var processMail = async mail => {
    if (mail.from.length == 0 || mail.from[0].address !== 'noreply@youtube.com') {
        log.info(`non-youtube mail received. ${mail.subject} ${mail.date}`)
        return
    }
    log.info(`received mail ${mail.subject} ${mail.date}`)
    //var url = mail.html.match(/(http:\/\/www\.youtube\.com\/watch\?v=)([^\&\\\s]+)/)
    var m = mail.text.match(/\/watch%3Fv%3D([^%]+)%26/)
    if (m) {
        let videoId = m[1];
        let url = 'https://www.youtube.com/watch?v=' + videoId
        let shortUrl = 'https://youtu.be/'+videoId
        let videoKey = "notified#"+videoId;
        let notified = await keyv.get(videoKey)
        if (moment().subtract(600,'seconds') > moment(mail.date)){
            log.warn("mail date too old. ignore.")
        } else if (!notified && discordClient && discordChannels){
            let timenow = new Date().getTime()
            let image = `http://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            let channel
            let isLive = mail.subject.match(/^🔴/)
            for(let channelName in config.channelThumnail){
                const p1 = new RegExp( `^${channelName}`)
                const p2 = new RegExp( `“${channelName}”`)
                if(mail.subject.match(p1) || mail.subject.match(p2)){
                    channel = channelName
                }
            }
            let msgEmbed
            let now = new Date()
            let greeting = now - lastNotified > 5000 && config.notifyChannels.indexOf(channel) >= 0  ? "@everyone" : "大家好"
            let msg = `${greeting} ${channel} ${(isLive? " 开始直播啦，":" 上传了新的视频，")}不要忘记点赞哦`
            let title = mail.html.match(/video-title-font-class[^>]+>([^<]*)</) 
            title = title ? title[1]: ""
            try {
                msgEmbed = new Discord.RichEmbed()
                .setColor('#0099ff')
                .setAuthor(`${channel}` +(isLive? " 🔴 直播中 ":" 上传了")  ,config.channelThumnail[channel])
                .setTitle(title)
                .setDescription(`:film_frames: ${shortUrl}`)
                .setURL(url)
                .setImage(image)
                .setThumbnail(config.channelThumnail[channel])
                .setTimestamp()
                .setFooter(channel+" @ YOUTUBE","https://lh3.googleusercontent.com/nXQvCaVfnPLJ3TZ6QO96fySPPjuEDDTcO-HA8gf9mwFWSsqCC0g0ZQuLpAqTNAxlt3evBLmP-A=w128-h128-e365")
    
            }catch(err) {
                log.error(err)
                msg = msg + "\n"+ `${url[1]}${videoId}`;
            }
            lastNotified = now

            for (var discordChannel of discordChannels){
                log.info('This video\'s ID is %s.', videoId);
                const [guildName,channelName]  = discordChannel.split('#');
                let channel = discordClient
                .guilds.find(guild => guild.name === guildName)
                .channels.find(ch => ch.name === channelName)
                channel.send(msg,{
                    embed: msgEmbed
                });
            }
            await keyv.set(videoKey,timenow)
        }
    } else {
        console.log(mail.text)
    }
}
var n
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
        config = settings
        keyv = kv;
        discordChannels = settings.discordChannels;
        discordClient = discord;
        n = notifier(imap)
        .on('connected', () => {
            log.info("server connected");
        })
        .on('mail', processMail)
        .on('error', (err) => {
            log.error(err);
            if(err.message && err.message === "read ECONNRESET"){
                log.info("restarting...");
                n.stop();
            }
        })
        .on('end', () => {
            log.info("restarting...");
            n.start();
        }) // session closed
        n.start();
    }
};
module.exports = task;