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
    const name=String(body.name||"Anonymous Reader").trim().slice(0,100);
    const book=String(body.book||"").trim().slice(0,200);
    const rating=Number(body.rating);
    const review=String(body.review||"").trim().slice(0,1500);
    const favorite=String(body.favorite||"Not provided.").trim().slice(0,800);
    if(!book || !Number.isInteger(rating) || rating<1 || rating>5 || review.length<10){
      res.statusCode=400;
      return res.end(JSON.stringify({ok:false,error:"Please provide a book, a 1–5 rating, and a review of at least 10 characters."}));
    }
    const webhook=process.env.DISCORD_REVIEW_WEBHOOK_URL;
    if(!webhook){
      res.statusCode=503;
      return res.end(JSON.stringify({ok:false,error:"Review service is not configured yet."}));
    }
    const stars="⭐".repeat(rating)+"☆".repeat(5-rating);
    const safeName=name.replace(/[@]/g,"");
    const safeReview=review.replace(/@everyone|@here/gi,"");
    const safeFavorite=favorite.replace(/@everyone|@here/gi,"");
    const discordResponse=await fetch(webhook,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        username:"Brandon Books & Stories Reviews",
        allowed_mentions:{parse:[]},
        embeds:[{
          title:"⭐ New Website Reader Review",
          description:safeReview,
          color:16766720,
          fields:[
            {name:"📚 Book",value:book,inline:false},
            {name:"⭐ Rating",value:stars+" ("+rating+"/5)",inline:true},
            {name:"👤 Reader",value:safeName||"Anonymous Reader",inline:true},
            {name:"❤️ Favorite Part",value:safeFavorite||"Not provided.",inline:false}
          ],
          footer:{text:"Brandon Books & Stories • Website Review"},
          timestamp:new Date().toISOString()
        }]
      })
    });
    if(!discordResponse.ok){
      const detail=await discordResponse.text().catch(()=>"");
      console.error("DISCORD REVIEW WEBHOOK FAILED:",discordResponse.status,detail);
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