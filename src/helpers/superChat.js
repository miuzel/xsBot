const bunyan = require('bunyan');
var Crawler = require("crawler");
var jsdom = require('jsdom');
const moment = require('moment');
var log = bunyan.createLogger({name: "superChat"});

var processLiveChat = async (error, res, done) =>{
    log.info("Start crawling feed subscription");
    if (error) {
        console.log("爬虫出错啦："+error);
        backendChannel.send("@everyone 爬虫出错啦："+error);
    } else {
        try {
            const {JSDOM} = jsdom
            const { window } = new JSDOM(res.body, { runScripts: "dangerously" });
            window.onload = () => {
                console.log("ready to roll!");
                console.log(window.ytInitialData)
                console.log(window.ytInitialData.contents.liveChatRenderer.actions
                    .filter(x => x.addChatItemAction !== undefined)
                    .map(x => x.addChatItemAction ))
                console.log(window.ytInitialData.contents.liveChatRenderer.continuations[0])

            };
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
        jQuery: jsdom,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36",
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
fetchLiveChat('jdT18-l7C24',"SID=nAdyYfDvZ-p-vaWsy7jIF1xScdsFR_k5jTqINZux76y5CTv-gT2sGuNeezlkYJpnhi8lyQ.; HSID=AzxX7-H2g_Skm3dhR; SSID=AHURIvimv3mqtS_b0")