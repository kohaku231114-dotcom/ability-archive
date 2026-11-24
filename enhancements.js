/* ABILITY ARCHIVE online/AI integration. Existing local data remains usable offline. */
(()=>{
 const $=id=>document.getElementById(id);
 const entries=window.archiveUI.getEntries();
 const notify=message=>window.archiveUI.notify(message);
 const specs=['name','setting','gender','speech','pronoun','ability','world','notes'].map(id=>[id]);
 const add=(parent,tag,attrs={},text='')=>{const el=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>{if(k==='className')el.className=v;else el.setAttribute(k,v)});if(text)el.textContent=text;parent.append(el);return el};

 const battle=$('battle');
 const pane=add(battle.querySelector('.box'),'div',{className:'online-options'});
 pane.innerHTML='<label>オンライン対戦ルーム</label><p class="hint">相手と同じルームIDを入力し、相手の同意を得て対戦します。オンライン設定が必要です。</p><input id="battleRoom" placeholder="ルームID（フレンドと共有）"><button class="secondary" id="battleJoin">ルームを作成／参加</button><p id="battleRoomStatus" class="hint"></p><div id="battleRemote" class="battle-log hidden"></div><button class="secondary" id="battleRemoteSend">この行動をオンライン送信</button>';

 const aiButton=add($('battleStart').parentElement,'button',{id:'battleAI',className:'primary'},'AIで小説・判定を生成');
 const characterButton=add($('requestArea'),'button',{id:'generateCharacter',className:'primary'},'AIでキャラクターを生成');
 $('modeHelp').insertAdjacentText('beforeend',' 端末内AIはログイン不要です。画像自体の認識はできません。');

 const feed=add($('board').querySelector('.box'),'div',{id:'onlineFeed',className:'entry'},'公開タイムライン：Google連携後に表示');
 const notices=add($('friendNoticesMount'),'div',{id:'friendNotices',className:'entry'},'新キャラ通知はGoogle連携後に表示');
 const search=add($('battle').querySelector('.box'),'div',{id:'encounterResults'});
 const onlineCard=add($('settingsContent'),'div',{className:'setting-block'});
 onlineCard.innerHTML='<h2>クラウド同期</h2><p class="hint">Google連携中はキャラクターと戦闘履歴をクラウドへ同期します。画像は容量を抑えて保存します。</p><button class="secondary" id="cloudSync">今すぐ同期</button><p id="syncStatus" class="hint"></p>';
 const profileViewer=add($('publicProfileSection'),'div',{className:'box hidden',id:'publicProfile'});
 profileViewer.innerHTML='<h2>他プレイヤーのプロフィール</h2><div id="publicProfileBody">公開プロフィールを選択すると表示されます。</div>';

 const aiSettings=add($('settingsContent'),'div',{className:'setting-block'});
 aiSettings.innerHTML='<h2>生成AI設定</h2><p class="hint">端末内AIはAPIキー不要。初回は数百MB〜1GB以上のモデルを取得します。Wi-Fi推奨。画像認識には非対応です。</p><label for="aiProvider">AI方式</label><select id="aiProvider"><option value="local">端末内AI（無料・実験版）</option></select><p id="localAIStatus" role="status" class="hint"></p>';
 const provider=$('aiProvider'); provider.value='local';
 provider.onchange=()=>localStorage.setItem('aa_ai_provider',provider.value);
 let busy=false;
 async function callAI(payload){
  if(busy)throw Error('別のAI生成が進行中です');
  busy=true;
  try{
   const {generateLocal}=await import('./local-ai.mjs');
   return await generateLocal(payload,msg=>{ $('localAIStatus').textContent=msg; notify(msg); });
  }finally{busy=false;}
 }

 const current=()=>({
  a:entries.find(x=>x.id===$('battleCharacter').value),
  b:entries.find(x=>x.id===$('battleOpponent').value)
 });

 // 戦闘形式切り替え時のUI連動
 const syncBattleModeUI=()=>{
  const style=$('battleStyle').value;
  $('battleInput').classList.toggle('hidden',style!=='chat');
  aiButton.textContent=style==='chat'?'AIで行動判定・次ターンを生成':'AIで小説・勝敗を生成';
 };
 $('battleStyle').addEventListener('change',syncBattleModeUI);
 syncBattleModeUI();

 // 対話型バトルの「行動を送る」ボタンもAIとシームレス連動（ログイン中ならそのままAI判定へ）
 const oldBattleSend=$('battleSend').onclick;
 $('battleSend').onclick=async()=>{
  const action=$('battleAction').value.trim();
  if(!action)return alert('行動を書いてください');
  if(provider.value==='local'||window.abilityOnline?.isLoggedIn?.()){
   aiButton.click();
   return;
  }
  oldBattleSend?.();
 };

 // AIバトル生成（小説型・対話型両対応）
 aiButton.onclick=async()=>{
  const {a,b:localB}=current();
  const b=$('battleTarget').value==='random-ai'?window.archiveRandomOpponent:localB;
  if(!a||!b)return alert('自分と相手のキャラクターを選択してください');
  const style=$('battleStyle').value;
  const action=$('battleAction').value.trim();
  if(style==='chat'&&!action){
   return alert('対話型バトルでは、下の入力欄にキャラクターの「行動」を入力してください');
  }

  aiButton.disabled=true;
  const prevText=aiButton.textContent;
  aiButton.textContent='AIが執筆・判定中…';
  try{
   const existingLog=$('battleLog').textContent.trim();
   const intro=existingLog?'':`【${a.name} VS ${b.name}】\n`;
   const turnHeader=style==='chat'?`\n---\n▶ 【プレイヤー行動】${action}\n\n`:'';
   const result=await callAI({
    type:'battle',
    a,
    b,
    style,
    history:existingLog,
    action
   });

   const nextLog=(intro+existingLog+turnHeader+result.text).trim();
   $('battleLog').textContent=nextLog;
   $('battleLog').scrollTop=$('battleLog').scrollHeight;

   // 履歴保存（同一対戦の連続ターンは最新ログで更新）
   const old=JSON.parse(localStorage.getItem('ability_archive_battles_v1')||'[]');
   const title=a.name+' VS '+b.name;
   if(style==='chat'&&old.length&&old[0].title===title&&existingLog){
    old[0].text=nextLog;
    old[0].date=new Date().toLocaleString('ja-JP');
   }else{
    old.unshift({id:crypto.randomUUID(),title,text:nextLog,date:new Date().toLocaleString('ja-JP')});
   }
   localStorage.setItem('ability_archive_battles_v1',JSON.stringify(old));
   window.abilityOnline?.syncNow?.().catch(()=>{});
   $('battleAction').value='';
   notify('AIの描写を生成し、履歴に保存しました');
  }catch(e){
   alert(e.message);
  }finally{
   aiButton.disabled=false;
   aiButton.textContent=prevText;
   syncBattleModeUI();
  }
 };

 // AIキャラクター生成
 characterButton.onclick=async()=>{
  const request=$('request').value.trim();
  if(!request)return alert('AIへの要望を入力してください');
  characterButton.disabled=true;
  const prevText=characterButton.textContent;
  characterButton.textContent='AIが設定を生成中…';
  try{
   const result=await callAI({
    type:'character',
    request,
    existing:specs.reduce((o,[id])=>(o[id]=$(id).value,o),{})
   });
   const raw=result.text.trim().replace(/^```(?:json)?\s*|\s*```$/g,'');
   const data=JSON.parse(raw);
   for(const [id] of specs){
    if(data[id]!==undefined&&data[id]!==null&&$(id)){
     $(id).value=String(data[id]);
    }
   }
   notify('AI生成結果を入力欄に反映しました。確認して「保存する」を押してください');
  }catch(e){
   alert('AI生成失敗：'+e.message);
  }finally{
   characterButton.disabled=false;
   characterButton.textContent=prevText;
  }
 };

 $('battleJoin').onclick=async()=>{try{const result=await window.abilityOnline?.joinBattle?.($('battleRoom').value.trim(),$('battleCharacter').value);if(!result)throw Error('Google連携とFirebase設定が必要です');$('battleRoomStatus').textContent=result}catch(e){alert(e.message)}};
 $('battleRemoteSend').onclick=async()=>{try{await window.abilityOnline?.sendBattleAction?.($('battleAction').value);$('battleAction').value=''}catch(e){alert(e.message)}};
 $('cloudSync').onclick=async()=>{try{await window.abilityOnline?.syncNow?.();$('syncStatus').textContent='同期を完了しました'}catch(e){$('syncStatus').textContent='同期失敗：'+e.message}};

 const oldSave=$('save').onclick;
 $('save').onclick=(e)=>{const before=JSON.stringify(entries);oldSave(e);window.archiveUI.renderBattleChoices();if(JSON.stringify(window.archiveUI.getEntries())!==before){window.abilityOnline?.syncNow?.().catch(()=>{});window.abilityOnline?.publishCharacters?.().catch(()=>{})}};
 const oldDelete=$('deleteCharacter').onclick;
 $('deleteCharacter').onclick=(e)=>{oldDelete(e);window.abilityOnline?.syncNow?.().catch(()=>{});window.abilityOnline?.publishCharacters?.().catch(()=>{})};
 const oldPost=$('postSend').onclick;
 $('postSend').onclick=async(e)=>{const txt=$('postText').value.trim(),id=$('postCharacter').value;const c=entries.find(x=>x.id===id);if(!txt)return;if(c&&c.visibility!=='public')return alert('公開キャラのみ添付できます');if(window.abilityOnline?.isLoggedIn?.()){try{await window.abilityOnline.publishPost(txt,c);$('postText').value='';notify('公開タイムラインに投稿しました');return}catch(err){alert(err.message);return}}oldPost(e)};

 const oldStart=$('battleStart').onclick;
 $('battleStart').onclick=async e=>{
  const target=$('battleTarget').value;
  if(target==='random-ai'){
   try{
    const found=await window.abilityOnline?.randomCharacter?.();
    if(!found)throw Error('公開キャラが見つかりません');
    const {a}=current();
    if(!a)throw Error('自分のキャラを選んでください');
    $('battleLog').textContent=`【${a.name} VS ${found.name}】\n対戦相手：${found.name}\n能力：${found.ability}\n相手作成者：${found.ownerName||'プレイヤー'}`;
    window.archiveRandomOpponent=found;
    const root=$('encounterResults');root.replaceChildren();
    add(root,'button',{className:'secondary',id:'viewOpponent'},'対戦相手の作成者プロフィールを見る').onclick=()=>window.abilityOnline.viewProfile(found.owner);
    notify('公開キャラとマッチングしました。AI生成ボタンを押すと戦闘が始まります');
    return;
   }catch(err){
    alert(err.message);
    return;
   }
  }
  oldStart(e);
  syncBattleModeUI();
 };

 window.archiveEnhancements={
  renderFeed(items){feed.replaceChildren();items.forEach(p=>{const el=add(feed,'div',{className:'entry'});add(el,'b',{},p.authorName||'プレイヤー');add(el,'p',{},p.text||'');if(p.character?.name)add(el,'small',{},'添付キャラ：'+p.character.name);add(el,'button',{className:'secondary'},'プロフィール').onclick=()=>window.abilityOnline?.viewProfile?.(p.author)});if(!items.length)feed.textContent='まだ公開投稿はありません'},
  renderNotices(items){notices.replaceChildren();items.forEach(p=>add(notices,'p',{},`${p.ownerName||'フレンド'}が「${p.name}」を公開しました`));if(!items.length)notices.textContent='新しい通知はありません'},
  renderProfile(user,chars){$('publicProfile').classList.remove('hidden');const root=$('publicProfileBody');root.replaceChildren();add(root,'h3',{},user?.displayName||'プレイヤー');add(root,'p',{},user?.bio||'');chars.forEach(c=>{const el=add(root,'div',{className:'detail-row'});add(el,'b',{},c.name);add(el,'p',{},c.ability||'')});$('publicProfile').scrollIntoView({behavior:'smooth',block:'start'})},
  renderBattleMessages(messages){$('battleRemote').classList.remove('hidden');$('battleRemote').textContent=messages.map(m=>`${m.authorName||'プレイヤー'}：${m.text}`).join('\n\n')}
 };
})();
