export default async function handler(req,res){
  if(req.method!=="POST"){
    res.statusCode=405;
    res.setHeader("Allow","POST");
    return res.end(JSON.stringify({ok:false,error:"Method not allowed"}));
  }
  try{
    const contentType=String(req.headers["content-type"]||"");
    if(!contentType.includes("application/json")){
      res.statusCode=415;
      return res.end(JSON.stringify({ok:false,error:"Expected application/json"}));
    }
    const chunks=[];
    for await(const chunk of req) chunks.push(chunk);
    const raw=Buffer.concat(chunks).toString("utf8");
    if(raw.length>12000){
      res.statusCode=413;
      return res.end(JSON.stringify({ok:false,error:"Review is too large"}));
    }
    const body=JSON.parse(raw||"{}");
    if(String(body.website||"").trim()){
      res.statusCode=200;
      return res.end(JSON.stringify({ok:true}));
    }

    const payload={
      name:String(body.name||"Anonymous Reader").trim().slice(0,100),
      book:String(body.book||"").trim().slice(0,200),
      rating:Number(body.rating),
      review:String(body.review||"").trim().slice(0,1500),
      favorite:String(body.favorite||"Not provided.").trim().slice(0,800)
    };

    if(!payload.book || !Number.isInteger(payload.rating) || payload.rating<1 || payload.rating>5 || payload.review.length<10){
      res.statusCode=400;
      return res.end(JSON.stringify({ok:false,error:"Please provide a book, a 1–5 rating, and a review of at least 10 characters."}));
    }

    const botUrl=process.env.BBS_BOT_REVIEW_WEBHOOK_URL;
    const secret=process.env.BBS_BOT_REVIEW_WEBHOOK_SECRET;
    if(!botUrl||!secret){
      res.statusCode=503;
      return res.end(JSON.stringify({ok:false,error:"Review service is not configured yet."}));
    }

    const discordResponse=await fetch(botUrl,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "X-Social-Webhook-Secret":secret
      },
      body:JSON.stringify(payload)
    });

    const result=await discordResponse.json().catch(()=>({}));
    if(!discordResponse.ok||!result.ok){
      console.error("BOT REVIEW BRIDGE FAILED:",discordResponse.status,result);
      res.statusCode=502;
      return res.end(JSON.stringify({ok:false,error:"The review could not be delivered to Discord."}));
    }

    res.statusCode=200;
    return res.end(JSON.stringify({ok:true}));
  }catch(error){
    console.error("WEBSITE REVIEW ERROR:",error);
    res.statusCode=400;
    return res.end(JSON.stringify({ok:false,error:"Unable to submit the review right now."}));
  }
}