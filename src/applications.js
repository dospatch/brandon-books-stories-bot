const {
  ActionRowBuilder,StringSelectMenuBuilder,ModalBuilder,TextInputBuilder,
  TextInputStyle,EmbedBuilder,ChannelType,PermissionFlagsBits,
  MessageFlags,ButtonBuilder,ButtonStyle
}=require("discord.js");
const {logStaffEvent}=require("./staff");

const TYPES={
  "author-team":"Author Team",
  "moderator":"Moderator",
  "book-reviewer":"Book Reviewer"
};
const REVIEW_ROLES=["👑 Owner","🛠️ Administrator","🛡️ Moderator","✍️ Author Team"];

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
  try{
    const message=await user.send({embeds:[embed],components});
    return {ok:true,message};
  }catch(e){
    console.warn("APPLICATION DM FAILED:",e.message||e);
    return {ok:false,error:e};
  }
}

function applicationControlRow(guildId,type){
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("application-start:"+guildId+":"+type).setLabel("Start Application").setStyle(ButtonStyle.Success).setEmoji("▶️"),
    new ButtonBuilder().setCustomId("application-cancel:"+guildId+":"+type).setLabel("Cancel Application").setStyle(ButtonStyle.Danger).setEmoji("❌")
  );
}

function staffCategory(guild){
  const me=guild.members.me;
  return guild.channels.cache.find(c=>
    c.type===ChannelType.GuildCategory &&
    c.name==="🔒 STAFF" &&
    (!me||c.permissionsFor(me)?.has(PermissionFlagsBits.ViewChannel))
  );
}

function isStaffReviewer(i){
  if(!i.guild||!i.member?.roles?.cache)return false;
  if(i.guild.ownerId===i.user.id)return true;
  return i.member.roles.cache.some(r=>REVIEW_ROLES.includes(r.name));
}

function buildApplicationModal(guildId,type){
  const typeName=TYPES[type]||"Application";
  const modal=new ModalBuilder().setCustomId("apply-modal:"+guildId+":"+type).setTitle(typeName+" Application");
  const why=new TextInputBuilder().setCustomId("why").setLabel("Why are you applying?").setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(10).setMaxLength(1000);
  const experience=new TextInputBuilder().setCustomId("experience").setLabel("Relevant experience").setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(10).setMaxLength(1000);
  const availability=new TextInputBuilder().setCustomId("availability").setLabel("Your availability").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200);
  const extra=new TextInputBuilder().setCustomId("extra").setLabel("Anything else we should know?").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000);
  modal.addComponents(
    new ActionRowBuilder().addComponents(why),
    new ActionRowBuilder().addComponents(experience),
    new ActionRowBuilder().addComponents(availability),
    new ActionRowBuilder().addComponents(extra)
  );
  return modal;
}

