var Crawler = require("crawler");
import bunyan from 'bunyan';
const moduleName = 'ytcrawlernotify';
const Discord = require('discord.js');
const urllib = require("url");
var log = bunyan.createLogger({name: moduleName});
var window = new Map();
var discordClient;
var keyv;
var config;
var sessionOK = true;
var c;
var backendChannel;
var processLiveInfo = async ($,e) => {
    try {
        var item = $(e).parent().parent().parent().parent().parent();
        var title = $(item).find(".yt-lockup-title a.spf-link").text();
        var url = 'https://www.youtube.com'+ $(item).find(".yt-lockup-title a.spf-link").attr('href');
        var channel = $(item).find(".yt-lockup-byline a.spf-link").text();
        var meta = $(item).find("ul.yt-lockup-meta-info li").text().split(" ");
        if(meta){
            meta = meta[0] + "人正在观看"
        }
        var channelUrl = $(item).find(".yt-uix-sessionlink a.spf-link").attr('href')
        // var image = $(item).find(".yt-thumb-simple img").attr("src")
        //var result = urllib.parse(image);
        //image= result.protocol +"//"+ result.hostname + result.pathname
        var videoId;
        var m = url.match(/v=(.*)$/);
        if(m){
            videoId = m[1];
        }
        if(!videoId){
            log.error("cannot find videoId. sth. went wrong:"+item)
        }
        var image = `http://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        let shortUrl = `https://youtu.be/${videoId}`
        let videoKey = "notified#"+videoId;
        let notified = await keyv.get(videoKey)
        log.info(`${channel} LIVE now：${title} ${meta} videoId: ${videoId} url: ${shortUrl}`)
        if (!notified && discordClient && config.discordChannels){
            log.info(`First occurance. Report to discord.`)
            // sending msgs to all subscribed channels
            let msg
            try {
                msg = new Discord.RichEmbed()
                .setColor('#0099ff')
                .setAuthor(`${channel} 🔴 开始直播`,config.channelThumnail[channel])
                .setTitle(`${title}`)
                .setDescription(`:film_frames: ${shortUrl} @everyone\n目前${meta}`)
                .setURL(url)
                .setImage(image)
                .setThumbnail(config.channelThumnail[channel])
                .setTimestamp()
                .setFooter(channel+" @ YOUTUBE","https://lh3.googleusercontent.com/nXQvCaVfnPLJ3TZ6QO96fySPPjuEDDTcO-HA8gf9mwFWSsqCC0g0ZQuLpAqTNAxlt3evBLmP-A=w128-h128-e365")
    
            }catch {
                msg = `@everyone ${channel} 开始直播啦 不要忘记点赞，欢迎大家跟我聊天哦。`+"\n"+url;
            }

            //let
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
var scanForLive = () => { 
    if(sessionOK) {
        c.queue('https://www.youtube.com/feed/subscriptions');
    }
}
var newCrawler = (config) => {
    return new Crawler({
        maxConnections: 10,
        rateLimit: 1000,
        callback: async (error, res, done) =>{
            log.info("Start crawling feed subscription");
            if(error){
                console.log("爬虫出错啦："+error);
                backendChannel.send("@everyone 爬虫出错啦："+error);
            }else{
                var $ = res.$;
                try {
                    if ($("title").text().match(/Subscriptions/)){
                        // $(".badge-style-type-live-now").each( (_,e) => {
                        //     processLiveInfo($,e);
                        // })
                        $(".yt-badge-live").each( (_,e) => {
                            processLiveInfo($,e);
                        })
                    } else {
                        log.error(`Session cookie unavaliable title:$("title").text() expected Subscriptions` );
                        if(discordClient){
                            backendChannel.send("@everyone 大事不好啦，youtube的爬虫出问题了，爬到页面"+$("title").text());
                            // todo: using conversation to update session
                        }
                        //sessionOK = false; // restore until restart
                    }
                } catch (err){
                    log.error(err);
                }
            }
            await done();
            log.info("Crawling youtube Done");
        }
    });
}
var init = () => {
    c = newCrawler(config);
    c.on('schedule',function(options){
        options.headers = {  
            cookie: config.cookie
        };
    });
    const [guildName,channelName]  = config.backendChannel.split('#');
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
        scanForLive();
        setInterval(scanForLive, settings.interval);
    }
};
module.exports = task;