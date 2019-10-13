const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const { config } = require('../../settings');
const bunyan = require('bunyan');
const client = new Discord.Client();
const myUsername = config.myUsername;
const prefix = config.prefix;
var voiceChannel = false
var dispatcher = false
var connection = false
var stream = false
var url = ""
var playing = false
var playingStartAt = 0
var breakedAt = 0
const log = bunyan.createLogger({ name: "ytStreamer" });
client.on("ready", () => {
  log.info("ready")
})


var msgToMe = m => {
  if (m.author.id === client.user.id) {
    return false
  }
  let trimed = m.content.trim().toLowerCase();

  if (trimed.startsWith(prefix)) {
    return m.content.trim().slice(prefix.length).trim()
  }
  if (trimed.startsWith(myUsername)) {
    return m.content.trim().slice(myUsername.length).trim()
  }
  if (m.channel.type === "dm") {
    return m.content.trim()
  }
  let matches = trimed.match(/^(<@!?\d+>)/);
  if (matches && m.mentions.users.first() && m.mentions.users.first().username === myUsername) {
    return m.content.trim().slice(matches[1].length).trim()
  }
  return false;
}


client.on('message',async message => {
  if (message.channel.type !== 'text') return;
  let msg = msgToMe(message);
  if (!msg) {
    return
  }
  if (msg.toLowerCase().startsWith('请你转播')) {
    if (!(message.member.roles.find(role => role.name === "DJ") ||
      message.member.roles.find(role => role.name === "程序员") ||
      message.member.roles.find(role => role.name.startsWith("管理员"))
    )) {
      return message.reply('转播直播内容请找DJ吧');
    }
    if (!msg.slice('请你转播'.length).trim()) {
      return message.reply('没有链接吗？');
    }
    url = msg.slice('请你转播'.length).trim()
    log.info("play " + url)
    if (voiceChannel){
      voiceChannel.leave()
    }
    voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.reply('请你先加入一个语音室，让我知道你有权限。');
    }
    playingStartAt = 0
    breakedAt = 0
    message.reply('好的，我来试一下，请稍候。。。');
    setTimeout(() => {
      dispatch(url, message)
    }, 1000);
  } else if (msg.toLowerCase().startsWith('请停止转播')) {
    if (!(message.member.roles.find(role => role.name === "DJ") ||
      message.member.roles.find(role => role.name === "程序员") ||
      message.member.roles.find(role => role.name.startsWith("管理员"))
    )) {
      return message.reply('控制转播内容请找DJ吧');
    }
    url = ""
    playing = false
    if (connection) {
      message.reply('好的。');
      await connection.disconnect()
      voiceChannel.leave()
      connection = false
      return
    }
    return message.reply('什么，现在没有转播啊');
  } else if (msg.toLowerCase().startsWith('请继续转播')) {
    playing = false 
    if (url) {
      message.reply('OK');
      if (voiceChannel){
        voiceChannel.leave()
      }
      voiceChannel = message.member.voice.channel;
      if (!voiceChannel) {
        return message.reply('请你先加入一个语音室，让我知道你有权限。');
      }
      setTimeout(() => {
        dispatch(url, message)
      }, 1000);
    } else {
      message.reply('现在没有在转播啊');
    }
  }
});

dispatch = async (url, message) => {
  try {
    console.log("joining")
    connection = await voiceChannel.join()
    console.log("info")
    const info = await ytdl.getInfo(url)
    const playabilityStatus = info.player_response.playabilityStatus.liveStreamability
    const delay = playabilityStatus ? playabilityStatus.liveStreamabilityRenderer.pollDelayMs * 1 : 5000
    
    const livequality = info.formats.filter(x => x.isHLS && x.audioBitrate > 95).map(x => x.itag).sort((a, b) => a * 1 > b * 1)
    const recordquality = info.formats.filter(x => !x.encoding && x.audioBitrate > 95).map(x => x.itag).sort((a, b) => a * 1 < b * 1)
    const progress = playingStartAt ? (breakedAt ? (breakedAt - playingStartAt) : (Date.now() - playingStartAt)) : 0
    stream = ytdl.downloadFromInfo(info, livequality.length ? { quality: livequality, highWaterMark: 1 << 22, liveBuffer: 25000, begin: Date.now() - delay } : {  highWaterMark: 1 << 22, begin:progress });
    stream.on("info", (info, format) => { log.info(format) })
    message.reply('开始转播，正在缓冲，请稍候。。。');
    playing = true
    //const s = ffmpeg(stream).withNoVideo().audioCodec('libopus').format('opus')
    // const s = ffmpeg(stream).withNoVideo().withAudioBitrate(96).audioCodec('libopus').format('opus').inputOptions(['-filter_complex compand=attacks=0:points=-30/-900|-20/-20|0/0|20/20'])
    const s = stream
    s.on('start', function (commandLine) {
      if (!playingStartAt) {
        playingStartAt = Date.now()
      }
      if (breakedAt) {
        playingStartAt = Date.now() - (breakedAt - playingStartAt)
      }
      log.info('Spawned Ffmpeg with command: ' + commandLine);
    });
    s.on("end", () => {
      playing = false
      log.info("play stream end " + url)
    })
    s.on("error", (err) => {
      log.info("play error " + url + "\n" + err)
      if (playing) {
        breakedAt = Date.now()
        message.reply(url + ' 的直播流出错了\n' + err);
      }
    })
    dispatcher = connection.play(s,{passes: 2, bitrate: 96})
    dispatcher.on('end', () => {
      log.info("dispatcher stopped " + url + "\n")
      if (playing) {
        breakedAt = Date.now()
        message.reply('直播中断了，重连中，请稍候。。。');
        setTimeout(() => {
          dispatch(url, message)
        }, 200);
      } else {
        breakedAt = Date.now()
        message.reply(url + ' 的直播结束了。');
        voiceChannel.leave()
      }
    });
    dispatcher.on('error', (err) => {
      log.info("dispatcher error " + url + "\n" + err)
      if (playing) {
        breakedAt = Date.now()
        message.reply(url + ' 的直播出错了\n' + err);
      }
      playing = false
      voiceChannel.leave()
    });
  } catch (err) {
    log.info("play info error " + url + "\n" + err)
    playing = false
    voiceChannel.leave()
    return message.reply(url + ' 的直播出错了\n YouTube说：' + err);
  }
}
client.login(config.token);