async function createApplicationChannel(i,type,answers){
  const staff=staffCategory(i.guild);
  if(!staff)throw new Error("The 🔒 STAFF category is unavailable to the bot. Run /setup-author-server first and make sure the bot can view the Staff category.");

  const topic="books-application:"+i.user.id;
  const existing=i.guild.channels.cache.find(c=>c.type===ChannelType.GuildText&&c.topic===topic);
  if(existing)return {existing};

  const botMember=i.guild.members.me||await i.guild.members.fetchMe();
  const overwrites=[
    {id:i.guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
    {id:i.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},
    {id:i.client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageMessages]}
  ];

  for(const name of REVIEW_ROLES){
    const role=i.guild.roles.cache.find(r=>r.name===name);
    if(role&&!role.managed&&role.position<botMember.roles.highest.position){
      overwrites.push({id:role.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]});
    }
  }

  const safeName=i.user.username.toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").slice(0,40)||"user";
  let channel;
  try{
    channel=await i.guild.channels.create({
      name:"application-"+safeName,
      type:ChannelType.GuildText,
      parent:staff.id,
      topic,
      permissionOverwrites:overwrites,
      reason:"Brandon Books & Stories application"
    });
  }catch(e){
    const code=e?.code||e?.rawError?.code||"unknown";
    const status=e?.status||e?.httpStatus||e?.rawError?.status||"unknown";
    console.error("APPLICATION CHANNEL CREATE FAILED:",{code,status,message:e?.message||String(e),botHighestRole:botMember.roles.highest?.name,botHighestRolePosition:botMember.roles.highest?.position});
    throw new Error("Discord denied application channel creation | code="+code+" | status="+status+" | message="+(e?.message||String(e)));
  }

  const typeName=TYPES[type]||"Application";
  const reviewEmbed=new EmbedBuilder()
    .setTitle("📋 Brandon Books & Stories Application")
    .setDescription(
      "**Type:** "+typeName+
      "\n**Applicant:** "+i.user.tag+
      "\n\n**Why are you applying?**\n"+answers.why+
      "\n\n**Relevant experience:**\n"+answers.experience+
      "\n\n**Availability:**\n"+answers.availability+
      "\n\n**Additional information:**\n"+answers.extra
    )
    .setColor(0x5865F2)
    .setFooter({text:"Brandon Books & Stories • Staff Review"});

  await channel.send({
    embeds:[reviewEmbed],
    components:[new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("application-approve:"+i.user.id).setLabel("Approve").setStyle(ButtonStyle.Success).setEmoji("✅"),
      new ButtonBuilder().setCustomId("application-reject:"+i.user.id).setLabel("Reject").setStyle(ButtonStyle.Danger).setEmoji("❌")
    )]
  });

  await logStaffEvent(i.guild,"📋 New Application","**Applicant:** <@"+i.user.id+">\n**Type:** "+typeName+"\n**Channel:** <#"+channel.id+">",0x5865F2);\n  return {channel};
}

async function handleApplicationReview(i){
  if(!i.isButton())return false;
  const approve=i.customId.startsWith("application-approve:");
  const reject=i.customId.startsWith("application-reject:");
  if(!approve&&!reject)return false;

  if(!i.guild){
    await i.reply({content:"This action can only be used inside the server.",flags:MessageFlags.Ephemeral});
    return true;
  }
  if(!isStaffReviewer(i)){
    await i.reply({content:"🔒 Only authorized staff can review applications.",flags:MessageFlags.Ephemeral});
    return true;
  }

  const applicantId=i.customId.split(":")[1];
  const status=approve?"Approved":"Rejected";
  const typeName=(i.message.embeds?.[0]?.description||"").match(/\*\*Type:\*\* ([^\n]+)/)?.[1]||"Application";
  const updated=EmbedBuilder.from(i.message.embeds?.[0]||{}).setColor(approve?0x57F287:0xED4245).setFooter({text:"Brandon Books & Stories • "+status});

  await i.update({embeds:[updated],components:[]});\n  await logStaffEvent(i.guild,"📋 Application "+status,"**Applicant:** <@"+applicantId+">\n**Reviewed by:** <@"+i.user.id+">\n**Type:** "+typeName,approve?0x57F287:0xED4245);

  const applicant=await i.client.users.fetch(applicantId).catch(()=>null);
  if(applicant){
    await applicant.send({
      embeds:[new EmbedBuilder()
        .setTitle((approve?"✅":"❌")+" Application "+status)
        .setDescription("Your **"+typeName+"** application has been **"+status.toLowerCase()+"** by the Brandon Books & Stories staff team.\n\nIf you have questions, please contact the community staff.")
        .addFields({name:"Application Type",value:typeName,inline:true},{name:"Status",value:status,inline:true})
        .setFooter({text:"📖 Real Stories • Bigger Purpose"})]
    }).catch(()=>{});
  }
  return true;
}

