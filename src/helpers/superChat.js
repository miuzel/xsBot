const bunyan = require('bunyan');
var Crawler = require("crawler");
const moment = require('moment');
var log = bunyan.createLogger({name: "superChat"});

var processLiveChat = async (error, res, done) =>{
    log.info("Start crawling feed subscription");
    if (error) {
        console.log("爬虫出错啦："+error);
        backendChannel.send("@everyone 爬虫出错啦："+error);
    } else {
        var $ = res.$;
        try {
            if ($("title").text().match(/Subscriptions/)){
                $(".yt-badge-live").each( (i,e) => {
                    processLiveInfo($,i,e);
                })
            } else {
                log.error(`Session cookie unavaliable title:$("title").text() expected Subscriptions` );
                if(discordClient){
                    backendChannel.send("@everyone 大事不好啦，youtube的爬虫出问题了，爬到页面"+$("title").text());
                    // todo: using conversation to update session
                }
                //sessionOK = false; // restore until restart
            }
        } catch (err) {
            log.error(err);
        }
    }
    await done();
    log.info("Crawling youtube Done");
}


var fetchLiveChat = (videoId,cookie) => {
    let crawler =  new Crawler({
        maxConnections: 10,
        rateLimit: 1000,
        callback: processLiveChat
    })
    crawler.on('schedule',function(options){
        options.headers = {
            cookie: cookie
        };
    });
    let url = 'https://www.youtube.com/live_chat?v=' + videoId
    crawler.queue(url)
} 

fetchLiveChat('UUiJnXjC_-o')