export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed."});
  const botUrl=process.env.BBS_BOT_REVIEW_WEBHOOK_URL;
  const secret=process.env.SOCIAL_WEBHOOK_SECRET;
  if(!botUrl||!secret)return res.status(503).json({ok:false,error:"Review service is not configured yet."});
  try{
    const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
    if(body.website)return res.status(400).json({ok:false,error:"Invalid submission."});
    const payload={
      name:String(body.name||"").trim().slice(0,100),
      book:String(body.book||"").trim().slice(0,1024),
      rating:String(body.rating||"").trim(),
      review:String(body.review||"").trim().slice(0,1500),
      favorite:String(body.favorite||"").trim().slice(0,800)
    };
    if(!payload.book||!payload.rating||payload.review.length<10)return res.status(400).json({ok:false,error:"Please complete the book, rating, and review fields."});
    const response=await fetch(botUrl,{method:"POST",headers:{"Content-Type":"application/json","X-Social-Webhook-Secret":secret},body:JSON.stringify(payload)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.ok)return res.status(502).json({ok:false,error:"The review could not be delivered to Discord."});
    return res.status(200).json({ok:true});
  }catch(error){
    console.error("WEBSITE REVIEW ERROR:",error);
    return res.status(500).json({ok:false,error:"Unable to submit the review right now."});
  }
}