async function handleApplicationInteraction(i){
  if(await handleApplicationReview(i))return true;

  if(i.isButton()&&i.customId.startsWith("application-cancel:")){
    await i.update({
      embeds:[new EmbedBuilder()
        .setTitle("❌ Application Cancelled")
        .setDescription("Your application has been cancelled. Nothing was submitted.\n\nYou can return to the Brandon Books & Stories server and use /apply whenever you're ready.")
        .setFooter({text:"📖 Real Stories • Bigger Purpose"})],
      components:[]
    });
    return true;
  }

  if(i.isButton()&&i.customId.startsWith("application-start:")){
    const parts=i.customId.split(":");
    await i.showModal(buildApplicationModal(parts[1],parts[2]));
    return true;
  }

  if(i.isStringSelectMenu()&&i.customId==="apply-type"){
    if(!i.guild){
      await i.reply({content:"This application can only be started inside the server.",flags:MessageFlags.Ephemeral});
      return true;
    }

    const type=i.values[0];
    const typeName=TYPES[type]||"Application";

    // Acknowledge first. DM sending can take longer than Discord's interaction window.
    await i.deferReply({flags:MessageFlags.Ephemeral});

    const welcome=new EmbedBuilder()
      .setTitle("👋 Welcome to Your Application")
      .setDescription("Thanks for your interest in **Brandon Books & Stories**!\n\nYou selected the **"+typeName+"** application. Your answers will be reviewed privately by the community staff team.\n\nWhen you're ready, select **Start Application** below. If you change your mind, you can **Cancel Application** without submitting anything.")
      .addFields({name:"Application Type",value:typeName,inline:true},{name:"Status",value:"🟡 Ready to begin",inline:true})
      .setFooter({text:"📖 Real Stories • Bigger Purpose"});

    const dm=await sendApplicationDM(i.user,welcome,[applicationControlRow(i.guild.id,type)]);
    await i.editReply(dm.ok
      ?"📩 **Application Started**\n\nCheck your Discord direct messages for the private application welcome message.\n\n**Type:** "+typeName+"\n**Status:** 🟡 Ready to begin\n\nSelect **Start Application** in your DM when you're ready."
      :"❌ I couldn't send you a DM. Please enable direct messages for this server and try /apply again."
    );
    return true;
  }

  if(i.isModalSubmit()&&i.customId.startsWith("apply-modal:")){
    // Acknowledge immediately. Everything after this can safely take longer.
    await i.deferReply({flags:MessageFlags.Ephemeral});

    const parts=i.customId.split(":");
    const guildId=parts[1];
    const type=parts[2];
    const typeName=TYPES[type]||"Application";

    const answers={
      why:i.fields.getTextInputValue("why"),
      experience:i.fields.getTextInputValue("experience"),
      availability:i.fields.getTextInputValue("availability"),
      extra:i.fields.getTextInputValue("extra")||"None provided."
    };

    const guild=await i.client.guilds.fetch(guildId).catch(()=>null);
    if(!guild){
      await i.editReply("❌ Application submission failed: the Brandon Books & Stories server could not be found.");
      return true;
    }

    try{
      const result=await createApplicationChannel({...i,guild},type,answers);

      if(result.existing){
        const dm=await sendApplicationDM(i.user,
          new EmbedBuilder()
            .setTitle("📋 Application Already Open")
            .setDescription("You already have an open **"+typeName+"** application.")
            .addFields({name:"Status",value:"🟡 Awaiting staff review",inline:true},{name:"Application",value:"<#"+result.existing.id+">",inline:true})
            .setFooter({text:"📖 Real Stories • Bigger Purpose"})
        );
        await i.editReply("📋 You already have an open application: <#"+result.existing.id+">"+(dm.ok?"":"\n⚠️ I couldn't update your DM."));
        return true;
      }

      const dm=await sendApplicationDM(i.user,
        new EmbedBuilder()
          .setTitle("✅ Application Submitted")
          .setDescription("Your **"+typeName+"** application has been submitted privately to the Brandon Books & Stories staff team.")
          .addFields({name:"Application Type",value:typeName,inline:true},{name:"Status",value:"🟡 Awaiting staff review",inline:true})
          .setFooter({text:"📖 Real Stories • Bigger Purpose"})
      );

      await i.editReply("✅ **Application Submitted**\n\nYour application has been sent privately to the Brandon Books & Stories staff team.\n\n**Type:** "+typeName+"\n**Status:** 🟡 Awaiting staff review\n\nYou will receive a Discord DM when staff makes a decision."+(!dm.ok?"\n\n⚠️ Your application was submitted, but I couldn't send the confirmation DM.":""));
      return true;
    }catch(e){
      console.error("APPLICATION FAILED:",e);
      await i.editReply("❌ Application submission failed: "+(e?.message||String(e)));
      return true;
    }
  }

  return false;
}

module.exports={applicationMenu,handleApplicationInteraction};
