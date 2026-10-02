const {postSocialUpdate}=require("./socialFeed");

const API_BASE="https://app.metricool.com/api";
const POLL_MS=Math.max(60000,Number(process.env.METRICOOL_BRIDGE_INTERVAL_MS||120000));
const LOOKBACK_MINUTES=Math.max(5,Number(process.env.METRICOOL_BRIDGE_LOOKBACK_MINUTES||15));
const TIMEZONE=process.env.METRICOOL_TIMEZONE||"America/Chicago";
const USER_ID=process.env.METRICOOL_USER_ID||"";
const BLOG_ID=process.env.METRICOOL_BLOG_ID||"";
const TOKEN=process.env.METRICOOL_API_TOKEN||"";

const SOURCES={
 instagram:{endpoint:"/v2/analytics/posts/instagram",source:"instagram"},
 facebook:{endpoint:"/v2/analytics/posts/facebook",source:"facebook"},
 tiktok:{endpoint:"/v2/analytics/posts/tiktok",source:"tiktok"}
};

function pick(obj,keys){
 for(const key of keys){
  const value=key.split(".").reduce((v,k)=>v?.[k],obj);
  if(value!==undefined&&value!==null&&String(value).trim()!=="")return value;
 }
 return "";
}

function asArray(payload){
 if(Array.isArray(payload))return payload;
 for(const key of ["data","items","content","results","posts"]){
  if(Array.isArray(payload?.[key]))return payload[key];
  if(Array.isArray(payload?.data?.[key]))return payload.data[key];
 }
 return [];
}

function parseCsv(text){
 const rows=[];let row=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==="\""&&text[i+1]==="\""&&quoted){cell+="\"";i++;continue;}
  if(c==="\""){quoted=!quoted;continue;}
  if(c===","&&!quoted){row.push(cell);cell="";continue;}
  if((c==="\n"||c==="\r")&&!quoted){
   if(c==="\r"&&text[i+1]==="\n")i++;
   row.push(cell);cell="";
   if(row.some(v=>String(v).trim()!==""))rows.push(row);
   row=[];continue;
  }
  cell+=c;
 }
 if(cell!==""||row.length){row.push(cell);rows.push(row);}
 if(rows.length<2)return [];
 const headers=rows[0].map(x=>String(x).trim().toLowerCase());
 return rows.slice(1).map(values=>{const item={};headers.forEach((h,i)=>item[h]=values[i]??"");return item;});
}

async function metricoolGet(path,from,to){
 const url=new URL(API_BASE+path);
 url.searchParams.set("blogId",BLOG_ID);
 url.searchParams.set("userId",USER_ID);
 url.searchParams.set("from",from);
 url.searchParams.set("to",to);
 url.searchParams.set("timezone",TIMEZONE);
 const response=await fetch(url,{headers:{"X-Mc-Auth":TOKEN,"Accept":"application/json,text/csv"}});
 const text=await response.text();
 if(!response.ok)throw new Error("Metricool "+response.status+": "+text.slice(0,300));
 const type=response.headers.get("content-type")||"";
 if(type.includes("csv"))return parseCsv(text);
 try{return JSON.parse(text);}catch{return parseCsv(text);}
}

function normalizePost(item,source){
 const url=pick(item,["url","link","permalink","postUrl","post_url","mediaUrl","media_url","permalinkUrl","permalink_url"]);
 const id=pick(item,["id","postId","post_id","uuid","mediaId","media_id"])||url;
 const text=pick(item,["text","caption","description","message","content","title"]);
 const title=pick(item,["title","name"])||(source==="instagram"?"New Instagram post":source==="facebook"?"New Facebook post":"New TikTok post");
 const image=pick(item,["image","imageUrl","image_url","picture","thumbnail","thumbnailUrl","thumbnail_url","cover","coverUrl","cover_url"]);
 const author=pick(item,["author","username","user","profile","account"]);
 const date=pick(item,["date","createdAt","created_at","publishedAt","published_at","publicationDate","publication_date","timestamp"]);
 return {source,id:String(id||source+":"+date+":"+title+":"+text).slice(0,200),title:String(title).slice(0,256),description:String(text||"Brandon Books & Stories has a new social update.").slice(0,4096),url:String(url||"").slice(0,2000),image:typeof image==="string"?image.slice(0,2000):"",author:String(author||"").slice(0,256),date};
}

function postTime(item){
 const raw=pick(item,["date","createdAt","created_at","publishedAt","published_at","publicationDate.dateTime","publication_date","timestamp"]);
 const value=raw?new Date(raw).getTime():0;
 return Number.isFinite(value)?value:0;
}

async function pollSource(guilds,name,config,from,to){
 const payload=await metricoolGet(config.endpoint,from,to);
 const items=asArray(payload);
 const posts=items.map(item=>({raw:item,post:normalizePost(item,config.source)})).filter(x=>x.post.id).sort((a,b)=>postTime(a.raw)-postTime(b.raw));
 let sent=0;
 for(const {post} of posts){
  const result=await Promise.all([...guilds.values()].map(async guild=>{try{return await postSocialUpdate(guild,post);}catch(e){console.error("METRICOOL DISCORD POST FAILED:",name,guild.id,e.message||e);return {ok:false};}}));
  if(result.some(x=>x.ok))sent++;
 }
 return {found:posts.length,sent};
}

function startMetricoolBridge(client){
 if(!TOKEN||!USER_ID||!BLOG_ID){
  console.log("METRICOOL BRIDGE: disabled until METRICOOL_API_TOKEN, METRICOOL_USER_ID, and METRICOOL_BLOG_ID are configured.");
  return null;
 }
 let running=false;
 const poll=async()=>{
  if(running||!client.isReady())return;
  running=true;
  try{
   const now=Date.now();
   const from=new Date(now-LOOKBACK_MINUTES*60000).toISOString();
   const to=new Date(now+60000).toISOString();
   for(const [name,config] of Object.entries(SOURCES)){
    try{const result=await pollSource(client.guilds.cache,name,config,from,to);console.log("METRICOOL BRIDGE:",name,"found="+result.found,"sent="+result.sent);}
    catch(e){console.error("METRICOOL BRIDGE SOURCE FAILED:",name,e.message||e);}
   }
  }catch(e){console.error("METRICOOL BRIDGE FAILED:",e.message||e);}
  finally{running=false;}
 };
 const timer=setInterval(poll,POLL_MS);timer.unref?.();poll();
 console.log("METRICOOL BRIDGE: active | interval="+POLL_MS+"ms | lookback="+LOOKBACK_MINUTES+"m | timezone="+TIMEZONE);
 return timer;
}

module.exports={startMetricoolBridge};