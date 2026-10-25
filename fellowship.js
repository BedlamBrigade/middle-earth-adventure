import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getFirestore,doc,collection,getDoc,setDoc,deleteDoc,onSnapshot,serverTimestamp,writeBatch} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

const el=id=>document.getElementById(id);
const message=el('fellowshipMessage');
const say=(s,bad=false)=>{message.textContent=s;message.style.color=bad?'#ffb8a9':'#e5c87e'};
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const invitation=new URL(location.href).searchParams.get('fellowship');
const PENDING_KEY='middleEarth.pendingUploads.v1';
let auth,db;
let signedUser=null,groupIds=[],groups=new Map(),selected=null,active={},cleanup=[],profileUnsub=null,processing=false;
const pending=()=>{try{return JSON.parse(localStorage.getItem(PENDING_KEY)||'[]')}catch{return []}};
const persistQueue=q=>localStorage.setItem(PENDING_KEY,JSON.stringify(q));
const userDoc=()=>doc(db,'profiles',signedUser.uid);
function clearListeners(){cleanup.forEach(u=>u());cleanup=[];groups.clear();}
function groupSnapshots(id){
  const obj={id,meta:null,members:[],entries:[]};groups.set(id,obj);
  cleanup.push(onSnapshot(doc(db,'fellowships',id),s=>{obj.meta=s.exists()?s.data():null;render()},e=>say('Group loading error: '+e.message,true)));
  cleanup.push(onSnapshot(collection(db,'fellowships',id,'members'),s=>{obj.members=s.docs.map(x=>x.data());render()},e=>say('Members error: '+e.message,true)));
  cleanup.push(onSnapshot(collection(db,'fellowships',id,'entries'),s=>{obj.entries=s.docs.map(x=>x.data());render()},e=>say('Activity error: '+e.message,true)));
}
function activate(ids){
  const clean=[...new Set(ids)].slice(0,5);const changed=clean.join('|')!==groupIds.join('|');
  groupIds=clean;
  if(changed){clearListeners();clean.forEach(groupSnapshots);if(!clean.includes(selected))selected=clean[0]||null;}
  if(invitation && !clean.includes(invitation) && !active.invitationPrompted){active.invitationPrompted=true;loadInvitation(invitation)}
  render();flushPending();
}
async function loadInvitation(id){
  try{const s=await getDoc(doc(db,'fellowships',id));if(!s.exists())return say('Invitation not found.',true);
    active.inviteGroup={id,...s.data()};render();
  }catch(e){say('Invitation error: '+e.message,true)}
}
function cleanRow(node){node.replaceChildren();return node}
function line(parent,head,detail){
  const div=document.createElement('div');div.className='entry row';
  const a=document.createElement('span'),b=document.createElement('strong');a.textContent=head;b.textContent=detail;div.append(a,b);parent.append(div);return div;
}
function stats(g){
  const byId=new Map(g.members.map(m=>[m.uid,{...m,steps:0}]));
  for(const x of g.entries){if(!byId.has(x.uid))byId.set(x.uid,{uid:x.uid,name:'Former member',steps:0,former:true});byId.get(x.uid).steps+=x.steps;}
  const sorted=[...byId.values()].sort((a,b)=>b.steps-a.steps);
  const total=sorted.reduce((a,m)=>a+m.steps,0);
  const personal=byId.get(signedUser.uid)?.steps||0;
  const progress=g.meta?.mode==='race'?personal:total;
  return {sorted,total,personal,progress};
}
function render(){
  const connected=!!signedUser;
  el('fellowshipAuthArea').hidden=connected;
  el('fellowshipSignedIn').hidden=!connected;
  el('fellowshipLogout').hidden=!connected;
  el('fellowshipSignedIn').textContent=connected?'Signed in: '+signedUser.email:'';
  el('fellowshipSetupArea').hidden=!connected||groupIds.length>=5;
  const join=el('fellowshipJoinArea');
  join.hidden=!connected||!active.inviteGroup||groupIds.includes(active.inviteGroup?.id)||groupIds.length>=5;
  if(active.inviteGroup)el('joinGroupName').textContent=active.inviteGroup.name+' — '+active.inviteGroup.mode;
  el('fellowshipGroupArea').hidden=!connected||!selected||!groups.get(selected)?.meta;
  el('fellowshipGroupCount').textContent=connected?groupIds.length+' of 5 active Fellowships':'Sign in to view your Fellowships';
  const chooser=cleanRow(el('fellowshipGroupPicker'));
  const panel=cleanRow(el('journeyFellowships'));
  if(!connected){panel.textContent='Sign in on the Fellowship tab to show shared journeys here.';return;}
  if(!groupIds.length)panel.textContent='No Fellowships joined yet. Create or join one on the Fellowship tab.';
  for(const id of groupIds){
    const g=groups.get(id);if(!g?.meta)continue;
    const s=stats(g),mode=g.meta.mode==='race'?'Race':'Together';
    const b=document.createElement('button');b.textContent=g.meta.name+(id===selected?' ✓':'');b.className='secondary';
    b.onclick=()=>{selected=id;render()};chooser.append(b);
    const card=document.createElement('div');card.className='entry';const title=document.createElement('strong');
    title.textContent=g.meta.name+' · '+mode;const detail=document.createElement('p');
    detail.textContent=(s.progress/2000).toFixed(1)+' / 1,779 mi · '+Math.min(100,s.progress/2000/1779*100).toFixed(1)+'%';
    const bar=document.createElement('div');bar.className='bar';const fill=document.createElement('div');
    fill.style.width=Math.min(100,s.progress/2000/1779*100)+'%';bar.append(fill);card.append(title,detail,bar);panel.append(card);
  }
  const g=groups.get(selected);
  if(!g?.meta)return;
  const st=stats(g),progressMiles=st.progress/2000;
  el('fellowshipGroupName').textContent=g.meta.name;
  el('fellowshipGroupMode').textContent=g.meta.mode==='race'?'Race to Mount Doom':'Shared journey';
  el('fellowshipMainStat').textContent=progressMiles.toFixed(1)+' / 1,779 miles';
  el('fellowshipProgress').style.width=Math.min(progressMiles/1779*100,100)+'%';
  el('fellowshipSummary').textContent=g.meta.mode==='race'
    ?st.sorted.length+' racers · Your miles count toward your own finish'
    :st.sorted.length+' adventurers · All members contribute';
  const ranks=cleanRow(el('fellowshipLeaderboard'));
  st.sorted.forEach((m,i)=>line(ranks,(i+1)+'. '+m.name+(m.uid===signedUser.uid?' (you)':''),(m.steps/2000).toFixed(2)+' mi'));
  const history=cleanRow(el('fellowshipActivity'));
  [...g.entries].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
    .slice(0,100).forEach(e=>{
      const person=st.sorted.find(m=>m.uid===e.uid)?.name||'Former member';
      line(history,e.date+' · '+person,e.steps.toLocaleString()+' steps');
    });
  if(!g.entries.length)history.textContent='No Fellowship steps logged yet.';
  el('fellowshipLogCount').textContent=g.entries.length+' individual entries · newest 100 shown';
  const manage=cleanRow(el('fellowshipManage'));
  if(g.meta.ownerUid===signedUser.uid)for(const member of st.sorted.filter(m=>m.uid!==signedUser.uid&&!m.former)){
    const row=line(manage,member.name,'');
    const remove=document.createElement('button');remove.className='secondary';remove.textContent='Remove';
    remove.onclick=async()=>{if(!confirm('Remove '+member.name+'? Past entries stay.'))return;
      try{await deleteDoc(doc(db,'fellowships',selected,'members',member.uid));say('Member removed. They must update their group list on their next visit.')}catch(e){say(e.message,true)}
    };row.lastChild.replaceWith(remove);
  }
  el('fellowshipLeave').disabled=g.meta.ownerUid===signedUser.uid;
}
async function updateMembership(id,joining,createMeta=null,nickname=null){
  if(!signedUser)throw Error('Sign in first.');
  const next=joining?[...new Set([...groupIds,id])]:groupIds.filter(x=>x!==id);
  if(next.length>5)throw Error('Maximum five journeys. Leave one first.');
  const batch=writeBatch(db);
  if(createMeta)batch.set(doc(db,'fellowships',id),createMeta);
  if(joining)batch.set(doc(db,'fellowships',id,'members',signedUser.uid),{uid:signedUser.uid,name:nickname,joinedAt:serverTimestamp()});
  else batch.delete(doc(db,'fellowships',id,'members',signedUser.uid));
  batch.set(userDoc(),{groupIds:next,updatedAt:serverTimestamp()});
  await batch.commit();
  activate(next);selected=id===selected&&!joining?next[0]||null:joining?id:selected;
}
const withButton=(id,fn)=>{el(id).onclick=async()=>{const button=el(id);button.disabled=true;try{await fn()}catch(e){console.error(e);say(e.message||'Operation failed',true)}finally{button.disabled=false}}};
function queueLog(date,steps){
  if(!signedUser||!groupIds.length)return;
  const entry={id:crypto.randomUUID(),uid:signedUser.uid,date,steps,groupIds:[...groupIds]};
  const q=pending();q.push(entry);persistQueue(q);
  say('Solo steps saved. Uploading to '+entry.groupIds.length+' Fellowships…');
  flushPending();
}
async function flushPending(){
  if(processing||!signedUser||!navigator.onLine)return;
  processing=true;
  try{
    let q=pending();
    for(const item of q.filter(e=>e.uid===signedUser.uid)){
      for(const id of [...item.groupIds]){
        try{
          const ref=doc(db,'fellowships',id,'entries',item.id);
          const exists=await getDoc(ref);
          if(!exists.exists())await setDoc(ref,{uid:item.uid,date:item.date,steps:item.steps,createdAt:serverTimestamp()});
          item.groupIds=item.groupIds.filter(x=>x!==id);persistQueue(q);
        }catch(e){console.error('Group upload failed',id,e)}
      }
    }
    q=q.filter(item=>item.groupIds.length);persistQueue(q);
    const own=q.filter(x=>x.uid===signedUser.uid);
    say(own.length?'Saved locally; '+own.length+' log(s) still awaiting upload.':'All pending Fellowship steps synchronized.',!!own.length);
  }finally{processing=false}
}
window.addEventListener('online',flushPending);
window.addEventListener('middleEarth:stepsLogged',e=>queueLog(e.detail.date,e.detail.steps));
el('fellowshipDate').value=today();
withButton('fellowshipRegister',async()=>{
  const p=el('fellowshipPassword').value;
  if(p.length<6)throw Error('Use a password of at least six characters.');
  await createUserWithEmailAndPassword(auth,el('fellowshipEmail').value.trim(),p);
  el('fellowshipPassword').value='';
});
withButton('fellowshipLogin',async()=>{
  await signInWithEmailAndPassword(auth,el('fellowshipEmail').value.trim(),el('fellowshipPassword').value);
  el('fellowshipPassword').value='';
});
withButton('fellowshipLogout',()=>signOut(auth));
withButton('fellowshipCreate',async()=>{
  const name=el('fellowshipNewName').value.trim().slice(0,40),nickname=el('fellowshipNickname').value.trim().slice(0,40);
  if(!name||!nickname)throw Error('Enter a Fellowship name and hero name.');
  const id=doc(collection(db,'fellowships')).id;
  await updateMembership(id,true,{name,mode:el('fellowshipNewMode').value,ownerUid:signedUser.uid,createdAt:serverTimestamp()},nickname);
  say('Fellowship created. Copy its invitation link to invite a friend.');
});
withButton('fellowshipJoin',async()=>{
  const name=el('fellowshipJoinName').value.trim().slice(0,40);
  if(!name||!active.inviteGroup)throw Error('Enter your hero name and use a valid invite.');
  await updateMembership(active.inviteGroup.id,true,null,name);
  active.inviteGroup=null;say('Fellowship joined!');
});
withButton('fellowshipAdd',async()=>{
  const n=Number(el('fellowshipSteps').value),date=el('fellowshipDate').value;
  if(!Number.isInteger(n)||n<1||n>100000||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))throw Error('Enter a date and 1–100,000 whole steps.');
  // Use the original solo journal as the single source for manual step submissions.
  el('date').value=date;el('steps').value=String(n);el('addSteps').click();
  el('fellowshipSteps').value='';say('Steps added to your solo journey; all joined Fellowships will synchronize.');
});
withButton('fellowshipCopy',async()=>{
  const url=new URL(location.href);url.searchParams.delete('utm_source');url.searchParams.set('fellowship',selected);
  try{await navigator.clipboard.writeText(url.href);say('Invitation link copied!')}catch{prompt('Copy invitation:',url.href)}
});
withButton('fellowshipLeave',async()=>{
  const g=groups.get(selected);if(!g)throw Error('Select a group.');
  if(g.meta?.ownerUid===signedUser.uid)throw Error('Founders cannot leave their own group in this version.');
  if(!confirm('Leave '+g.meta.name+'? Your previous steps stay in that Fellowship.'))return;
  await updateMembership(selected,false);say('Left Fellowship.');
});
el('fellowshipSwitch').onclick=()=>{
  const value=prompt('Paste your invitation link:');if(!value)return;
  try{const u=new URL(value);if(u.origin!==location.origin||!u.searchParams.get('fellowship'))throw Error();
    location.href=u.pathname+'?fellowship='+encodeURIComponent(u.searchParams.get('fellowship'));
  }catch{say('Please paste a valid invitation link for this site.',true)}
};
if(firebaseConfig.apiKey.startsWith('REPLACE_')){
  say('Firebase is not configured yet.',true);
}else{
  const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
  onAuthStateChanged(auth,user=>{
    if(profileUnsub)profileUnsub();profileUnsub=null;clearListeners();
    signedUser=user;groupIds=[];selected=null;active={};
    if(!user){render();say('Sign in to use Fellowship Mode.');return}
    profileUnsub=onSnapshot(userDoc(),s=>activate(s.exists()?(s.data().groupIds||[]):[]),e=>say('Profile sync error: '+e.message,true));
    render();
  });
}
