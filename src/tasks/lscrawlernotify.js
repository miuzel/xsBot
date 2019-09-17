import bunyan from 'bunyan';
var Crawler = require("crawler");
const Discord = require('discord.js');
const moduleName = 'lscrawlernotify';
const fetch = require('node-fetch');
const moment = require('moment');
var log = bunyan.createLogger({name: moduleName});
var window = new Map();
var discordClient;
var keyv;
var config;
var c;
var backendChannel;
var processLiveInfo = async (x) => {
    console.log("find new broadcast")

    try {
        var url =  `https://livestream.com/accounts/${x.owner.id}/events/${x.id}`;
        var videoId = x.broadcast_id;
        if(!videoId){
            log.error("cannot find videoId. sth. went wrong:"+item)
        }
        let videoKey = "notified#liveStream#"+videoId;
        let notified = await keyv.get(videoKey)
        log.info(`Livestream LIVE now videoId: ${videoId} url: ${url}`)
        if (!notified && discordClient && config.discordChannels){
            log.info(`First occurance. Report to discord.`)
            // sending msgs to all subscribed channels
            let playerApi = `https://player-api.new.livestream.com/accounts/${x.owner.id}/events/${x.id}/stream_info`
            log.info("fetching stream info from " + playerApi)
            fetch(playerApi)
            .then(res => res.json())
            .then(data => {
                let streamAt = moment(data.live_video_post.streamed_at).locale(config.locale).from()
                let msg = `@everyone ${config.title} 开始直播啦，赶快去抢沙发吧。`
                let msgEmbed = new Discord.RichEmbed()
                .setColor('#0099ff')
                .setAuthor(data.stream_title ? data.stream_title +" 🔴 直播中" : "livestream直播 🔴 直播中","https://img.new.livestream.com/accounts/00000000019f9561/c135cdc2-fecb-4630-adf6-ac97bf6e126b_170x170.png")
                .setDescription(`[【${config.title}】](${url}) ${streamAt} 开始直播啦\n${url}`)
                .setTitle(data.live_video_post.caption)
                .setURL(url)
                .setImage(data.secure_thumbnail_url)
                .setThumbnail(x.logo.secure_medium_url)
                .setTimestamp()
                .setFooter(x.owner.full_name+" @ Livestream - Vimeo","https://cdn.iconscout.com/icon/free/png-256/livestream-283158.png")


                for (var discordChannel of config.discordChannels){
                    let [guildName,channelName]  = discordChannel.split('#');
                    let channel = discordClient
                    .guilds.find(guild => guild.name === guildName)
                    .channels.find(ch => ch.name === channelName)
                    channel.send(msg,{
                        embed: msgEmbed
                    });
                    log.info(`Msg ${msg} sent to ${discordChannel}`)
                }           
            }).then(() => {
                keyv.set(videoKey,true)
            }).catch((e) => {
                log.error(e)
            })
            
        }
    }catch(err){
        log.error(err)
    }
}
var scanForLive = (config) => { 
    c.queue(config.url);
}
var newCrawler = (config) => {
    return new Crawler({
        maxConnections: 10,
        rateLimit: 1000,
        encoding:null,
        jQuery:false,// set false to suppress warning message.
        callback: async (error, res, done) =>{
            log.info("Start crawling livestream");
            
            if(error){
                console.log("livestream爬虫出错啦："+error);
                backendChannel.send("@everyone livestream爬虫出错啦："+error);
            }else{
                try {
                    let resJson = JSON.parse(res.body);
                    if (resJson.data){
                        resJson.data.map(
                            x => {
                                if (x.broadcast_id !== -1){
                                    processLiveInfo(x)
                                } 
                                return x
                            }
                        )
                    } else {
                        log.error(`livestream api data failed data:\n${res.body}` );
                        if(discordClient){
                            backendChannel.send("@everyone 大事不好啦，livestream的爬虫出问题了")
                        }
                    }
                } catch (err) {
                    log.error(err)
                }
            }
            await done();
            log.info("Crawling livestream Done");
        }
    });
}
var init = () => {
    c = newCrawler(config);
    let [guildName,channelName]  = config.backendChannel.split('#');
    backendChannel = discordClient
    .guilds.find(guild => guild.name === guildName)
    .channels.find(ch => ch.name === channelName)
}

var task = {
    name: moduleName,
    start: (settings,discord,kv) => {
        config = settings;
        keyv = kv;
        discordClient = discord;
        init()
        scanForLive(config);
        setInterval(() => scanForLive(config), settings.interval);
    }
};
module.exports = task;