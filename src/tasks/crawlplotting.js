import bunyan from 'bunyan';
import { resolve } from 'dns';
var Crawler = require("crawler");
const Discord = require('discord.js');
const moduleName = 'crawlplotting';
const moment = require('moment');
const ChartjsNode = require('chartjs-node');
var log = bunyan.createLogger({name: moduleName});
var window = new Map();
var discordClient;
var keyv;
var config;
var c;
var backendChannel;
var generateNewPlot = async (points,target) => {
    var chartNode = new ChartjsNode(1200, 600);
    
    var data = {
        labels: points.map(p=>p.x),
        datasets: [{
          label: config.title,
          backgroundColor: "rgba(143, 195, 50 ,0.2)",
          borderColor: "rgba(143, 195, 50 ,1)",
          borderWidth: 2,
          hoverBackgroundColor: "rgba(143, 195, 50 ,0.4)",
          hoverBorderColor: "rgba(143, 195, 50 ,1)",
          data: points.map(p=>p.y),
        },
        {
          label: "目标",
          backgroundColor: "rgba(255,99,132,0.2)",
          borderColor: "rgba(255,99,132,1)",
          borderWidth: 2,
          pointRadius: 0,
          hoverBackgroundColor: "rgba(255,99,132,0.4)",
          hoverBorderColor: "rgba(255,99,132,1)",
          data: points.map(p => target),
        }
         ]
      };
    await chartNode.drawChart({
        type: 'line',
        data: data,
        options : {
            animation: {
                duration: 0 // general animation time
            },
            scales: {
                yAxes: [{
                  gridLines: {
                    display: true,
                    color: "rgba(255,99,132,0.2)"
                  }
                }],
                xAxes: [{
                    type: 'time',
                    time: {
                        unit: 'minute'
                    },
                    distribution: 'linear'
                }]
            }
        }
    })
    return chartNode.getImageBuffer('image/png')
}
var processPlotData = async (x) => {
    console.log("find new plotting data")
    if(!x[config.field1]){
        return
    }
    try {
        let plottingKey = "plot#"+config.plottingID;
        let delta
        let deltaName
        let data = await keyv.get(plottingKey)
        if(data && data.length > config.gap)
        {
            data = data.concat([{
                x: new Date(),
                y: x[config.field1]
            }])
            delta =  data[data.length-config.gap].y - data[data.length-config.gap-1].y 
            deltaName = moment(data[data.length-config.gap-1].x).locale(config.locale).from()
        } else {
            data = [{
                x: new Date(),
                y: x[config.field1]
            }]
            delta = data[0].y
            deltaName = "当前"
        }
        let image = await generateNewPlot([...data],x[config.field2])

        log.info(`${config.title} now: ${x[config.field1]}`)
        if (data.length % config.gap === 0 && discordClient && config.discordChannels){
            log.info(`Report to discord.`)
            let msg = `@everyone ${config.title} 最新数据:  **${x[config.field1]}** `
            let msgEmbed = new Discord.RichEmbed()
            .setColor('#ee3377')
            .setAuthor(config.title +" 🔴 数据直播",config.authorLogo)
            .setTitle(`最新数据播报 截至目前，已有 **${x[config.field1]}** 人联署${config.title}\n`)
            .addField(`自${deltaName}新增`,`${delta}`,true)
            .addField("还需要",`${x[config.field2]}`,true)
            .setThumbnail(config.thumbnail)
            .setURL(config.pageUrl)
            .attachFile({attachment: image, name: "plot.png"})
            .setImage("attachment://plot.png",'Plot')
            .setTimestamp()
            .setFooter(config.footer,config.footerUrl)

            for (var discordChannel of config.discordChannels){
                const [guildName,channelName]  = discordChannel.split('#');
                let channel = discordClient
                .guilds.find(guild => guild.name === guildName)
                .channels.find(ch => ch.name === channelName)
                channel.send(msg,{
                    embed: msgEmbed
                });
                log.info(`Msg ${msg.description} sent to ${discordChannel}`)
            } 
        }
        await keyv.set(plottingKey,data)
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
            log.info("Start crawling plotting data");
            
            if(error){
                console.log("plotting爬虫出错啦："+error);
                backendChannel.send("@everyone plotting爬虫出错啦："+error);
            }else{
                let resJson = JSON.parse(res.body);
                if (resJson.results){
                    resJson.results.map(
                        x => {
                            processPlotData(x)
                            return x
                        }
                    )
                } else {
                    log.error(`plotting api data failed data:\n${res.body}` );
                    if(discordClient){
                        backendChannel.send("@everyone 大事不好啦，plotting的爬虫出问题了")
                    }
                }
            }
            await done();
            log.info("Crawling plotting Done");
        }
    });
}
var init = () => {
    c = newCrawler(config);
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
        scanForLive(config);
        setInterval(() => scanForLive(config), settings.interval);
    }
};
module.exports = task;