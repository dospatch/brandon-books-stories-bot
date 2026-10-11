const {EmbedBuilder,ChannelType}=require("discord.js");

const CHANNEL_NAME="⭐・amazon-reviews";
const MAX_BODY=30000;

function clean(value,max=1024){
  return String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);
}

function readJson(req){
  return new Promise((resolve,reject)=>{
    let body="";
    req.on("data",chunk=>{
      body+=chunk.toString("utf8");
      if(body.length>MAX_BODY){
        reject(new Error("Payload too large."));
        req.destroy();
      }
    });
    req.on("end",()=>{
      try{resolve(JSON.parse(body||"{}"));}
      catch(e){reject(new Error("Invalid JSON payload."));}
    });
    req.on("error",reject);
  });
}

async function postAmazonReview(guild,data){
  const channel=guild.channels.cache.find(c=>c.type===ChannelType.GuildText&&c.name===CHANNEL_NAME);
  if(!channel)throw new Error(CHANNEL_NAME+" channel not found. Run /setup-author-server or create the channel.");
  const rating=Number(data.rating);
  if(!Number.isInteger(rating)||rating<1||rating>5)throw new Error("rating must be an integer from 1 to 5.");
  const book=clean(data.book,200);
  const title=clean(data.title||"New Amazon review",256);
  const review=clean(data.review||data.text||"",3500);
  const reviewer=clean(data.reviewerName||data.reviewer||"Public reviewer name unavailable",150);
  const url=clean(data.url||data.reviewUrl||"",2000);
  const asin=clean(data.asin||"",20);
  const reviewId=clean(data.id||data.reviewId||url||[book,rating,title,review].join("|"),180);
  if(!book)throw new Error("book is required.");
  if(!url||!/^https:\/\//i.test(url))throw new Error("url must be an HTTPS link to the public Amazon review or book reviews page.");
  const marker="BBS:AMAZON:REVIEW:"+reviewId;
  const recent=await channel.messages.fetch({limit:100}).catch(()=>null);
  if(recent&&recent.some(m=>m.author?.id===guild.client.user.id&&m.embeds?.some(e=>e.footer?.text===marker))){
    return {channelId:channel.id,duplicate:true};
  }
  const embed=new EmbedBuilder()
    .setColor(rating>=4?0x57F287:rating===3?0xFEE75C:0xED4245)
    .setTitle("📚 New Amazon Book Review")
    .setDescription(review||"*Review text was not supplied by the monitoring source.*")
    .addFields(
      {name:"📖 Book",value:book,inline:false},
      {name:"⭐ Rating",value:"⭐".repeat(rating)+"☆".repeat(5-rating)+" ("+rating+"/5)",inline:true},
      {name:"👤 Public reviewer name",value:reviewer,inline:true},
      ...(asin?[{name:"Amazon ASIN",value:asin,inline:true}]:[])
    )
    .setURL(url)
    .setFooter({text:marker})
    .setTimestamp(data.date?new Date(data.date):new Date());
  await channel.send({content:"🔔 **A new Amazon review was detected.**",embeds:[embed],allowedMentions:{parse:[]}});
  return {channelId:channel.id,duplicate:false};
}

async function handleAmazonReviewWebhook(req,res,guilds){
  const expected=process.env.AMAZON_REVIEW_WEBHOOK_SECRET;
  if(!expected){
    res.writeHead(503,{"Content-Type":"application/json"});
    res.end(JSON.stringify({ok:false,error:"AMAZON_REVIEW_WEBHOOK_SECRET is not configured"}));
    return;
  }
  if(req.headers["x-amazon-review-secret"]!==expected){
    res.writeHead(401,{"Content-Type":"application/json"});
    res.end(JSON.stringify({ok:false,error:"Unauthorized"}));
    return;
  }
  try{
    const data=await readJson(req);
    const results=[];
    for(const guild of guilds.values()){
      try{results.push({guild:guild.id,ok:true,...await postAmazonReview(guild,data)});}
      catch(e){results.push({guild:guild.id,ok:false,error:e.message||String(e)});}
    }
    const ok=results.some(r=>r.ok);
    res.writeHead(ok?200:400,{"Content-Type":"application/json"});
    res.end(JSON.stringify({ok,results}));
  }catch(e){
    res.writeHead(400,{"Content-Type":"application/json"});
    res.end(JSON.stringify({ok:false,error:e.message||"Invalid request"}));
  }
}

module.exports={handleAmazonReviewWebhook,postAmazonReview};
