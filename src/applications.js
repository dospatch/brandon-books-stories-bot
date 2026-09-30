const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle
}=require("discord.js");

const TYPES={
  "author-team":"Author Team",
  "moderator":"Moderator",
  "book-reviewer":"Book Reviewer"
};

function applicationMenu(){
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("apply-type")
      .setPlaceholder("Choose an application type")
      .addOptions(
        {label:"Author Team",value:"author-team",description:"Help with the Books & Stories community.",emoji:"✍️"},
        {label:"Moderator",value:"moderator",description:"Help moderate the community.",emoji:"🛡️"},
        {label:"Book Reviewer",value:"book-reviewer",description:"Share thoughtful reader reviews.",emoji:"📚"}
      )
  );
}

async function sendApplicationDM(user,embed,components=[]){
 try{await user.send({embeds:[embed],components});return true;}catch(e){console.warn("APPLICATION DM FAILED:",e.message||e);return false;}
}

function applicationControlRow(){
 return new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId("application-cancel").setLabel("Cancel Application").setStyle(ButtonStyle.Danger).setEmoji("❌"),
  new ButtonBuilder().setCustomId("application-start-over").setLabel("Start Over").setStyle(ButtonStyle.Secondary).setEmoji("🔄")
 );
}

function staffCategory(guild){
  const me=guild.members.me;
  return guild.channels.cache.find(c=>c.type===ChannelType.GuildCategory&&c.name==="🔒 STAFF"&&(!me||c.permissionsFor(me)?.has(PermissionFlagsBits.ViewChannel)));
}

async function createApplicationChannel(i,type,answers){
  const staff=staffCategory(i.guild);
  if(!staff)throw new Error("The 🔒 STAFF category was not found. Run /setup-author-server first.");

  const existing=i.guild.channels.cache.find(c=>c.type===ChannelType.GuildText&&c.topic==="books-application:"+i.user.id);
  if(existing)return {existing};

  const overwrites=[
    {id:i.guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
    {id:i.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},
    {id:i.client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels]}
  ];

  // Only include staff roles the bot is actually allowed to manage.
  // Discord rejects permission overwrites for roles at/above the bot's highest role.
  const botMember=i.guild.members.me || await i.guild.members.fetchMe();
  for(const name of ["👑 Owner","🛠️ Administrator","🛡️ Moderator","✍️ Author Team"]){
    const role=i.guild.roles.cache.find(r=>r.name===name);
    if(role && !role.managed && role.position<botMember.roles.highest.position){
      overwrites.push({id:role.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]});
    }else if(role){
      console.warn("APPLICATION ROLE SKIPPED: "+name+" is managed or not below the bot's highest role.");
    }
  }

  const safeName=i.user.username.toLowerCase().replace(/[^a-z0-9-]/g,"-").slice(0,40)||"user";
  let channel;
  try{
   channel=await i.guild.channels.create({
    name:"application-"+safeName,
    type:ChannelType.GuildText,
    parent:staff.id,
    topic:"books-application:"+i.user.id,
    permissionOverwrites:overwrites,
    reason:"Books & Stories application"
   });
  }catch(e){
   const code=e?.code||e?.rawError?.code||"unknown";
   const status=e?.status||e?.httpStatus||e?.rawError?.status||"unknown";
   console.error("APPLICATION CHANNEL CREATE FAILED:",{
    code,status,message:e?.message||String(e),
    botHighestRole:botMember.roles.highest?.name,
    botHighestRolePosition:botMember.roles.highest?.position
   });
   throw new Error("Discord denied application channel creation | code="+code+" | status="+status+" | message="+(e?.message||String(e)));
  }

  const typeName=TYPES[type]||"Application";
  await channel.send({
    components:[new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("application-approve:"+i.user.id).setLabel("Approve").setStyle(ButtonStyle.Success).setEmoji("✅"),
      new ButtonBuilder().setCustomId("application-reject:"+i.user.id).setLabel("Reject").setStyle(ButtonStyle.Danger).setEmoji("❌")
    )],
    embeds:[
      new EmbedBuilder()
        .setTitle("📋 Books & Stories Application")
        .setDescription(
          "**Type:** "+typeName+
          "\n**Applicant:** "+i.user.tag+
          "\n\n**Why are you applying?**\n"+answers.why+
          "\n\n**Relevant experience:**\n"+answers.experience+
          "\n\n**Availability:**\n"+answers.availability+
          "\n\n**Additional information:**\n"+answers.extra
        )
        .setFooter({text:"Brandon Books & Stories • Staff Review"})
    ]
  });

  return {channel};
}

function isStaffReviewer(i){
 if(!i.guild||!i.member?.roles?.cache)return false;
 if(i.guild.ownerId===i.user.id)return true;
 return i.member.roles.cache.some(r=>["👑 Owner","🛠️ Administrator","🛡️ Moderator","✍️ Author Team"].includes(r.name));
}

