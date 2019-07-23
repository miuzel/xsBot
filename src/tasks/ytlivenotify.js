import {google}  from 'googleapis';
import bunyan from 'bunyan';
const moduleName = 'ytlivenotify';
var log = bunyan.createLogger({name: moduleName});
var service;
var discordClient;
var channels = [];
var window = new Map();
var scanForLive= async () => {
    for (var channel of channels){
        await getLiveStreams(channel);
    }
};
var keyv;
var getLiveStreams= async channel => {
    log.info('Get livestreams start.')
    try {
        const response = await  service.search.list(
            {
                part: "snippet",
                type: "video",
                eventType: "live",
                channelId: channel.channelId,
                maxResults: 5
            }
        );
        var liveStreams = response.data.items;
        if (liveStreams.length == 0){
            log.info('No live streams found.')
            return;
        } else {
            for (var liveStream of liveStreams){
                let videoKey = "notified#"+liveStream.id.videoId;
                let notified = await keyv.get(videoKey)
                if (!notified && discordClient && channel.discordChannels){
                    let msg = `@everyone ${channel.owner} 开始直播啦 不要忘记点赞哦。 https://www.youtube.com/watch?v=${liveStream.id.videoId}`;
                    for (var discordChannel of channel.discordChannels){
                        const [guildName,channelName]  = discordChannel.split('#');
                        let channel = discordClient
                        .guilds.find(guild => guild.name === guildName)
                        .channels.find(ch => ch.name === channelName)
                        channel.send(msg);
                    }
                    log.info('This video\'s ID is %s. Title \'%s\'',
                    liveStream.id.videoId,
                    liveStream.snippet.title);
                    await keyv.set(videoKey,true)
                }
            }
        }
        log.info('Get livestreams done.')
    } catch (err){
        log.error('The API returned an error: ' + err);
    }
};
var task = {
    name: moduleName,
    start: (settings,discord,kv) => {
        service = google.youtube(
            {
                version: 'v3',
                auth: settings.googleapikey 
            }
        );
        keyv = kv;
        discordClient = discord;
        for (var channel of settings.channels){
            channels.push(channel);
        }
        scanForLive();
        setInterval(scanForLive, settings.interval);
    }
};
module.exports = task;