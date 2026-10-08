const repo="dospatch/brandon-books-stories-bot";
const list=document.getElementById("changelog-list");
const statusText=document.querySelector(".live-status small");

function categoryFor(message){
  const m=message.toLowerCase();
  if(/add|create|build|introduce|new|publish|launch/.test(m)) return ["Added","✨"];
  if(/improv|enhanc|harden|strengthen|refin|consolidat|repair|fix|correct/.test(m)) return ["Improved","🔧"];
  if(/change|update|rename|move|switch|replace|rework|rebuild/.test(m)) return ["Changed","🛠️"];
  return ["Updated","📋"];
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
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
    groups[key].push({
      category,
      icon,
      subject:(commit.commit.message||"").split("\n")[0],
      sha:commit.sha.slice(0,7),
      url:commit.html_url,
      author:commit.author?.login||commit.commit.author?.name||"GitHub",
      date
    });
  }

  list.innerHTML=Object.entries(groups).map(([date,items])=>`
    <section class="changelog-day">
      <div class="changelog-date">${escapeHtml(date)}</div>
      <div class="changelog-items">
        ${items.map(item=>`
          <article class="changelog-item">
            <div class="changelog-icon">${item.icon}</div>
            <div class="changelog-item-body">
              <span class="change-type">${item.category}</span>
              <h3>${escapeHtml(item.subject)}</h3>
              <p class="changelog-meta">by ${escapeHtml(item.author)}</p>
              <a href="${item.url}" target="_blank" rel="noopener">Commit ${item.sha} →</a>
            </div>
          </article>`).join("")}
      </div>
    </section>`).join("");

  if(statusText){
    statusText.textContent="Live from GitHub • Refreshed "+new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
  }
}

async function loadChangelog(){
  try{
    const response=await fetch(`https://api.github.com/repos/${repo}/commits?per_page=50&ts=${Date.now()}`,{
      headers:{"Accept":"application/vnd.github+json"},
      cache:"no-store"
    });

    if(!response.ok)throw new Error("GitHub returned "+response.status);
    const commits=await response.json();
    render(commits);
  }catch(error){
    console.error("CHANGELOG LOAD ERROR:",error);
    if(!list.dataset.loaded){
      list.innerHTML='<div class="loading-card">The live update history is temporarily unavailable. Please check the project on GitHub.</div>';
    }
  }
  list.dataset.loaded="true";
}

loadChangelog();

// Keep the public changelog fresh while the page is open.
setInterval(loadChangelog,5*60*1000);

// Refresh immediately when the visitor returns to the tab.
document.addEventListener("visibilitychange",()=>{
  if(!document.hidden)loadChangelog();
});
