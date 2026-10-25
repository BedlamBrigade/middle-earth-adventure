import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const el = id => document.getElementById(id);
const output = el('fellowshipMessage');
const show = (message, failed=false) => { output.textContent = message; output.style.color = failed ? '#ffb8a9' : '#e5c87e'; };
const groupArea = el('fellowshipGroupArea');
const authArea = el('fellowshipAuthArea');
const groupSetup = el('fellowshipSetupArea');
const joinArea = el('fellowshipJoinArea');
const state = { user:null, db:null, auth:null, groupId:null, group:null, member:null, members:[], entries:[], unsubscribe:[], busy:false };
const inviteId = new URL(location.href).searchParams.get('fellowship');
const today = () => { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
el('fellowshipDate').value = today();
const validSteps = n => Number.isInteger(n) && n>=1 && n<=100000;
const buttonBusy = async (button, work) => {
  if(state.busy) return;
  state.busy=true;button.disabled=true;
  try { await work(); } catch(error) { console.error(error); show(error.message || 'Action failed',true); }
  finally { button.disabled=false;state.busy=false; }
};
function detach(){for(const u of state.unsubscribe)u();state.unsubscribe=[];state.groupId=null;state.group=null;state.member=null;state.members=[];state.entries=[];}
function render(){
  const signedIn=!!state.user;
  authArea.hidden=signedIn;
  el('fellowshipSignedIn').hidden=!signedIn;
  el('fellowshipSignedIn').textContent=signedIn?'Signed in: '+state.user.email:'';
  groupSetup.hidden=!signedIn || !!state.groupId || !!inviteId;
  joinArea.hidden=!signedIn || !!state.groupId || !inviteId;
  groupArea.hidden=!signedIn || !state.member;
  if(!state.member)return;
  el('fellowshipGroupName').textContent=state.group.name;
  el('fellowshipGroupMode').textContent=state.group.mode==='cooperative'?'Shared journey':'Race to Mount Doom';
  const byMember=new Map(state.members.map(m=>[m.uid,{name:m.name,uid:m.uid,steps:0}]));
  for(const e of state.entries){ const member=byMember.get(e.uid);if(member)member.steps+=e.steps; }
  const standings=[...byMember.values()].sort((a,b)=>b.steps-a.steps);
  const sum=standings.reduce((total,m)=>total+m.steps,0), miles=sum/2000;
  el('fellowshipMainStat').textContent=state.group.mode==='cooperative'
    ? miles.toFixed(1)+' of 1,779 miles together'
    : (byMember.get(state.user.uid)?.steps/2000||0).toFixed(1)+' of 1,779 personal miles';
  const progress=state.group.mode==='cooperative' ? miles : (byMember.get(state.user.uid)?.steps||0)/2000;
  el('fellowshipProgress').style.width=(Math.min(progress/1779,1)*100).toFixed(2)+'%';
  el('fellowshipSummary').textContent=state.group.mode==='cooperative'
    ? standings.length+' members · '+(progress/1779*100).toFixed(1)+'% to Mount Doom'
    : standings.length+' racers · first to 1,779 miles wins';
  const list=el('fellowshipLeaderboard');list.replaceChildren();
  standings.forEach((m,i)=>{const row=document.createElement('div');row.className='entry row';
    const label=document.createElement('span');label.textContent=(i+1)+'. '+m.name+(m.uid===state.user.uid?' (you)':'');
    const value=document.createElement('strong');value.textContent=(m.steps/2000).toFixed(2)+' mi';row.append(label,value);list.append(row);
  });
  el('fellowshipLogCount').textContent=state.entries.length+' recorded entries';
  const manage=el('fellowshipManage');manage.replaceChildren();
  if(state.group.ownerUid===state.user.uid){
    for(const m of standings.filter(x=>x.uid!==state.user.uid)){
      const row=document.createElement('div');row.className='entry row';
      const name=document.createElement('span');name.textContent=m.name;
      const remove=document.createElement('button');remove.className='secondary';remove.textContent='Remove';
      remove.onclick=()=>buttonBusy(remove,async()=>{
        if(!confirm('Remove '+m.name+'? Their past entries will remain.'))return;
        await (await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')).deleteDoc(doc(state.db,'fellowships',state.groupId,'members',m.uid));
        show('Member removed');
      });row.append(name,remove);manage.append(row);
    }
  }
}
async function loadGroup(gid){
  detach();const ref=doc(state.db,'fellowships',gid);const found=await getDoc(ref);
  if(!found.exists()){show('That Fellowship does not exist.',true);render();return;}
  const memberRef=doc(state.db,'fellowships',gid,'members',state.user.uid);
  const member=await getDoc(memberRef);
  state.groupId=gid;state.group=found.data();
  if(!member.exists()){el('joinGroupName').textContent=state.group.name+' — '+state.group.mode;render();return;}
  state.member=member.data();
  state.unsubscribe.push(onSnapshot(collection(state.db,'fellowships',gid,'members'), snap=>{
    state.members=snap.docs.map(d=>d.data());
    if(!state.members.some(m=>m.uid===state.user.uid)){show('You have been removed from this Fellowship.',true);detach();render();return;}
    render();
  },e=>show('Members sync failed: '+e.message,true)));
  state.unsubscribe.push(onSnapshot(collection(state.db,'fellowships',gid,'entries'), snap=>{
    state.entries=snap.docs.map(d=>d.data());render();
  },e=>show('Progress sync failed: '+e.message,true)));
  render();show('Fellowship ready — progress syncs online.');
}
async function findMyGroup(){
  if(inviteId){await loadGroup(inviteId);return;}
  // Firestore rules intentionally prohibit listing every group. Restore the last opened
  // group on this device, or paste an invite link to another group.
  const remembered=localStorage.getItem('middleEarth.lastFellowship.'+state.user.uid);
  if(remembered)await loadGroup(remembered);
  else{detach();render();}
}
if(!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('REPLACE_')){
  authArea.hidden=true;groupSetup.hidden=true;joinArea.hidden=true;groupArea.hidden=true;
  show('Fellowship Mode needs Firebase setup. See FELLOWSHIP_SETUP.md in the GitHub repository.',true);
}else{
  const app=initializeApp(firebaseConfig);state.auth=getAuth(app);state.db=getFirestore(app);
  onAuthStateChanged(state.auth,async user=>{
    detach();state.user=user;render();show(user?'Signed in.':'Sign in or create an account to play together.');
    if(user){try{await findMyGroup();}catch(e){show('Unable to load Fellowship: '+e.message,true);}}
  });
}
el('fellowshipRegister').onclick=()=>buttonBusy(el('fellowshipRegister'),async()=>{
  const email=el('fellowshipEmail').value.trim(),password=el('fellowshipPassword').value;
  if(password.length<6)throw Error('Use a password with at least 6 characters.');
  await createUserWithEmailAndPassword(state.auth,email,password);
  el('fellowshipPassword').value='';show('Account created.');
});
el('fellowshipLogin').onclick=()=>buttonBusy(el('fellowshipLogin'),async()=>{
  await signInWithEmailAndPassword(state.auth,el('fellowshipEmail').value.trim(),el('fellowshipPassword').value);
  el('fellowshipPassword').value='';show('Signed in.');
});
el('fellowshipLogout').onclick=()=>buttonBusy(el('fellowshipLogout'),async()=>{await signOut(state.auth);show('Signed out.');});
el('fellowshipCreate').onclick=()=>buttonBusy(el('fellowshipCreate'),async()=>{
  const name=el('fellowshipNewName').value.trim().slice(0,40),nickname=el('fellowshipNickname').value.trim().slice(0,40);
  if(!name||!nickname)throw Error('Enter a group name and your hero name.');
  const groupRef=doc(collection(state.db,'fellowships'));
  await setDoc(groupRef,{name,mode:el('fellowshipNewMode').value,ownerUid:state.user.uid,createdAt:serverTimestamp()});
  await setDoc(doc(groupRef,'members',state.user.uid),{uid:state.user.uid,name:nickname,joinedAt:serverTimestamp()});
  localStorage.setItem('middleEarth.lastFellowship.'+state.user.uid,groupRef.id);
  await loadGroup(groupRef.id);show('Fellowship created! Copy the invite link to invite friends.');
});
el('fellowshipJoin').onclick=()=>buttonBusy(el('fellowshipJoin'),async()=>{
  if(!inviteId||!state.group)throw Error('Open a valid invite link first.');
  const name=el('fellowshipJoinName').value.trim().slice(0,40);
  if(!name)throw Error('Enter your adventurer name.');
  await setDoc(doc(state.db,'fellowships',inviteId,'members',state.user.uid),
    {uid:state.user.uid,name,joinedAt:serverTimestamp()});
  localStorage.setItem('middleEarth.lastFellowship.'+state.user.uid,inviteId);
  await loadGroup(inviteId);show('Welcome to the Fellowship!');
});
el('fellowshipAdd').onclick=()=>buttonBusy(el('fellowshipAdd'),async()=>{
  const n=Number(el('fellowshipSteps').value),date=el('fellowshipDate').value;
  if(!validSteps(n)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))throw Error('Enter a date and 1–100,000 whole steps.');
  if(!state.member)throw Error('Join a Fellowship first.');
  await addDoc(collection(state.db,'fellowships',state.groupId,'entries'),
    {uid:state.user.uid,steps:n,date,createdAt:serverTimestamp()});
  el('fellowshipSteps').value='';show(n.toLocaleString()+' Fellowship steps saved online.');
});
el('fellowshipCopy').onclick=async()=>{
  const url=new URL(location.href);url.searchParams.set('fellowship',state.groupId);
  try{await navigator.clipboard.writeText(url.href);show('Invite link copied. Share it with your team.');}
  catch{window.prompt('Copy this invite link:',url.href);}
};
el('fellowshipLeave').onclick=()=>buttonBusy(el('fellowshipLeave'),async()=>{
  if(state.group.ownerUid===state.user.uid)throw Error('The Fellowship founder cannot leave this version.');
  if(!confirm('Leave this Fellowship? Past walking logs remain.'))return;
  const {deleteDoc}=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
  await deleteDoc(doc(state.db,'fellowships',state.groupId,'members',state.user.uid));
  localStorage.removeItem('middleEarth.lastFellowship.'+state.user.uid);
  detach();render();show('You left the Fellowship.');
});
el('fellowshipSwitch').onclick=()=>{
  const link=prompt('Paste another Fellowship invite link:');
  if(!link)return;
  try{const u=new URL(link);const id=u.searchParams.get('fellowship');if(!id||!u.hostname.endsWith('github.io'))throw Error();location.href=u.pathname+'?fellowship='+encodeURIComponent(id);}
  catch{show('Please paste a valid GitHub Pages Fellowship invite URL.',true);}
};
