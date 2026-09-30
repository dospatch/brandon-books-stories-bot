const repo="dospatch/brandon-books-stories-bot";
const list=document.getElementById("changelog-list");

function categoryFor(message){
  const m=message.toLowerCase();
  if(/add|create|build|introduce|new/.test(m)) return ["Added","✨"];
  if(/improv|enhanc|harden|strengthen|refin|consolidat|repair|fix|correct/.test(m)) return ["Improved","🔧"];
  if(/change|update|rename|move|switch|replace|rework|rebuild/.test(m)) return ["Changed","🛠️"];
  return ["Updated","📋"];
}

function escapeHtml(value){
  return value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}

function render(commits){
  if(!commits.length){
    list.innerHTML='<div class="loading-card">No public updates were found yet.</div>';
    return;
  }
  const groups={};
  for(const commit of commits){
    const date=new Date(commit.commit.author?.date||commit.commit.committer?.date||Date.now());
    const key=date.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
    const [category,icon]=categoryFor(commit.commit.message||"");
    if(!groups[key])groups[key]=[];
    groups[key].push({category,icon,subject:(commit.commit.message||"").split("\n")[0],sha:commit.sha.slice(0,7),url:commit.html_url});
  }
  list.innerHTML=Object.entries(groups).map(([date,items])=>`
    <section class="changelog-day">
      <div class="changelog-date">${date}</div>
      <div class="changelog-items">
        ${items.map(item=>`
          <article class="changelog-item">
            <div class="changelog-icon">${item.icon}</div>
            <div class="changelog-item-body">
              <span class="change-type">${item.category}</span>
              <h3>${escapeHtml(item.subject)}</h3>
              <a href="${item.url}" target="_blank" rel="noopener">Commit ${item.sha} →</a>
            </div>
          </article>`).join("")}
      </div>
    </section>`).join("");
}

fetch(`https://api.github.com/repos/${repo}/commits?per_page=30`,{headers:{"Accept":"application/vnd.github+json"}})
  .then(response=>{if(!response.ok)throw new Error("GitHub returned "+response.status);return response.json();})
  .then(render)
  .catch(error=>{
    console.error(error);
    list.innerHTML='<div class="loading-card">The live update history is temporarily unavailable. Please check the project on GitHub.</div>';
  });