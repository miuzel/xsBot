const moment = require('moment');
const ChartjsNode = require('chartjs-node');
const Keyv = require('keyv');
const plotting = require('keyv');

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

var generateNewPlot = async (points,target,seq) => {
    var chartNode = new ChartjsNode(1920, 1080);
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
            layout: {
                padding: {
                    left: 0,
                    right: 50,
                    top: 0,
                    bottom: 0
                }
            },
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
                        stepSize: 12,
                        displayFormats: {
                            hour: 'M.DD h A'
                        }
                    },
                    distribution: 'linear'
                }]
            }
        }
    })
    await chartNode.writeImageToFile('image/jpg', `${config.folder}testimage_${seq}.jpg`);
    chartNode.destroy()
    return 
}

const config = {
    title: "test",
    plottingID: "test1",
    folder: "/tmp/charts/",
    locale: "zh_CN",
    kv: "../db.sqlite"
}
const keyv = new Keyv(`sqlite://${config.kv}`);

var main = async () => {
    let plottingKey = "plot#"+config.plottingID;
    let data = await keyv.get(plottingKey)
    for (var i = 0;i*40<data.length;i = i+1){
        console.log(i)
        let image = await generateNewPlot([...data.slice(0,i*40)],100000,i)
    }

}

main()