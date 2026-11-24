/* ABILITY ARCHIVE v0.7: profile, settings, favorites, and LINE-style chat UI. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const favKey='ability_archive_favorites_v07';
 let authUser=null,friends=[],selectedPeer='',messages=[],previews=new Map();
 const profile=()=>window.archiveUI?.getProfile?.()||{};
 const entries=()=>window.archiveUI?.getEntries?.()||[];
 const displayName=()=>profile().name||authUser?.displayName||'プレイヤー';
 const initials=name=>Array.from(String(name||'友')).slice(0,2).join('').toUpperCase();
 const safeJSON=key=>{try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return {}}};
 const formatTime=t=>{if(!t)return '';const d=t?.toDate?.()||new Date((t.seconds||0)*1000);return Number.isNaN(+d)?'':d.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})};
 const msgDate=t=>{if(!t)return '';const d=t?.toDate?.()||new Date((t.seconds||0)*1000);return Number.isNaN(+d)?'':d.toLocaleDateString('ja-JP',{year:'numeric',month:'short',day:'numeric'})};
 const add=(tag,className,content)=>{const el=document.createElement(tag);if(className)el.className=className;if(content!==undefined)el.textContent=content;return el};
 const setting=$('settingsOverlay');
 const openSettings=()=>{setting.classList.remove('hidden');document.body.style.overflow='hidden'};
 const closeSettings=()=>{setting.classList.add('hidden');document.body.style.overflow=''};
 $('settingsOpenBtn').addEventListener('click',openSettings);
 $('settingsCloseBtn').addEventListener('click',closeSettings);
 $('settingsBackdrop').addEventListener('click',closeSettings);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeSettings();if(!$('chatThreadView').classList.contains('hidden'))closeThread()}});
 const closeEditor=()=>$('profileEditor').classList.add('hidden');
 $('profileEditBtn').addEventListener('click',()=>{$('profileEditor').classList.remove('hidden');$('profileEditor').scrollIntoView({behavior:'smooth',block:'nearest'})});
 $('profileEditClose').addEventListener('click',closeEditor);
 const refreshProfile=()=>{$('profileDisplayName').textContent=displayName();$('profileDisplayBio').textContent=profile().bio||'自分だけの能力世界を記録しよう';$('profileInitials').textContent=initials(displayName());$('profileLinkState').textContent=authUser?'Google連携中':'ゲスト利用中'};
 const updateAuth=(loggedIn,user)=>{authUser=loggedIn?user||{}:null;$('googleLogin').classList.toggle('hidden',loggedIn);$('googleLogout').classList.toggle('hidden',!loggedIn);refreshProfile();if(!loggedIn){friends=[];previews.clear();closeThread();renderChats()}else{renderChats()}};
 const openTab=which=>{for(const b of document.querySelectorAll('[data-profile-tab]')){const active=b.dataset.profileTab===which;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))}for(const p of document.querySelectorAll('.profile-panel'))p.classList.toggle('hidden',p.id!=='panel-'+which)};
 for(const b of document.querySelectorAll('[data-profile-tab]'))b.addEventListener('click',()=>openTab(b.dataset.profileTab));
 $('goLibraryFromProfile').addEventListener('click',()=>document.querySelector('[data-page="library"]').click());
 $('chatAddFriends').addEventListener('click',goFriends);
 function goFriends(){document.querySelector('[data-page="profile"]').click();openTab('friends')}
 let favorites=safeJSON(favKey);
 function refreshFavorites(){
  const characterSel=$('oshiCharSelect'),battleSel=$('oshiBattleSelect');
  const chosenCharacter=favorites.character||'',chosenBattle=favorites.battle||'';
  characterSel.replaceChildren(new Option('設定なし',''));
  entries().forEach(c=>characterSel.add(new Option(c.name||'名前なし',c.id)));
  const history=(()=>{try{return JSON.parse(localStorage.getItem('ability_archive_battles_v1')||'[]')}catch{return []}})();
  battleSel.replaceChildren(new Option('設定なし',''));
  history.forEach(b=>battleSel.add(new Option(b.title||'戦闘履歴',b.id)));
  characterSel.value=entries().some(c=>c.id===chosenCharacter)?chosenCharacter:'';
  battleSel.value=history.some(b=>b.id===chosenBattle)?chosenBattle:'';
  const ch=entries().find(c=>c.id===characterSel.value),bh=history.find(b=>b.id===battleSel.value);
  $('oshiCharCard').textContent=ch?.name||'設定なし';$('oshiCharCard').classList.toggle('empty',!ch);
  $('oshiBattleCard').textContent=bh?.title||'設定なし';$('oshiBattleCard').classList.toggle('empty',!bh);
 }
 $('oshiCharSelect').addEventListener('change',()=>{favorites.character=$('oshiCharSelect').value;localStorage.setItem(favKey,JSON.stringify(favorites));refreshFavorites()});
 $('oshiBattleSelect').addEventListener('change',()=>{favorites.battle=$('oshiBattleSelect').value;localStorage.setItem(favKey,JSON.stringify(favorites));refreshFavorites()});
 const list=$('chatList');
 const getFriend=id=>friends.find(f=>f.uid===id);
 function renderChats(){
  list.replaceChildren();const term=$('chatSearch').value.trim().toLocaleLowerCase('ja-JP');
  if(!authUser){const empty=add('div','chat-empty');empty.append(add('div','chat-empty-icon','🔐'),add('b','','トークにはGoogleログインが必要です'),add('p','','キャラ作成などはログインせずに利用できます。'));const b=add('button','primary','設定からログイン');b.onclick=()=>{document.querySelector('[data-page="profile"]').click();openSettings()};empty.append(b);list.append(empty);return}
  const matches=friends.filter(f=>f.name.toLocaleLowerCase('ja-JP').includes(term));
  if(!matches.length){const empty=add('div','chat-empty');empty.append(add('div','chat-empty-icon','💬'),add('b','',friends.length?'該当するフレンドがいません':'まだトークはありません'),add('p','',friends.length?'別の名前で検索してみてください。':'マイページからフレンド申請して、会話を始めよう。'));const b=add('button','secondary','フレンドを探す');b.onclick=goFriends;empty.append(b);list.append(empty);return}
  matches.sort((a,b)=>(previews.get(b.uid)?.createdAt?.seconds||0)-(previews.get(a.uid)?.createdAt?.seconds||0));
  for(const f of matches){const item=add('button','chat-conversation');item.type='button';item.setAttribute('aria-label',f.name+'とのトークを開く');item.append(add('div','chat-avatar',initials(f.name)));const body=add('div','chat-conversation-body'),top=add('div','chat-conversation-top');top.append(add('div','chat-conversation-name',f.name));top.append(add('time','chat-conversation-time',formatTime(previews.get(f.uid)?.createdAt)));body.append(top,add('div','chat-conversation-preview',previews.get(f.uid)?.text||'メッセージを送って会話を始めよう'));item.append(body);item.onclick=()=>openThread(f.uid);list.append(item)}
 }
 function setFriends(newFriends){friends=Array.isArray(newFriends)?newFriends.filter(x=>x.uid&&x.name):[];renderChats();if(selectedPeer&&!getFriend(selectedPeer))closeThread();else if(selectedPeer){const f=getFriend(selectedPeer);$('chatThreadName').textContent=f.name;$('chatThreadAvatar').textContent=initials(f.name)}}
 function preview(uid,entry){if(entry)previews.set(uid,entry);else previews.delete(uid);renderChats()}
 function openThread(uid){const f=getFriend(uid);if(!f)return;selectedPeer=uid;$('chatThreadName').textContent=f.name;$('chatThreadAvatar').textContent=initials(f.name);$('chatListView').classList.add('hidden');$('chatThreadView').classList.remove('hidden');$('chatText').value='';$('chatMessages').replaceChildren();const opt=$('chatPeer');if(opt.value!==uid){opt.value=uid;opt.dispatchEvent(new Event('change'))}else if(!messages.length){opt.dispatchEvent(new Event('change'))}document.getElementById('chat').scrollIntoView({block:'start'})}
 function closeThread(){selectedPeer='';messages=[];$('chatThreadView').classList.add('hidden');$('chatListView').classList.remove('hidden');if($('chatPeer').value){$('chatPeer').value='';$('chatPeer').dispatchEvent(new Event('change'))}}
 $('chatBack').addEventListener('click',closeThread);
 $('chatSearch').addEventListener('input',renderChats);
 function renderMessages(items,myId){messages=Array.isArray(items)?items:[];const box=$('chatMessages');box.replaceChildren();if(!items.length){const empty=add('div','chat-empty');empty.append(add('p','','まだメッセージはありません。最初のメッセージを送ってみよう！'));box.append(empty);return}let lastDate='';for(const m of items){const date=msgDate(m.createdAt);if(date&&date!==lastDate){box.append(add('div','chat-date-separator',date));lastDate=date}const mine=m.from===myId;const row=add('div','chat-message-row'+(mine?' mine':''));row.append(add('div','chat-bubble',m.text||''),add('time','chat-message-time',formatTime(m.createdAt)));box.append(row)}box.scrollTop=box.scrollHeight}
 const sendBtn=$('chatSend');
 const send=async()=>{const txt=$('chatText').value.trim();if(!txt)return;if(!authUser){openSettings();return}if(!selectedPeer)return;sendBtn.disabled=true;try{await window.abilityOnline?.sendChat?.(selectedPeer,txt);$('chatText').value='';$('chatText').style.height='';}catch(e){alert('送信できませんでした：'+(e.message||e))}finally{sendBtn.disabled=false}};
 sendBtn.onclick=null;sendBtn.addEventListener('click',send);
 $('chatText').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();send()}});
 $('chatText').addEventListener('input',()=>{$('chatText').style.height='auto';$('chatText').style.height=Math.min($('chatText').scrollHeight,110)+'px'});
 window.archiveUIV07={refreshProfile,refreshFavorites,reloadFavorites:()=>{favorites=safeJSON(favKey);refreshFavorites()},closeEditor,updateAuth,openTab};
 window.archiveChat={setFriends,preview,renderMessages,updateAuth,closeThread};
 refreshProfile();refreshFavorites();renderChats();
})();
