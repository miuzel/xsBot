import bunyan from 'bunyan';
import Crawler from "crawler";
import Discord from 'discord.js';
import jsdom from 'jsdom';
import { exec } from 'child_process';
import fs from 'fs';
const log = bunyan.createLogger({name: "superChat"});
const { JSDOM } = jsdom

const getRandomColor = () => {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

export default class SuperChat {
      
    constructor(videoId, videoTitle,videoStart, discord, channels,backendChannel, cookie) {
        this.videoId = videoId
        this.videoStart = videoStart
        this.videoTitle = videoTitle
        this.discordClient = discord
        this.discordChannels = channels
        this.backendChannel = backendChannel
        this.isLive = false
        this.isInitialized = false
        this.sendSuperChat = data => {
            if(!this.discordClient){
                console.log(data)
                return 
            }
            let second = Math.floor((new Date().getTime() - this.videoStart)/1000)
            let msg = `感谢 ${data.authorName.simpleText} 的高亮留言，Mua :two_hearts: `
            let msgEmbed = new Discord.RichEmbed()
            .setColor(getRandomColor())
            .setAuthor( data.authorName.simpleText, data.authorPhoto.thumbnails[0].url)
            .setThumbnail(data.authorPhoto.thumbnails[1].url)
            .setTitle("高亮留言 - 无内容")
            .setURL(`https://www.youtube.com/watch?v=${this.videoId}&t=${second}s`)
            .setTimestamp()
            if(data.message && data.message.runs){
                msgEmbed.setTitle(data.message.runs.filter(x=>x.text !== undefined).map(x=>x.text).join(""))
            }
               
            for (var discordChannel of this.discordChannels){
                let [guildName,channelName]  = discordChannel.split('#');
                let channel = this.discordClient
                .guilds.find(guild => guild.name === guildName)
                .channels.find(ch => ch.name === channelName)
                channel.send(msg,{
                    embed: msgEmbed
                });
                log.info(`Msg ${msg} sent to ${discordChannel}`)
            }
        }
        this.logActions = actions => {
            let renderer
            let data = actions.filter(x => x.addChatItemAction !== undefined)
            .map(x => {
                if (x.addChatItemAction.item.liveChatPaidMessageRenderer){
                    renderer = x.addChatItemAction.item.liveChatPaidMessageRenderer
                    return `[${new Date(renderer.timestampUsec/1000).toLocaleString("zh-CN",{timeZone:'Asia/Shanghai',hourCycle:"h23",hour12:false})}] ${renderer.authorName.simpleText}: [${renderer.purchaseAmountText.simpleText}] ${renderer.message && renderer.message.runs ? renderer.message.runs.map(x=>x.text).join("") : "" }\n`
                }
                if (x.addChatItemAction.item.liveChatTextMessageRenderer){
                    renderer = x.addChatItemAction.item.liveChatTextMessageRenderer
                    return `[${new Date(renderer.timestampUsec/1000).toLocaleString("zh-CN",{timeZone:'Asia/Shanghai',hourCycle:"h23",hour12:false})}] ${renderer.authorName.simpleText}: ${renderer.message && renderer.message.runs ? renderer.message.runs.map(x=>x.text).join("") : ""}\n`
                }
                return ''
            })
            .join("")
            fs.appendFile('./superChat/'+this.videoId+".txt", data , function (err) {
                if (err) throw err;
                log.info('Saved!');
              });
        }
        this.processActions = actions => {
            if(!actions){
                return
            }
            try {
                this.logActions(actions)
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
            log.info("Parsing get_live_chat json "+this.videoTitle);
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
            //log.info("process continuations")
            if(!continuations || !this.isLive){
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
                this.fetchLiveChat()
            }
        }
        this.finish = () => {
            if(!this.isLive){
                log.warn("already stoped." + this.videoTitle)
                return
            }
            this.backendChannel.send(`视频 ${this.videoTitle} 里的高亮留言收集结束了。`);
            this.isLive = false
            exec(`zip ./superChat/${this.videoId}.zip ./superChat/${this.videoId}.txt`,  (error, stdout, stderr) => {
                log.info('stdout: ' + stdout);
                log.error('stderr: ' + stderr);
                if (error !== null) {
                  log.error('exec error: ' + error);
                  return 
                }
                this.backendChannel.send('直播留言记录已生成，请下载。').then(log.info).catch(log.error)
                this.backendChannel.send({
                    files: [{
                      attachment: `./superChat/${this.videoId}.zip`,
                      name: `${this.videoId}.zip`
                    }]
                }).then(log.info).catch(log.error)
              });
            return
        }
        this.processLiveChat = async (error, res, done) =>{
            log.info("Start parsing bootstrap page "+this.videoTitle);
            if (error) {
                log.error("爬虫出错啦："+error);
                this.backendChannel.send("@everyone 爬虫出错啦："+error);
            } else {
                log.info(res.request.path)
                if(!this.isInitialized){
                    this.isInitialized = true
                    try {
                        let { window } = new JSDOM(res.body, { runScripts: "dangerously" });
                        window.onload = () => {
                            if(!window.ytInitialData){
                                log.error("no inital data, so stop")
                                window.close()
                                this.finish()
                                return 
                            }
                            this.backendChannel.send(`我开始收集视频 ${this.videoTitle} 里的留言了，等下打包发出来。`);
                            this.isLive = true
                            let liveChat = window.ytInitialData.contents.liveChatRenderer
                            this.processActions(liveChat.actions)
                            this.processContinuations(liveChat.continuations)
                            setTimeout(() => {
                                log.info("Close window "+res.request.path)
                                window.close() 
                            }, 0)
                        };
                    } catch (err) {
                        if(window){
                            window.close()
                        }
                        log.error(err);
                    }
                } else {
                    log.warn("already initialized.")
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