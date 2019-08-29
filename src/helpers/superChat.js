import bunyan from 'bunyan';
import Crawler from "crawler";
import Discord from 'discord.js';
import jsdom from 'jsdom';
const log = bunyan.createLogger({name: "superChat"});
const { JSDOM } = jsdom

export default class SuperChat {
    constructor(videoId, discord, channels,backendChannel, cookie) {
        this.videoId = videoId
        this.discordClient = discord
        this.discordChannels = channels
        this.backendChannel = backendChannel
        this.sendSuperChat = data => {
            if(!this.discordClient){
                console.log(data)
                return 
            }
            let msg = `感谢 ${data.authorName.simpleText} 的高亮留言，mua`
            let msgEmbed = new Discord.RichEmbed()
            .setColor('#f57c00')
            .setAuthor(data.authorName.simpleText)
            .setURL(`https://www.youtube.com/watch?v=${this.videoId}`)
            .setTimestamp()
            if(data.purchaseAmountText && data.purchaseAmountText.simpleText) {
                msgEmbed.setDescription(`金额：${data.purchaseAmountText.simpleText}`)
            }
            if(data.message && data.message.runs){
                msgEmbed.setTitle(data.message.runs.map(x=>x.text).join(""))
            }
               
            for (var discordChannel of this.discordChannels){
                const [guildName,channelName]  = discordChannel.split('#');
                let channel = this.discordClient
                .guilds.find(guild => guild.name === guildName)
                .channels.find(ch => ch.name === channelName)
                channel.send(msg,{
                    embed: msgEmbed
                });
                log.info(`Msg ${msg} sent to ${discordChannel}`)
            }
        }
        this.processActions = actions => {
            log.info("process actions")
            if(!actions){
                return
            }
            try {
                // actions.filter(x => x.addChatItemAction !== undefined && x.addChatItemAction.item.liveChatTextMessageRenderer)
                //         .map(x => {
                //             let data = x.addChatItemAction.item.liveChatTextMessageRenderer
                //             this.sendSuperChat(data)
                //             console.log(`${data.authorName.simpleText}: ${data.message.runs.map(x=>x.text).join("")}`)
                //         } )
                actions.filter(x => x.addChatItemAction !== undefined && x.addChatItemAction.item.liveChatPaidMessageRenderer)
                        .map(x => {
                            let data = x.addChatItemAction.item.liveChatPaidMessageRenderer
                            this.sendSuperChat(data)
                            return 0
                        } )
            } catch (err){
                log.error(err)
            }
        }
        this.processLiveChatCont = async (error, res, done) => {
            log.info("Parsing get_live_chat json ");
            if (error) {
                console.log("爬虫出错啦："+error);
                this.backendChannel.send("@everyone 爬虫出错啦："+error);
            } else {
                res = JSON.parse(res.body)
                if (res.response && res.response.continuationContents){
                    this.processActions(res.response.continuationContents.liveChatContinuation.actions)
                    this.processContinuations(res.response.continuationContents.liveChatContinuation.continuations)
                }
            }
            await done();
        }
        this.crawlerCont = new Crawler({
            maxConnections: 10,
            rateLimit: 1000,
            jQuery: false,
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36",
            callback: this.processLiveChatCont
        })
        this.crawlerCont.on('schedule', function (options) {
            options.headers = {
                cookie: cookie
            }
        })
        this.processContinuations = continuations => {
            log.info("process continuations")
            if(!continuations){
                log.info("no continuations.")
                return
            }
            if(continuations[0].invalidationContinuationData){
                let continuation = continuations[0].invalidationContinuationData.continuation
                //log.info(`fetch https://www.youtube.com/live_chat/get_live_chat?continuation=${continuation}&hidden=false&pbj=1`)
                setTimeout(()=> this.crawlerCont.queue(`https://www.youtube.com/live_chat/get_live_chat?continuation=${continuation}&hidden=false&pbj=1`),
                continuations[0].invalidationContinuationData.timeoutMs)
            } else if(continuations[0].timedContinuationData) {
                let continuation = continuations[0].timedContinuationData.continuation
                //log.info(`fetch https://www.youtube.com/live_chat/get_live_chat?continuation=${continuation}&hidden=false&pbj=1`)
                setTimeout(()=> this.crawlerCont.queue(`https://www.youtube.com/live_chat/get_live_chat?continuation=${continuation}&hidden=false&pbj=1`),
                continuations[0].timedContinuationData.timeoutMs)
            } else {
                log.info(continuations)
                log.info("no continuations.")
            }
        }
        this.processLiveChat = async (error, res, done) =>{
            log.info("Start parsing bootstrap page");
            if (error) {
                log.error("爬虫出错啦："+error);
                this.backendChannel.send("@everyone 爬虫出错啦："+error);
            } else {
                console.log(res.request.path)
                try {
                    const { window } = new JSDOM(res.body, { runScripts: "dangerously" });
                    window.onload = () => {
                        if(!window.ytInitialData){
                            log.error("no inital data, so stop")
                            return 
                        }
                        let liveChat = window.ytInitialData.contents.liveChatRenderer
                        this.processActions(liveChat.actions)
                        this.processContinuations(liveChat.continuations)
                    };
                } catch (err) {
                    log.error(err);
                }
            }
            await done();
        }
        this.crawler = new Crawler({
            maxConnections: 10,
            rateLimit: 1000,
            jQuery: jsdom,
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36",
            callback: this.processLiveChat
        })
        this.crawler.on('schedule', function (options) {
            options.headers = {
                cookie: cookie
            }
        })
        this.fetchLiveChat = () => {
            log.info("start SuperChat fetch on video "+this.videoId)
            let url = 'https://www.youtube.com/live_chat?v=' + this.videoId
            this.crawler.queue(url)
        }
    }
}