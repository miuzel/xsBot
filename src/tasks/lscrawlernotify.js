import bunyan from 'bunyan';
var Crawler = require("crawler");
const Discord = require('discord.js');
const moduleName = 'lscrawlernotify';
const fetch = require('node-fetch');
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
                let msg = new Discord.MessageEmbed()
                .setColor('#0099ff')
                .setTitle(data.stream_title ? data.stream_title : "livestream直播")
                .setDescription(`@everyone ${config.title} ${x.owner.full_name} 开始直播啦，赶快抢沙发去。\n 链接： ${url}`)
                .setImage(data.secure_thumbnail_url)
                .setThumbnail(x.logo.secure_medium_url)

                for (var discordChannel of config.discordChannels){
                    const [guildName,channelName]  = discordChannel.split('#');
                    let channel = discordClient
                    .guilds.find(guild => guild.name === guildName)
                    .channels.find(ch => ch.name === channelName)
                    channel.send(msg);
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
            }
            await done();
            log.info("Crawling livestream Done");
        }
    });
}
var init = () => {
    c = newCrawler(config);
    backendChannel = discordClient
    .guilds.find(guild => guild.name === "mxtest")
    .channels.find(ch => ch.name === "常规")
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