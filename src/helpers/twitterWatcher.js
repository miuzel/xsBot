const { config } = require('../../settings')
const bunyan = require('bunyan')
const Crawler  = require("crawler")
const log = bunyan.createLogger({name: "twitterWatcher"})
const cheerio = require('cheerio')
const Keyv = require( 'keyv')
const keyv = new Keyv(`sqlite://../../${config.kv}`)
const maxKey = "twitter#maxid"
const webhookURL = config.twitterWatcher.webhookURL
const interval = config.twitterWatcher.interval
const url = config.twitterWatcher.twitterListURL
const request = require('request')
const TurndownService = require('turndown');
let turndownService = new TurndownService();
turndownService.addRule('urlbase', {
    filter: ['a'],
    replacement: function (content, node, options) {
        let href = node.getAttribute('href')
        if(node.getAttribute('href').match(/^\//)){
            href = 'https://twitter.com'+href
        }
        if(content.match(/^pic.twitter.com/)){
            return ''
        }
        return ` [${content}](${href}) `
    }
  })

turndownService.keep('img')
turndownService.addRule('imgurl', {
    filter: ['img'],
    replacement: function (content, node, options) {
        emoji = node.getAttribute('src').match(/\/emoji\/.*\.png/)
        if(emoji && node.getAttribute('alt')){
            return node.getAttribute('alt')
        }
        return " "+ node.getAttribute('src')
    }
})
turndownService.addRule('parareturn', {
    filter: ['p'],
    replacement: function (content, node, options) {
        return  content+"\n"
    }
})
var maxid = ""

const compareMaxId = (a,b) => {
    const as = a.split("")
    const bs = b.split("")
    if(as.length > bs.length){
        return a
    }
    if(as.length < bs.length){
        return b
    }
    for(let i=0;i<as.length;i++){
        if(as[i]>bs[i]){
            return a
        }
        if(as[i]<bs[i]){
            return b
        }
    }
    return a
}

const processTweet = $ => async (_, tweet) => {
    const retweeter = $(tweet).data('retweeter')
    const retweeterfull = $(tweet).find(".js-user-profile-link").first().text().trim()
    const username = $(tweet).find(".fullname").first().text()
    const avatar_url = $(tweet).find(".js-action-profile-avatar").attr("src")
    const content_url = 'https://twitter.com' + $(tweet).data('permalink-path')
    const text =  turndownService.turndown($(tweet).find(".js-tweet-text-container").html() +"<br>"+ ($(tweet).find(".AdaptiveMediaOuterContainer").html() ? $(tweet).find(".AdaptiveMediaOuterContainer").html() : "")) 
    const content = (retweeter ? "由  **" + retweeterfull + "**  转推\n" : "") + text + "\n[查看原文](" + content_url + ")"  
    const id = $(tweet).data(retweeter ? 'retweet-id' : 'tweet-id')
    maxid = compareMaxId(id,maxid)
    request.post( webhookURL,
        { json: { username, avatar_url, content } },
        function (error, response) {
            if (!error && response.statusCode == 200) {
                log.info('OK!');
            } else {
                log.error(error)
            }
        }
    )
}

const processTwitter = async (error, res, done) => {
    try {
        log.info("Start parsing page ")
        if (error) {
            log.error("爬虫出错啦："+error)
        } 
        log.info(res.request.path)
        try {
            let resjson = JSON.parse(res.body)
            if (resjson && resjson.items_html)
            {
                const $ = cheerio.load(resjson.items_html)
                $('.tweet').each(processTweet($))
            }
        } catch (err) {
            log.error(err);
        }
        await keyv.set(maxKey, maxid)
        setTimeout(()=>{
            crawler.queue(url+"&min_position="+maxid)
        },interval)
        await done();
    } catch (e) {
        log.error(e)
    }
}

const crawler = new Crawler({
    maxConnections: 10,
    rateLimit: 1000,
    jQuery: null,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36",
    callback: processTwitter
})
const run = async () => {
    if(!maxid){
        maxid = await keyv.get(maxKey)
        if(!maxid){
            maxid = ""
        }
        console.log(maxid)
    }
    crawler.queue(url+"&min_position="+maxid)
}
run()
