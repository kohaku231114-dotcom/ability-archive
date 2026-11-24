import {buildPrompts} from './ai-prompts.mjs';
let enginePromise;
const MODEL='Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
export async function generateLocal(body, progress=()=>{}) {
 if(!navigator.gpu) throw Error('このブラウザはWebGPU非対応です。対応するSafariまたはPCでお試しください。');
 const adapter=await navigator.gpu.requestAdapter();
 if(!adapter || !adapter.features.has('shader-f16')) throw Error('端末のGPUがこのAIモデルに対応していません。');
 const built=buildPrompts(body);
 if(!built)throw Error('不明な生成形式です');
 if(!enginePromise){
  if(!confirm('初回はAIモデルをダウンロードします（数百MB以上）。Wi-Fi接続で開始しますか？'))throw Error('ダウンロードを中止しました');
  enginePromise=(async()=>{
   const {CreateMLCEngine}=await import('https://esm.run/@mlc-ai/web-llm@0.2.79');
   return CreateMLCEngine(MODEL,{initProgressCallback:r=>progress('AI準備中 '+Math.round(r.progress*100)+'%')});
  })().catch(e=>{enginePromise=undefined;throw e;});
 }
 try{
  const engine=await enginePromise;
  progress('端末内AIが生成中…');
  const messages=[{role:'system',content:built.system},{role:'user',content:built.prompt}];
  const result=await engine.chat.completions.create({messages,temperature:0.7,max_tokens:body.type==='character'?900:1200,...(built.isJson?{response_format:{type:'json_object'}}:{})});
  const text=result.choices?.[0]?.message?.content;
  if(!text)throw Error('AIから空の応答が返りました');
  progress('生成完了');return {text,provider:'local'};
 }catch(e){progress('生成失敗');throw Error('端末内AI: '+(e.message||e)+'。長い設定の場合は短くして再試行してください。');}
}
