const cfg=window.ABILITY_FIREBASE_CONFIG;
const status=document.getElementById('authStatus');
if(cfg?.apiKey&&cfg?.projectId){
try{
 const [{initializeApp},{getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult,signOut,onAuthStateChanged},{getFirestore,doc,setDoc,getDoc,deleteDoc,collection,query,where,getDocs,onSnapshot,updateDoc,addDoc,serverTimestamp,limit,orderBy}]=await Promise.all([import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')]);
 const app=initializeApp(cfg),auth=getAuth(app),db=getFirestore(app);let me=null,unsubs=[],chatStop=null,battleStop=null,roomId=null,previewStops=[];const $=id=>document.getElementById(id);
 const safeErr=e=>alert('通信エラー：'+(e?.message||e));
 const login=async()=>{try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){if(['auth/popup-blocked','auth/operation-not-supported-in-this-environment'].includes(e.code))await signInWithRedirect(auth,new GoogleAuthProvider());else safeErr(e)}};
 getRedirectResult(auth).catch(safeErr);
 const logout=async()=>{await signOut(auth);window.archiveUI?.notify?.('ログアウトしました')};
 const isLoggedIn=()=>!!me;
 const getToken=()=>me?.getIdToken();
 const getProfile=()=>window.archiveUI.getProfile();
 const getEntries=()=>window.archiveUI.getEntries();
 const myName=()=>getProfile().name||me?.displayName||'プレイヤー';
 const userData=async uid=>(await getDoc(doc(db,'users',uid))).data()||{};
 const saveUser=async()=>{if(!me)return;const p=getProfile();await setDoc(doc(db,'users',me.uid),{uid:me.uid,displayName:p.name||me.displayName||'プレイヤー',bio:p.bio||'',updatedAt:serverTimestamp()},{merge:true})};
 const requireLogin=()=>{if(!me)throw Error('Googleログインが必要です')};
 const friends=async()=>{requireLogin();const snap=await getDocs(query(collection(db,'friendships'),where('members','array-contains',me.uid)));return snap.docs.map(d=>d.data().members.find(id=>id!==me.uid)).filter(Boolean)};
 const syncNow=async()=>{requireLogin();const chars=getEntries();const data=chars.map(c=>({...c,image:c.image?.length>180000?'':(c.image||'')}));await setDoc(doc(db,'privateData',me.uid),{owner:me.uid,characters:data,history:JSON.parse(localStorage.getItem('ability_archive_battles_v1')||'[]'),updatedAt:serverTimestamp()},{merge:true});$('syncStatus').textContent='同期しました：'+new Date().toLocaleString('ja-JP')};
 const publishCharacters=async()=>{requireLogin();const publicSnap=await getDocs(query(collection(db,'characters'),where('owner','==',me.uid),where('visibility','==','public')));const friendSnap=await getDocs(query(collection(db,'characters'),where('owner','==',me.uid),where('visibility','==','friends')));const snap={docs:[...publicSnap.docs,...friendSnap.docs]};const existing=new Map(snap.docs.map(d=>[d.id,d.data()]));const allowed=getEntries().filter(c=>c.visibility==='public'||c.visibility==='friends');const ids=new Set(allowed.map(c=>me.uid+'_'+c.id));for(const [id] of existing)if(!ids.has(id))await deleteDoc(doc(db,'characters',id));for(const c of allowed){const {image,...rest}=c;await setDoc(doc(db,'characters',me.uid+'_'+c.id),{...rest,image:image?.length<180000?image:'',owner:me.uid,ownerName:myName(),visibility:c.visibility,updatedAt:serverTimestamp()})}};
 const loadCloud=async()=>{if(!me)return;const snap=await getDoc(doc(db,'privateData',me.uid));if(!snap.exists())return;const cloud=snap.data(),local=getEntries();if(!local.length&&Array.isArray(cloud.characters)){local.splice(0,local.length,...cloud.characters);localStorage.setItem('ability_archive_v1',JSON.stringify(local));window.archiveUI.renderProfileCharacters();window.archiveUI.renderBattleChoices();window.archiveUI.notify('クラウドのキャラクターを復元しました')}if(!localStorage.getItem('ability_archive_battles_v1')&&Array.isArray(cloud.history))localStorage.setItem('ability_archive_battles_v1',JSON.stringify(cloud.history))};
 const searchUsers=async name=>{requireLogin();const root=$('friendResults');root.replaceChildren();name=name.trim();if(!name)return;const snap=await getDocs(query(collection(db,'users'),where('displayName','>=',name),where('displayName','<=',name+'\uf8ff'),limit(30)));for(const d of snap.docs){if(d.id===me.uid)continue;const row=document.createElement('div');row.className='entry';row.textContent=d.data().displayName+' ('+d.id.slice(0,8)+') ';const btn=document.createElement('button');btn.className='secondary';btn.textContent='フレンド申請';btn.onclick=async()=>{try{await setDoc(doc(db,'requests',me.uid+'_'+d.id),{from:me.uid,to:d.id,status:'pending',createdAt:serverTimestamp()});window.archiveUI.notify('申請しました')}catch(e){safeErr(e)}};row.append(btn);const view=document.createElement('button');view.textContent='プロフィール';view.className='secondary';view.onclick=()=>viewProfile(d.id);row.append(view);root.append(row)}if(!root.children.length)root.textContent='見つかりませんでした'};
 const viewProfile=async uid=>{requireLogin();const u=await userData(uid);const allowed=uid===me.uid||await getDoc(doc(db,'friendships',[me.uid,uid].sort().join('_'))).then(d=>d.exists());const publicSnap=await getDocs(query(collection(db,'characters'),where('owner','==',uid),where('visibility','==','public')));let chars=publicSnap.docs.map(d=>d.data());if(allowed){const friendSnap=await getDocs(query(collection(db,'characters'),where('owner','==',uid),where('visibility','==','friends')));chars.push(...friendSnap.docs.map(d=>d.data()))}window.archiveEnhancements.renderProfile(u,chars);document.querySelector('[data-page="profile"]').click()};
 const randomCharacter=async()=>{requireLogin();const snap=await getDocs(query(collection(db,'characters'),where('visibility','==','public'),limit(100)));const chars=snap.docs.map(d=>d.data()).filter(c=>c.owner!==me.uid);return chars[Math.floor(Math.random()*chars.length)]||null};
 const publishPost=async(text,c)=>{requireLogin();if(text.length>3000)throw Error('3000文字以内にしてください');await addDoc(collection(db,'posts'),{author:me.uid,authorName:myName(),text,character:c?{id:c.id,name:c.name,ability:(c.ability||'').slice(0,500)}:null,createdAt:serverTimestamp()})};
 const sendChat=async(peer,text)=>{requireLogin();if(!peer||!text.trim())throw Error('フレンドとメッセージを入力してください');const room=[me.uid,peer].sort().join('_');if(!(await getDoc(doc(db,'friendships',room))).exists())throw Error('フレンドではありません');await addDoc(collection(db,'chats',room,'messages'),{from:me.uid,text:text.trim().slice(0,2000),createdAt:serverTimestamp()})};
 const joinBattle=async(id,characterId)=>{requireLogin();if(!id||!/^[a-zA-Z0-9_-]{5,40}$/.test(id))throw Error('ルームIDは英数字5〜40文字で入力してください');const char=getEntries().find(c=>c.id===characterId);if(!char)throw Error('キャラを選択してください');const ref=doc(db,'battleRooms',id);const snap=await getDoc(ref);if(!snap.exists())await setDoc(ref,{host:me.uid,guest:'',hostName:myName(),status:'waiting',createdAt:serverTimestamp()});else if(snap.data().host!==me.uid){if(snap.data().guest&&snap.data().guest!==me.uid)throw Error('満室です');await updateDoc(ref,{guest:me.uid,status:'active'})}roomId=id;battleStop?.();battleStop=onSnapshot(query(collection(db,'battleRooms',id,'actions'),orderBy('createdAt','asc'),limit(100)),snap=>window.archiveEnhancements.renderBattleMessages(snap.docs.map(d=>d.data())));return 'ルーム「'+id+'」に参加しました。相手にIDを共有してください'};
 const sendBattleAction=async text=>{requireLogin();if(!roomId)throw Error('先にルームへ参加してください');if(!text.trim())throw Error('行動を入力してください');const room=(await getDoc(doc(db,'battleRooms',roomId))).data();if(![room?.host,room?.guest].includes(me.uid))throw Error('参加者ではありません');await addDoc(collection(db,'battleRooms',roomId,'actions'),{author:me.uid,authorName:myName(),text:text.slice(0,3000),createdAt:serverTimestamp()})};
 function watch(){unsubs.forEach(f=>f());unsubs=[];if(!me)return;
 unsubs.push(onSnapshot(query(collection(db,'requests'),where('to','==',me.uid)),snap=>{const root=$('friendRequests');root.replaceChildren();snap.forEach(d=>{if(d.data().status!=='pending')return;const row=document.createElement('div');row.className='entry';row.textContent='申請者：'+d.data().from.slice(0,10)+' ';const b=document.createElement('button');b.className='primary';b.textContent='承認';b.onclick=async()=>{try{const from=d.data().from;await setDoc(doc(db,'friendships',[me.uid,from].sort().join('_')),{members:[me.uid,from].sort(),createdAt:serverTimestamp()});await updateDoc(d.ref,{status:'accepted'})}catch(e){safeErr(e)}};row.append(b);root.append(row)});if(!root.children.length)root.textContent='承認待ちなし'},safeErr));
 unsubs.push(onSnapshot(query(collection(db,'friendships'),where('members','array-contains',me.uid)),async snap=>{
  const root=$('friendsList'),sel=$('chatPeer'),current=sel.value,ownUid=me.uid;
  previewStops.forEach(stop=>stop());previewStops=[];
  const people=await Promise.all(snap.docs.map(async d=>{
    const peer=d.data().members.find(id=>id!==ownUid);
    if(!peer)return null;
    try{const u=await userData(peer);return {uid:peer,name:u.displayName||peer.slice(0,8)}}
    catch(e){console.warn('フレンド情報を取得できません',e);return {uid:peer,name:peer.slice(0,8)}}
  }));
  if(!me||me.uid!==ownUid)return;
  const valid=people.filter(Boolean);
  root.replaceChildren();sel.replaceChildren();
  const empty=document.createElement('option');empty.value='';empty.textContent='フレンドを選択してください';sel.append(empty);
  for(const f of valid){
    const row=document.createElement('div');row.className='entry';
    const name=document.createElement('b');name.textContent=f.name;row.append(name);
    const profileBtn=document.createElement('button');profileBtn.textContent='プロフィール';profileBtn.className='secondary';profileBtn.onclick=()=>viewProfile(f.uid);row.append(profileBtn);root.append(row);
    const opt=document.createElement('option');opt.value=f.uid;opt.textContent=f.name;sel.append(opt);
    const room=[ownUid,f.uid].sort().join('_');
    previewStops.push(onSnapshot(query(collection(db,'chats',room,'messages'),orderBy('createdAt','desc'),limit(1)),
      messages=>window.archiveChat?.preview(f.uid,messages.empty?null:messages.docs[0].data()),
      e=>console.warn('トーク一覧を取得できません',e)));
  }
  if(!valid.length)root.textContent='まだフレンドがいません。上の検索から追加できます。';
  sel.value=valid.some(f=>f.uid===current)?current:'';
  if(current&&!sel.value)sel.dispatchEvent(new Event('change'));
  window.archiveChat?.setFriends(valid);
 },safeErr));
 unsubs.push(onSnapshot(query(collection(db,'posts'),orderBy('createdAt','desc'),limit(40)),snap=>window.archiveEnhancements?.renderFeed(snap.docs.map(d=>d.data())),safeErr));
 // フレンドごとの閲覧許可クエリを使う。全キャラ横断クエリは権限違反になる。
 const refreshNotices=async()=>{try{const ids=await friends(),data=[];for(const uid of ids){for(const visibility of ['public','friends']){const s=await getDocs(query(collection(db,'characters'),where('owner','==',uid),where('visibility','==',visibility),limit(40)));data.push(...s.docs.map(d=>d.data()))}}window.archiveEnhancements?.renderNotices(data.sort((a,b)=>(b.updatedAt?.seconds||0)-(a.updatedAt?.seconds||0)).slice(0,10))}catch(e){safeErr(e)}};
 refreshNotices();
 unsubs.push(onSnapshot(query(collection(db,'friendships'),where('members','array-contains',me.uid)),refreshNotices,safeErr));
 }
 $('chatPeer').onchange=()=>{chatStop?.();chatStop=null;const peer=$('chatPeer').value;
  window.archiveChat?.renderMessages([],me?.uid||'');
  if(!peer||!me)return;
  const room=[me.uid,peer].sort().join('_');
  chatStop=onSnapshot(query(collection(db,'chats',room,'messages'),orderBy('createdAt','asc'),limit(100)),
    snap=>window.archiveChat?.renderMessages(snap.docs.map(d=>({id:d.id,...d.data()})),me.uid),safeErr);
 };
 $('saveProfile').addEventListener('click',()=>saveUser().catch(safeErr));
 onAuthStateChanged(auth,async u=>{
  me=u;unsubs.forEach(f=>f());unsubs=[];previewStops.forEach(f=>f());previewStops=[];
  chatStop?.();chatStop=null;battleStop?.();battleStop=null;
  window.archiveUIV07?.updateAuth(!!u,u);window.archiveChat?.updateAuth(!!u,u);
  window.archiveChat?.setFriends([]);
  if(u){
    status.textContent='Google連携中：'+(u.displayName||u.email);
    try{await saveUser();await loadCloud();await publishCharacters();watch()}
    catch(e){status.textContent+='（設定確認が必要：'+e.message+'）'}
  }else{
    status.textContent='ゲスト利用中。ログインなしでもキャラを作れます。';
    $('friendsList').textContent='';$('friendRequests').textContent='ログインすると表示されます';
  }
 });
 window.abilityOnline={login,logout,isLoggedIn,getToken,searchUsers,sendChat,joinBattle,sendBattleAction,syncNow,publishCharacters,publishPost,viewProfile,randomCharacter};
}catch(e){status.textContent='Firebase初期化エラー：'+e.message}
}else status.textContent='ゲスト利用中。Google連携にはFirebaseの初期設定が必要です。';
