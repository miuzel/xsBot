import bunyan from 'bunyan';
var Crawler = require("crawler");
const Discord = require('discord.js');
const moduleName = 'crawlplotting';
const moment = require('moment');
const ChartjsNode = require('chartjs-node');
var log = bunyan.createLogger({name: moduleName});
var discordClient;
var keyv;
var config;
var c;
var backendChannel;

var downSampling = (array, shards) => {
    if(array.length <= shards * 4){
        return array
    }
    let arrayClone = [...array]
    let arrayRes = []
    let numberEachShard = Math.floor(array.length / shards) 

    while(arrayClone.length / numberEachShard > 1){
        let shard = arrayClone.splice(0,numberEachShard)
        let shardArray = []
        let start , end , max ,min 
        start = shard[0]
        max = shard[0]
        min = shard[0]
        end = shard[shard.length-1]
        for ( let p of shard){
            if(p.y > max.y){
                max = p
            }
            if(p.y < min.y){
                min = p
            }
        }
        shardArray = [start,max,min,end].sort((a,b) => a.x > b.x)
        shardArray = shardArray.filter((item, pos) => {
            return shardArray.indexOf(item) == pos;
        })
        arrayRes = arrayRes.concat(shardArray)
    }
    arrayRes = arrayRes.concat(arrayClone)
    return arrayRes
}

var generateNewPlot = async (points,target) => {
    var chartNode = new ChartjsNode(1800, 900);
    var downsampled = downSampling(points,1600)
    var data = {
        labels: downsampled.map(p=>p.x),
        datasets: [{
          label: config.title,
          backgroundColor: "rgba(143, 195, 50 ,0.2)",
          borderColor: "rgba(143, 195, 50 ,1)",
          borderWidth: 2,
          pointRadius: 0,
          hoverBackgroundColor: "rgba(143, 195, 50 ,0.4)",
          hoverBorderColor: "rgba(143, 195, 50 ,1)",
          data: downsampled.map(p=>p.y),
        },
        {
          label: "目标",
          backgroundColor: "rgba(255,99,132,0.2)",
          borderColor: "rgba(255,99,132,1)",
          borderWidth: 2,
          pointRadius: 0,
          hoverBackgroundColor: "rgba(255,99,132,0.4)",
          hoverBorderColor: "rgba(255,99,132,1)",
          data: downsampled.map(p => target),
        }
         ]
      };
    await chartNode.drawChart({
        type: 'line',
        data: data,
        options : {
            legend: {
                labels: {
                    defaultFontFamily:"'Helvetica Neue', 'Helvetica', 'Arial', 'WenQuanYi Micro Hei Mono',sans-serif"
                }
            },
            animation: {
                duration: 0 // general animation time
            },
            scales: {
                yAxes: [{
                  stacked: false,
                  ticks: {
                    beginAtZero: true
                  },
                  gridLines: {
                    display: true,
                    color: "rgba(255,99,132,0.2)"
                  }
                }],
                xAxes: [{
                    type: 'time',
                    time: {
                        unit: 'hour',
                        stepSize: 6,
                        displayFormats: {
                            hour: 'M.DD h A'
                        }
                    },
                    distribution: 'linear'
                }]
            }
        }
    })
    return chartNode.getImageBuffer('image/png')
}
var isAtEveryone = (last1,last2) => {
    return Math.floor(last1/10000) > Math.floor(last2/10000) ? "@everyone，" : "大家好，"
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
        let delta1
        let deltaName1
        let atEveryone
        let data = await keyv.get(plottingKey)
        if(data)
        {
            data = data.concat([{
                x: new Date(),
                y: x[config.field1]
            }])
        } else {
            data = [{
                x: new Date(),
                y: x[config.field1]
            }]
        }
        log.info(`${config.title} now: ${x[config.field1]}`)
        if (true || data.length % config.gap === 0 && discordClient && config.discordChannels){
            log.info(`Report to discord.`)
            let image = await generateNewPlot([...data],x[config.field3])
            if (data.length > config.gap) {
                delta = data[data.length - 1].y - data[data.length - config.gap - 1].y
                deltaName = moment(data[data.length - config.gap - 1].x).locale(config.locale).from()
                atEveryone = isAtEveryone(data[data.length - 1].y,data[data.length - config.gap-1].y)
            } else {
                delta = data[0].y
                deltaName = "目前"
            }
            if (data.length > config.gap * 4) {
                delta1 = data[data.length - 1].y - data[data.length - (config.gap*4) - 1].y
                deltaName1 = moment(data[data.length - (config.gap*4) - 1].x).locale(config.locale).from()
            } else {
                delta1 = data[0].y
                deltaName1 = "目前"
            }
            let msg = `${atEveryone} ${config.title} 最新数据:  **${x[config.field1]}** `
            let msgEmbed = new Discord.RichEmbed()
            .setColor('#ee3377')
            .setAuthor(config.title +" 🔴 数据直播",config.authorLogo)
            .setTitle(`截至目前，已有 **${x[config.field1]}** 人联署${config.title}\n`)
            .addField(`自${deltaName}新增`,`${delta}`,true)
            .addField(`自${deltaName1}新增`,`${delta1}`,true)
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
                log.info(`Msg ${msg} sent to ${discordChannel}`)
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