async function handleApplicationReview(i){
 if(!i.isButton())return false;
 if(!i.customId.startsWith("application-approve:")&&!i.customId.startsWith("application-reject:"))return false;
 if(!i.guild)return i.reply({content:"This action can only be used inside the server.",flags:MessageFlags.Ephemeral});
 if(!isStaffReviewer(i))return i.reply({content:"🔒 Only authorized staff can review applications.",flags:MessageFlags.Ephemeral});
 const applicantId=i.customId.split(":")[1];
 const approved=i.customId.startsWith("application-approve:");
 const status=approved?"Approved":"Rejected";
 const typeName=(i.message.embeds?.[0]?.description||"").match(/\*\*Type:\*\* ([^\n]+)/)?.[1]||"Application";
 const embed=i.message.embeds?.[0];
 const updated=EmbedBuilder.from(embed||{}).setColor(approved?0x57F287:0xED4245).setFooter({text:"Brandon Books & Stories • "+status});
 await i.update({embeds:[updated],components:[]});
 const applicant=await i.client.users.fetch(applicantId).catch(()=>null);
 if(applicant){
  await applicant.send({
   embeds:[new EmbedBuilder()
    .setTitle((approved?"✅":"❌")+" Application "+status)
    .setDescription("Your **"+typeName+"** application has been **"+status.toLowerCase()+"** by the Brandon Books & Stories staff team.\n\nIf you have questions, please contact the community staff.")
    .addFields({name:"Application Type",value:typeName,inline:true},{name:"Status",value:status,inline:true})
    .setFooter({text:"📖 Real Stories • Bigger Purpose"})]
  }).catch(()=>{});
 }
 return true;
}

async function handleApplicationInteraction(i){
  if(await handleApplicationReview(i))return true;
  if(i.isButton()&&(i.customId==="application-cancel"||i.customId==="application-start-over")){
    if(i.customId==="application-cancel"){
      return i.update({
        embeds:[new EmbedBuilder()
          .setTitle("❌ Application Cancelled")
          .setDescription("Your current application has been cancelled. Nothing was submitted to the staff team.")
          .setFooter({text:"📖 Real Stories • Bigger Purpose"})],
        components:[]
      });
    }
    return i.update({
      embeds:[new EmbedBuilder()
        .setTitle("🔄 Start Over")
        .setDescription("Your previous application process has been reset. Use **/apply** in the server to start a new application.")
        .setFooter({text:"📖 Real Stories • Bigger Purpose"})],
      components:[]
    });
  }

  if(i.isStringSelectMenu()&&i.customId==="apply-type"){
    if(!i.guild)return i.reply({content:"This application can only be started inside the server.",flags:MessageFlags.Ephemeral});
    const type=i.values[0];
    const typeName=TYPES[type]||"Application";
    await sendApplicationDM(i.user,new EmbedBuilder()
      .setTitle("📋 Application Started")
      .setDescription("You selected **"+typeName+"** for your Brandon Books & Stories application.\n\nComplete the application form in Discord. Your answers will be sent privately to the staff review team.")
      .addFields({name:"Application Type",value:typeName,inline:true},{name:"Status",value:"🟡 Form in progress",inline:true})
      .setFooter({text:"📖 Real Stories • Bigger Purpose"}),[applicationControlRow()]);
    const modal=new ModalBuilder().setCustomId("apply-modal:"+type).setTitle((TYPES[type]||"Application")+" Application");
    const why=new TextInputBuilder().setCustomId("why").setLabel("Why are you applying?").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
    const experience=new TextInputBuilder().setCustomId("experience").setLabel("Relevant experience").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
    const availability=new TextInputBuilder().setCustomId("availability").setLabel("Your availability").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200);
    const extra=new TextInputBuilder().setCustomId("extra").setLabel("Anything else we should know?").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000);
    modal.addComponents(
      new ActionRowBuilder().addComponents(why),
      new ActionRowBuilder().addComponents(experience),
      new ActionRowBuilder().addComponents(availability),
      new ActionRowBuilder().addComponents(extra)
    );
    await i.showModal(modal);
    return true;
  }

  if(i.isModalSubmit()&&i.customId.startsWith("apply-modal:")){
    await i.deferReply({flags:MessageFlags.Ephemeral});
    const parts=i.customId.split(":");
    const guildId=parts[1];
    const type=parts[2];
    const guild=await i.client.guilds.fetch(guildId).catch(()=>null);
    if(!guild)return i.editReply("❌ Application submission failed: the Brandon Books & Stories server could not be found.");
    const answers={
      why:i.fields.getTextInputValue("why"),
      experience:i.fields.getTextInputValue("experience"),
      availability:i.fields.getTextInputValue("availability"),
      extra:i.fields.getTextInputValue("extra")||"None provided."
    };
    try{
      const result=await createApplicationChannel({...i,guild},type,answers);
      if(result.existing){
       const typeName=TYPES[type]||"Application";
       await sendApplicationDM(i.user,new EmbedBuilder().setTitle("📋 Application Already Open").setDescription("You already have an open **"+typeName+"** application.").addFields({name:"Status",value:"🟡 Awaiting staff review",inline:true},{name:"Application",value:"<#"+result.existing.id+">",inline:true}).setFooter({text:"📖 Real Stories • Bigger Purpose"}));
       return i.editReply("📋 You already have an open application: <#"+result.existing.id+">");
      }
      const typeName=TYPES[type]||"Application";
      await sendApplicationDM(i.user,new EmbedBuilder()
       .setTitle("✅ Application Submitted")
       .setDescription("Your **"+typeName+"** application has been submitted privately to the Brandon Books & Stories staff team.")
       .addFields({name:"Application Type",value:typeName,inline:true},{name:"Status",value:"🟡 Awaiting staff review",inline:true})
       .setFooter({text:"📖 Real Stories • Bigger Purpose"}));
      return i.editReply("✅ Your application has been submitted privately to the staff team: <#"+result.channel.id+">");
    }catch(e){
      console.error("APPLICATION FAILED:",e);
      return i.editReply("❌ Application submission failed: "+(e.message||String(e)));
    }
  }

  return false;
}

module.exports={applicationMenu,handleApplicationInteraction};
