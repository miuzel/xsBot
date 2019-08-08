var Crawler = require("crawler");
import bunyan from 'bunyan';
const moduleName = 'lscrawlernotify';
var log = bunyan.createLogger({name: moduleName});
var window = new Map();
var discordClient;
var keyv;
var config;
var c;
var backendChannel;
var processLiveInfo = async ($,e) => {
    try {
        var item = $(e).parent()
        var url = $(item).attr('href');
        var videoId = $(item).parent().find(".icon_posts").text().trim();
        if(!videoId){
            log.error("cannot find videoId. sth. went wrong:"+item)
        }
        let videoKey = "notified#liveStream#"+videoId;
        let notified = await keyv.get(videoKey)
        log.info(`Rolfoundation LIVE now videoId: ${videoId} url: ${url}`)
        if (!notified && discordClient && config.discordChannels){
            log.info(`First occurance. Report to discord.`)
            // sending msgs to all subscribed channels
            let msg = `@everyone 郭媒体开始直播啦，抢沙发了。`+"\n"+url;
            for (var discordChannel of config.discordChannels){
                const [guildName,channelName]  = discordChannel.split('#');
                let channel = discordClient
                .guilds.find(guild => guild.name === guildName)
                .channels.find(ch => ch.name === channelName)
                channel.send(msg);
            }
            await keyv.set(videoKey,true)
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
        callback: async (error, res, done) =>{
            log.info("Start crawling livestream");
            if(error){
                console.log("livestream爬虫出错啦："+error);
                backendChannel.send("@everyone livestream爬虫出错啦："+error);
            }else{
                var $ = res.$;
                try {
                    let pattern = new RegExp(config.title)
                    if ($("title").text().match(pattern)){
                        log.info("Title match.");
                        $(".is_live").each( (_,e) => {
                            processLiveInfo($,e);
                        })
                    } else {
                        log.error(`Crawl failed` );
                        if(discordClient){
                            backendChannel.send("@everyone 大事不好啦，livestream的爬虫出问题了，爬到页面"+$("title").text());
                            // todo: using conversation to update session
                        }
                        //sessionOK = false; // restore until restart
                    }
                } catch (err){
                    log.error(err);
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